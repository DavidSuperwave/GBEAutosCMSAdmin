import 'dotenv/config'

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Client } from 'pg'

import {
  buildSupabaseMediaObjectKey,
  readSupabaseS3StorageConfig,
  type SupabaseS3StorageConfig,
} from '../src/services/supabaseS3Storage'

type MediaRow = {
  filename: string | null
  filesize: number | null
  id: number | string
  mime_type: string | null
  url: string | null
}

type LocalMedia = {
  contentMD5: string
  id: number | string
  key: string
  localPath: string
  mimeType: string
  name: string
  sha256: string
  size: number
}

type LocalBlock = { id: number | string; name: string; reason: string }
type StorageAudit = LocalMedia & { detail?: string; status: 'exact' | 'mismatch' | 'missing' }
type MislabeledRepair = {
  id: number | string
  newMimeType: string
  newName: string
  newUrl: string
  oldMimeType: string
  oldName: string
  oldUrl: string
  sha256: string
  size: number
}

function usage() {
  console.log(`Usage:
  npm run sync:media-storage
  npm run sync:media-storage -- --apply
  npm run sync:media-storage -- --local-only

This command is dry-run-only by default. It audits every Payload Media row
against media/<filename> and the configured Supabase S3 object. --apply uploads
only missing, fully verified objects and never changes Media rows.

Options:
  --apply       Upload missing verified objects. Requires complete S3 config.
  --local-only  Audit DB and local files without S3 credentials. Cannot apply.
  --repair-mislabeled  Show exact filename/MIME/URL repairs without changing anything.
  --apply-repairs      With --repair-mislabeled, copy files and transactionally update
                       the same Media IDs. Does not upload storage objects.
  --media-dir   Override the local media directory (default: ./media).
  --help        Show this help.`)
}

function parseArgs(argv: string[]) {
  let apply = false
  let applyRepairs = false
  let localOnly = false
  let repairMislabeled = false
  let mediaDir = path.resolve('media')
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--apply') apply = true
    else if (arg === '--local-only') localOnly = true
    else if (arg === '--repair-mislabeled') repairMislabeled = true
    else if (arg === '--apply-repairs') applyRepairs = true
    else if (arg === '--dry-run') apply = false
    else if (arg === '--media-dir') {
      mediaDir = path.resolve(argv[index + 1] || '')
      index += 1
    } else if (arg.startsWith('--media-dir=')) mediaDir = path.resolve(arg.slice('--media-dir='.length))
    else if (arg === '--help' || arg === '-h') {
      usage()
      process.exit(0)
    } else throw new Error(`Unknown argument: ${arg}`)
  }
  if (apply && localOnly) throw new Error('--apply cannot be combined with --local-only.')
  if (applyRepairs && !repairMislabeled) {
    throw new Error('--apply-repairs requires --repair-mislabeled.')
  }
  if (apply && repairMislabeled) {
    throw new Error('Storage --apply cannot be combined with mislabeled-media repair mode.')
  }
  return { apply, applyRepairs, localOnly, mediaDir, repairMislabeled }
}

function allowedMimeTypes() {
  const configured =
    process.env.SUPABASE_S3_ALLOWED_MIME_TYPES?.trim() ||
    'image/jpeg,image/png,image/webp,image/avif'
  return new Set(
    configured
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
}

async function readMediaRows() {
  const databaseUri = process.env.DATABASE_URI?.trim()
  if (!databaseUri) throw new Error('DATABASE_URI is required.')
  const client = new Client({
    application_name: 'gbe-media-storage-audit',
    connectionString: databaseUri,
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
  })
  try {
    await client.connect()
    await client.query('begin transaction read only')
    const result = await client.query<MediaRow>(
      'select id, filename, filesize, mime_type, url from media order by id',
    )
    await client.query('rollback')
    return result.rows
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

function digest(buffer: Buffer, algorithm: 'md5' | 'sha256', encoding: 'base64' | 'hex') {
  return createHash(algorithm).update(buffer).digest(encoding)
}

function detectMimeType(buffer: Buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString('ascii') === 'ftyp' &&
    ['avif', 'avis'].includes(buffer.subarray(8, 12).toString('ascii'))
  ) {
    return 'image/avif'
  }
  return ''
}

function extensionForMime(mimeType: string) {
  return (
    {
      'image/avif': 'avif',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    } as Record<string, string>
  )[mimeType]
}

function verifyLocalMedia(
  rows: MediaRow[],
  mediaDir: string,
  storage: SupabaseS3StorageConfig,
  allowed: Set<string>,
) {
  const blocks: LocalBlock[] = []
  const repairs: MislabeledRepair[] = []
  const verified: LocalMedia[] = []
  for (const row of rows) {
    const name = row.filename?.trim() || ''
    if (!name || name !== path.basename(name) || name.includes('/') || name.includes('\\')) {
      blocks.push({ id: row.id, name: name || '(missing filename)', reason: 'unsafe_or_missing_filename' })
      continue
    }
    const localPath = path.join(mediaDir, name)
    if (!fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
      blocks.push({ id: row.id, name, reason: 'local_file_missing' })
      continue
    }
    const buffer = fs.readFileSync(localPath)
    if (row.filesize === null || buffer.length !== Number(row.filesize)) {
      blocks.push({ id: row.id, name, reason: `local_size_mismatch_db_${String(row.filesize)}` })
      continue
    }
    const mimeType = row.mime_type?.trim().toLowerCase() || ''
    const detectedMimeType = detectMimeType(buffer)
    if (detectedMimeType !== mimeType) {
      const extension = extensionForMime(detectedMimeType)
      if (extension && row.url) {
        const stem = path.parse(name).name.replace(/[^a-zA-Z0-9_-]+/g, '-')
        const newName = `${stem}-media-${String(row.id)}.${extension}`
        repairs.push({
          id: row.id,
          newMimeType: detectedMimeType,
          newName,
          newUrl: `/api/media/file/${newName}`,
          oldMimeType: mimeType,
          oldName: name,
          oldUrl: row.url,
          sha256: digest(buffer, 'sha256', 'hex'),
          size: buffer.length,
        })
      }
      blocks.push({ id: row.id, name, reason: `local_mime_mismatch_db_${mimeType || 'missing'}` })
      continue
    }
    if (!allowed.has(mimeType)) {
      blocks.push({ id: row.id, name, reason: `bucket_mime_not_allowed:${mimeType || 'missing'}` })
      continue
    }
    verified.push({
      contentMD5: digest(buffer, 'md5', 'base64'),
      id: row.id,
      key: buildSupabaseMediaObjectKey(storage.prefix, name),
      localPath,
      mimeType,
      name,
      sha256: digest(buffer, 'sha256', 'hex'),
      size: buffer.length,
    })
  }
  return { blocks, repairs, verified }
}

async function applyMislabeledRepairs(repairs: MislabeledRepair[], mediaDir: string) {
  if (repairs.length === 0) throw new Error('No mislabeled Media rows were found to repair.')
  if (new Set(repairs.map((repair) => repair.newName)).size !== repairs.length) {
    throw new Error('Repair plan contains duplicate destination filenames.')
  }
  const databaseUri = process.env.DATABASE_URI?.trim()
  if (!databaseUri) throw new Error('DATABASE_URI is required.')

  const client = new Client({
    application_name: 'gbe-media-mime-repair',
    connectionString: databaseUri,
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
  })
  const copied: string[] = []
  let committed = false
  try {
    await client.connect()
    await client.query('begin')
    const locked = await client.query<MediaRow>(
      'select id, filename, filesize, mime_type, url from media where id = any($1::int[]) order by id for update',
      [repairs.map((repair) => Number(repair.id))],
    )
    if (locked.rows.length !== repairs.length) throw new Error('A repair target Media row disappeared.')

    const collisions = await client.query<{ filename: string }>(
      'select filename from media where filename = any($1::text[])',
      [repairs.map((repair) => repair.newName)],
    )
    if (collisions.rows.length > 0) {
      throw new Error(`Destination filename already exists in Media: ${collisions.rows[0].filename}`)
    }

    for (const repair of repairs) {
      const current = locked.rows.find((row) => String(row.id) === String(repair.id))
      if (
        !current ||
        current.filename !== repair.oldName ||
        Number(current.filesize) !== repair.size ||
        current.mime_type !== repair.oldMimeType ||
        current.url !== repair.oldUrl
      ) {
        throw new Error(`Media ${String(repair.id)} changed after the dry-run plan was built.`)
      }
      const sourcePath = path.join(mediaDir, repair.oldName)
      const destinationPath = path.join(mediaDir, repair.newName)
      if (fs.existsSync(destinationPath)) {
        throw new Error(`Destination local file already exists: ${repair.newName}`)
      }
      const source = fs.readFileSync(sourcePath)
      if (digest(source, 'sha256', 'hex') !== repair.sha256) {
        throw new Error(`Source file changed after audit: ${repair.oldName}`)
      }
      fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL)
      if (digest(fs.readFileSync(destinationPath), 'sha256', 'hex') !== repair.sha256) {
        throw new Error(`Copied file verification failed: ${repair.newName}`)
      }
      copied.push(destinationPath)

      const updated = await client.query(
        `
          update media
          set filename = $1, mime_type = $2, url = $3, updated_at = now()
          where id = $4 and filename = $5 and mime_type = $6 and url = $7
          returning id
        `,
        [
          repair.newName,
          repair.newMimeType,
          repair.newUrl,
          repair.id,
          repair.oldName,
          repair.oldMimeType,
          repair.oldUrl,
        ],
      )
      if (updated.rowCount !== 1) throw new Error(`Optimistic update failed for Media ${String(repair.id)}.`)
    }
    await client.query('commit')
    committed = true

    for (const repair of repairs) {
      try {
        fs.unlinkSync(path.join(mediaDir, repair.oldName))
      } catch (error) {
        console.warn(
          `WARNING: repaired Media ${String(repair.id)}, but old local file remains: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    return repairs.length
  } catch (error) {
    if (!committed) {
      await client.query('rollback').catch(() => undefined)
      for (const copiedPath of copied.reverse()) {
        try {
          fs.unlinkSync(copiedPath)
        } catch {
          // The original remains intact; report the primary error below.
        }
      }
    }
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

function storageClient(config: SupabaseS3StorageConfig) {
  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: true,
    region: config.region,
  })
}

function isNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const value = error as { $metadata?: { httpStatusCode?: number }; name?: string }
  return (
    value.$metadata?.httpStatusCode === 404 ||
    value.name === 'NotFound' ||
    value.name === 'NoSuchKey'
  )
}

async function auditStorage(
  s3: S3Client,
  bucket: string,
  files: LocalMedia[],
): Promise<StorageAudit[]> {
  const audits: StorageAudit[] = []
  for (const file of files) {
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: file.key }))
      const etag = head.ETag?.replaceAll('"', '').toLowerCase()
      const localMD5 = Buffer.from(file.contentMD5, 'base64').toString('hex')
      const hashMatches = head.Metadata?.sha256 === file.sha256 || etag === localMD5
      const exact = head.ContentLength === file.size && hashMatches
      audits.push({
        ...file,
        detail: exact ? undefined : 'remote size or integrity metadata/ETag differs',
        status: exact ? 'exact' : 'mismatch',
      })
    } catch (error) {
      if (isNotFound(error)) audits.push({ ...file, status: 'missing' })
      else throw error
    }
  }
  return audits
}

async function uploadMissing(
  s3: S3Client,
  bucket: string,
  audits: StorageAudit[],
) {
  let uploaded = 0
  let reused = 0
  for (const item of audits) {
    if (item.status === 'exact') {
      reused += 1
      continue
    }
    if (item.status === 'mismatch') {
      throw new Error(`Refusing to overwrite mismatched object: ${item.key}`)
    }
    const body = fs.readFileSync(item.localPath)
    if (body.length !== item.size || digest(body, 'sha256', 'hex') !== item.sha256) {
      throw new Error(`Local file changed after audit: ${item.name}`)
    }
    await s3.send(
      new PutObjectCommand({
        Body: body,
        Bucket: bucket,
        CacheControl: 'public, max-age=31536000, immutable',
        ContentMD5: item.contentMD5,
        ContentType: item.mimeType,
        Key: item.key,
        Metadata: { 'payload-media-id': String(item.id), sha256: item.sha256 },
      }),
    )
    const [verified] = await auditStorage(s3, bucket, [item])
    if (verified?.status !== 'exact') throw new Error(`Post-upload verification failed: ${item.key}`)
    uploaded += 1
  }
  return { reused, uploaded }
}

function printLocalBlocks(blocks: LocalBlock[]) {
  console.log(`Local/DB blocked: ${blocks.length}`)
  for (const block of blocks) console.log(`  - Media ${String(block.id)} ${block.name}: ${block.reason}`)
}

function printRepairPlan(repairs: MislabeledRepair[]) {
  console.log(`Mislabeled-media repair plan: ${repairs.length}`)
  for (const repair of repairs) {
    console.log(
      `  - Media ${String(repair.id)}: ${repair.oldName} (${repair.oldMimeType}) -> ${repair.newName} (${repair.newMimeType})`,
    )
    console.log(`    ${repair.oldUrl} -> ${repair.newUrl}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const configResult = readSupabaseS3StorageConfig(process.env)
  if (!options.localOnly && !options.repairMislabeled && !configResult.configured) {
    const detail = [...configResult.missing, ...configResult.errors].join('; ')
    throw new Error(`Valid server-side Supabase S3 configuration is required: ${detail}`)
  }
  if (!fs.existsSync(options.mediaDir) || !fs.statSync(options.mediaDir).isDirectory()) {
    throw new Error(`Media directory not found: ${options.mediaDir}`)
  }

  // Local-only mode uses non-secret placeholder routing values solely to build
  // deterministic keys; it never creates an S3 client.
  const storage = configResult.configured
    ? configResult.config
    : {
        accessKeyId: '',
        bucket: 'vehicle-images',
        endpoint: '',
        prefix: process.env.SUPABASE_S3_PREFIX?.trim() || 'cms_media',
        publicUrlBase: '',
        region: '',
        secretAccessKey: '',
      }
  const allowed = allowedMimeTypes()
  const rows = await readMediaRows()
  const local = verifyLocalMedia(rows, options.mediaDir, storage, allowed)

  console.log(
    `Mode: ${
      options.repairMislabeled
        ? options.applyRepairs
          ? 'REPAIR APPLY'
          : 'REPAIR DRY RUN'
        : options.apply
          ? 'APPLY'
          : options.localOnly
            ? 'LOCAL-ONLY DRY RUN'
            : 'DRY RUN'
    }`,
  )
  console.log(`Media rows: ${rows.length}`)
  console.log(`Local files verified for bucket policy: ${local.verified.length}`)
  console.log(`Bucket MIME allow-list: ${[...allowed].join(', ')}`)
  console.log(`Object prefix: ${storage.prefix}`)
  printLocalBlocks(local.blocks)
  printRepairPlan(local.repairs)

  if (options.repairMislabeled) {
    if (!options.applyRepairs) {
      throw new Error(
        'Repair dry run only. Re-run with --repair-mislabeled --apply-repairs after reviewing every old -> new mapping.',
      )
    }
    const repairIds = new Set(local.repairs.map((repair) => String(repair.id)))
    const unrelatedBlocks = local.blocks.filter(
      (block) =>
        !repairIds.has(String(block.id)) || !block.reason.startsWith('local_mime_mismatch_db_'),
    )
    if (unrelatedBlocks.length > 0 || local.repairs.length !== local.blocks.length) {
      throw new Error('Repair apply is blocked by unrelated local/DB audit failures.')
    }
    const repaired = await applyMislabeledRepairs(local.repairs, options.mediaDir)
    console.log(`Repair complete: ${repaired} Media IDs retained and corrected. No storage objects uploaded.`)
    return
  }

  if (options.localOnly) {
    if (local.blocks.length > 0) throw new Error('Local audit found blocking media rows.')
    console.log('Local-only audit complete. No DB or file changes were made.')
    return
  }

  const s3 = storageClient(storage)
  try {
    const audits = await auditStorage(s3, storage.bucket, local.verified)
    const exact = audits.filter((item) => item.status === 'exact').length
    const missing = audits.filter((item) => item.status === 'missing').length
    const mismatched = audits.filter((item) => item.status === 'mismatch')
    console.log(`Storage exact: ${exact}`)
    console.log(`Storage missing: ${missing}`)
    console.log(`Storage mismatched: ${mismatched.length}`)
    for (const item of mismatched) console.log(`  - ${item.key}: ${item.detail}`)

    if (local.blocks.length > 0 || mismatched.length > 0) {
      throw new Error('Audit found blockers. No storage uploads were attempted.')
    }
    if (!options.apply) {
      console.log('Dry run complete. No DB rows, local files, or storage objects were changed.')
      return
    }
    const result = await uploadMissing(s3, storage.bucket, audits)
    console.log(`Apply complete: ${result.uploaded} uploaded, ${result.reused} already exact.`)
    console.log('Media rows were not changed.')
  } finally {
    s3.destroy()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
