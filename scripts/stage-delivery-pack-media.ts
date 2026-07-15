import 'dotenv/config'

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import AdmZip from 'adm-zip'
import { Client } from 'pg'
import type { Payload } from 'payload'

import {
  buildDeliveryPackMediaUrn,
  DELIVERY_PACK_MEDIA_SOURCE_PROVIDER,
  selectDeliveryPackSemiNewMedia,
  type DeliveryPackManifest,
  type SelectedDeliveryPackRecord,
} from '../src/services/deliveryPackMedia'
import { readSupabaseS3StorageConfig } from '../src/services/supabaseS3Storage'

// The existing public vehicle-images bucket is currently capped at 10 MB.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

type CliOptions = {
  apply: boolean
  includeLocationConflicts: boolean
  zipPath: string
}

type VehicleRow = {
  brand: string | null
  id: number | string
  model: string | null
  source_id: string
  year: number | null
}

type PreparedFile = {
  entryName: string
  fileName: string
  folderLabel: string
  idv: string
  localPath: string
  mimeType: string
  sha256: string
  size: number
  status: string
  vehicle: VehicleRow
}

type VerificationBlock = {
  idv?: string
  localPath?: string
  reason: string
}

function usage() {
  console.log(`Usage:
  npm run stage:delivery-pack-media -- --zip <delivery-pack.zip>
  npm run stage:delivery-pack-media -- --zip <delivery-pack.zip> --apply

Options:
  --apply                       Create review-only Media and VehicleMediaAsset records.
                                Without this flag the command is read-only.
  --include-location-conflicts  Include matched_location_conflict records. Default: blocked.
  --zip <path>                  Delivery ZIP. Falls back to GBA_DELIVERY_PACK_ZIP.
  --help                        Show this help.`)
}

function parseArgs(argv: string[]): CliOptions {
  let apply = false
  let includeLocationConflicts = false
  let zipPath = process.env.GBA_DELIVERY_PACK_ZIP?.trim() || ''

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--apply') apply = true
    else if (arg === '--include-location-conflicts') includeLocationConflicts = true
    else if (arg === '--dry-run') apply = false
    else if (arg === '--help' || arg === '-h') {
      usage()
      process.exit(0)
    } else if (arg === '--zip') {
      zipPath = argv[index + 1]?.trim() || ''
      index += 1
    } else if (arg.startsWith('--zip=')) {
      zipPath = arg.slice('--zip='.length).trim()
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!zipPath) throw new Error('Provide --zip <path> or set GBA_DELIVERY_PACK_ZIP.')
  return { apply, includeLocationConflicts, zipPath: path.resolve(zipPath) }
}

function sha256(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function imageType(buffer: Buffer, fileName: string) {
  const extension = path.extname(fileName).toLowerCase()
  if (
    (extension === '.jpg' || extension === '.jpeg') &&
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { extension: 'jpg', mimeType: 'image/jpeg' }
  }
  if (
    extension === '.png' &&
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { extension: 'png', mimeType: 'image/png' }
  }
  if (
    extension === '.webp' &&
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { extension: 'webp', mimeType: 'image/webp' }
  }
  return null
}

function readManifest(zip: AdmZip) {
  const manifests = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory && /(^|\/)image_manifest\.json$/i.test(entry.entryName))
  if (manifests.length !== 1) {
    throw new Error(`Expected exactly one image_manifest.json; found ${manifests.length}.`)
  }

  const manifestEntry = manifests[0]
  let manifest: DeliveryPackManifest
  try {
    manifest = JSON.parse(manifestEntry.getData().toString('utf8')) as DeliveryPackManifest
  } catch (error) {
    throw new Error(
      `Could not parse ${manifestEntry.entryName}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!Array.isArray(manifest.archive_records)) {
    throw new Error('image_manifest.json is missing archive_records.')
  }
  return {
    manifest,
    manifestEntryName: manifestEntry.entryName,
    root: path.posix.dirname(manifestEntry.entryName),
  }
}

function verifyArchiveFiles(
  zip: AdmZip,
  root: string,
  records: SelectedDeliveryPackRecord[],
  allowedMimeTypes: Set<string>,
) {
  const blocks: VerificationBlock[] = []
  const preparedWithoutVehicles: Omit<PreparedFile, 'vehicle'>[] = []
  const entriesByName = new Map<string, ReturnType<AdmZip['getEntries']>>()
  for (const entry of zip.getEntries()) {
    const entries = entriesByName.get(entry.entryName) || []
    entries.push(entry)
    entriesByName.set(entry.entryName, entries)
  }

  let manifestHashCount = 0
  for (const record of records) {
    for (const localPath of record.localPaths) {
      const entryName = path.posix.join(root, localPath)
      const entries = entriesByName.get(entryName) || []
      if (entries.length !== 1 || entries[0].isDirectory) {
        blocks.push({
          idv: record.idv,
          localPath,
          reason: entries.length === 0 ? 'file_missing_from_zip' : 'duplicate_zip_entry_name',
        })
        continue
      }

      const entry = entries[0]
      if (entry.header.size <= 0 || entry.header.size > MAX_IMAGE_BYTES) {
        blocks.push({ idv: record.idv, localPath, reason: 'invalid_image_size' })
        continue
      }

      const buffer = entry.getData()
      if (buffer.length !== entry.header.size) {
        blocks.push({ idv: record.idv, localPath, reason: 'zip_size_mismatch' })
        continue
      }
      const detected = imageType(buffer, localPath)
      if (!detected) {
        blocks.push({ idv: record.idv, localPath, reason: 'unsupported_or_invalid_image' })
        continue
      }
      if (!allowedMimeTypes.has(detected.mimeType)) {
        blocks.push({
          idv: record.idv,
          localPath,
          reason: `bucket_mime_not_allowed:${detected.mimeType}`,
        })
        continue
      }

      const digest = sha256(buffer)
      const expected = record.expectedSha256ByPath[localPath]
      if (expected) manifestHashCount += 1
      if (expected && digest !== expected) {
        blocks.push({ idv: record.idv, localPath, reason: 'manifest_sha256_mismatch' })
        continue
      }

      preparedWithoutVehicles.push({
        entryName,
        fileName: `client-delivery-${record.idv}-${digest.slice(0, 16)}.${detected.extension}`,
        folderLabel: record.folderLabel,
        idv: record.idv,
        localPath,
        mimeType: detected.mimeType,
        sha256: digest,
        size: buffer.length,
        status: record.status,
      })
    }
  }

  const firstByHash = new Map<string, Omit<PreparedFile, 'vehicle'>>()
  const uniqueFiles: Omit<PreparedFile, 'vehicle'>[] = []
  for (const file of preparedWithoutVehicles) {
    const first = firstByHash.get(file.sha256)
    if (first) {
      blocks.push({
        idv: file.idv,
        localPath: file.localPath,
        reason: `duplicate_sha256_of:${first.idv}:${first.localPath}`,
      })
      continue
    }
    firstByHash.set(file.sha256, file)
    uniqueFiles.push(file)
  }

  return { blocks, manifestHashCount, uniqueFiles }
}

async function loadDatabaseAuditReadOnly(idvs: string[]) {
  const databaseUri = process.env.DATABASE_URI?.trim()
  if (!databaseUri) throw new Error('DATABASE_URI is required to verify candidate vehicle IDs.')

  const client = new Client({
    application_name: 'gbe-delivery-pack-media-dry-run',
    connectionString: databaseUri,
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
  })
  try {
    await client.connect()
    await client.query('begin transaction read only')
    const result = await client.query<VehicleRow>(
      `
        select id, source_id, brand, model, year
        from vehicles
        where source_id = any($1::text[])
        order by source_id, id
      `,
      [idvs],
    )
    const schema = await client.query<{ media_prefix_column: boolean; migration_applied: boolean }>(
      `
        select
          exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'media' and column_name = 'prefix'
          ) as media_prefix_column,
          exists (
            select 1 from payload_migrations
            where name = '20260715_240000_media_storage_prefix'
          ) as migration_applied
      `,
    )
    await client.query('rollback')
    return {
      mediaPrefixColumn: schema.rows[0]?.media_prefix_column === true,
      migrationApplied: schema.rows[0]?.migration_applied === true,
      vehicles: result.rows,
    }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

function attachVehicles(files: Omit<PreparedFile, 'vehicle'>[], vehicles: VehicleRow[]) {
  const byIdv = new Map<string, VehicleRow[]>()
  for (const vehicle of vehicles) {
    const rows = byIdv.get(vehicle.source_id) || []
    rows.push(vehicle)
    byIdv.set(vehicle.source_id, rows)
  }

  const blocks: VerificationBlock[] = []
  const prepared: PreparedFile[] = []
  const filesByIdv = new Map<string, Omit<PreparedFile, 'vehicle'>[]>()
  for (const file of files) {
    const rows = filesByIdv.get(file.idv) || []
    rows.push(file)
    filesByIdv.set(file.idv, rows)
  }

  for (const [idv, idvFiles] of filesByIdv) {
    const matches = byIdv.get(idv) || []
    if (matches.length !== 1) {
      blocks.push({ idv, reason: matches.length === 0 ? 'vehicle_not_found' : 'duplicate_vehicle_source_id' })
      continue
    }
    for (const file of idvFiles) prepared.push({ ...file, vehicle: matches[0] })
  }
  return { blocks, prepared }
}

async function applyPreparedFiles(zip: AdmZip, files: PreparedFile[], generatedDate: string) {
  const [{ getPayload }, { default: payloadConfig }] = await Promise.all([
    import('payload'),
    import('../src/payload.config'),
  ])
  const payload = await getPayload({ config: payloadConfig })
  let created = 0
  let reused = 0

  try {
    for (const file of files) {
      const sourceUrl = buildDeliveryPackMediaUrn(file.sha256)
      const existing = await payload.find({
        collection: 'vehicle-media-assets',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: {
          and: [
            { vehicle: { equals: file.vehicle.id } },
            { sourceProvider: { equals: DELIVERY_PACK_MEDIA_SOURCE_PROVIDER } },
            { sourceUrl: { equals: sourceUrl } },
          ],
        },
      })
      if (existing.docs.length > 0) {
        reused += 1
        continue
      }

      const entry = zip.getEntry(file.entryName)
      if (!entry || entry.isDirectory) throw new Error(`ZIP entry disappeared: ${file.entryName}`)
      const buffer = entry.getData()
      if (buffer.length !== file.size || sha256(buffer) !== file.sha256) {
        throw new Error(`ZIP content changed after verification: ${file.entryName}`)
      }

      const vehicleLabel = [file.vehicle.year, file.vehicle.brand, file.vehicle.model]
        .filter((value) => value !== null && value !== '')
        .join(' ')
      const alt = vehicleLabel || file.folderLabel
      let media: Awaited<ReturnType<Payload['create']>> | undefined
      try {
        media = await payload.create({
          collection: 'media',
          data: { alt },
          file: {
            data: buffer,
            mimetype: file.mimeType,
            name: file.fileName,
            size: buffer.length,
          },
          overrideAccess: true,
        })

        await payload.create({
          collection: 'vehicle-media-assets',
          data: {
            approvalStatus: 'needs_review',
            make: file.vehicle.brand || undefined,
            matchConfidence: file.status.includes('location_conflict') ? 'unknown' : 'exact_vehicle',
            media: media.id,
            model: file.vehicle.model || undefined,
            notes: `Client delivery pack ${generatedDate}; manifest status ${file.status}; ${file.localPath}; sha256 ${file.sha256}`,
            rightsStatus: 'unknown',
            sourceProvider: DELIVERY_PACK_MEDIA_SOURCE_PROVIDER,
            sourceType: 'dealer_photo',
            sourceUrl,
            title: `${file.folderLabel} - ${path.posix.basename(file.localPath)}`,
            vehicle: file.vehicle.id,
            year: file.vehicle.year || undefined,
          } as never,
          overrideAccess: true,
        })
        created += 1
      } catch (error) {
        if (media?.id !== undefined) {
          await payload
            .delete({ collection: 'media', id: media.id, overrideAccess: true })
            .catch((cleanupError) => {
              console.error(
                `WARNING: could not clean up Media ${String(media?.id)}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
              )
            })
        }
        throw error
      }
    }
  } finally {
    await payload.destroy()
  }
  return { created, reused }
}

function printBlocks(label: string, blocks: VerificationBlock[]) {
  console.log(`${label}: ${blocks.length}`)
  for (const item of blocks.slice(0, 30)) {
    console.log(
      `  - ${item.idv ? `IDV ${item.idv}` : 'manifest'}${item.localPath ? ` ${item.localPath}` : ''}: ${item.reason}`,
    )
  }
  if (blocks.length > 30) console.log(`  ... ${blocks.length - 30} more`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!fs.existsSync(options.zipPath) || !fs.statSync(options.zipPath).isFile()) {
    throw new Error(`ZIP not found: ${options.zipPath}`)
  }

  const storage = readSupabaseS3StorageConfig(process.env)
  if (options.apply && !storage.configured) {
    const detail = [...storage.missing, ...storage.errors].join('; ')
    throw new Error(`--apply requires valid server-side Supabase S3 configuration: ${detail}`)
  }

  console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY RUN (read-only; no DB/storage writes)'}`)
  console.log(`ZIP: ${options.zipPath}`)
  console.log(`Location conflicts: ${options.includeLocationConflicts ? 'included by explicit flag' : 'blocked'}`)

  const zip = new AdmZip(options.zipPath)
  const { manifest, manifestEntryName, root } = readManifest(zip)
  const selection = selectDeliveryPackSemiNewMedia(manifest, {
    includeLocationConflicts: options.includeLocationConflicts,
  })
  const allowedMimeTypes = new Set(
    (process.env.SUPABASE_S3_ALLOWED_MIME_TYPES?.trim() ||
      'image/jpeg,image/png,image/webp,image/avif')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
  const fileVerification = verifyArchiveFiles(zip, root, selection.selected, allowedMimeTypes)
  const idvs = [...new Set(selection.selected.map((record) => record.idv))]
  const databaseAudit = await loadDatabaseAuditReadOnly(idvs)
  const vehicleVerification = attachVehicles(fileVerification.uniqueFiles, databaseAudit.vehicles)
  const verificationBlocks = [...fileVerification.blocks, ...vehicleVerification.blocks]

  console.log(`Manifest: ${manifestEntryName}`)
  console.log(`Manifest records selected: ${selection.selected.length}`)
  console.log(`Manifest records policy-blocked: ${selection.blocked.length}`)
  for (const item of selection.blocked) {
    console.log(`  - ${item.folderLabel}: ${item.reason} (${item.status})`)
  }
  console.log(`Candidate vehicle IDs verified: ${new Set(vehicleVerification.prepared.map((file) => file.idv)).size}/${idvs.length}`)
  console.log(`Images SHA-256 hashed: ${fileVerification.uniqueFiles.length}`)
  console.log(`Manifest image hashes compared: ${fileVerification.manifestHashCount}`)
  console.log(`Bucket MIME allow-list: ${[...allowedMimeTypes].join(', ')}`)
  console.log(`Clean images: ${vehicleVerification.prepared.length}`)
  console.log(
    `Largest clean image: ${Math.max(0, ...vehicleVerification.prepared.map((file) => file.size))} bytes (10 MB bucket limit)`,
  )
  printBlocks('Verification-blocked images/vehicles', verificationBlocks)

  if (verificationBlocks.length > 0) {
    throw new Error('Verification failed. Resolve verification blocks before staging media.')
  }
  console.log(
    `Media prefix migration: ${databaseAudit.mediaPrefixColumn && databaseAudit.migrationApplied ? 'ready' : 'not applied (required only for --apply)'}`,
  )

  if (!options.apply) {
    console.log('Dry run complete. No records, vehicle fields, or storage objects were changed.')
    return
  }
  if (!databaseAudit.mediaPrefixColumn || !databaseAudit.migrationApplied) {
    throw new Error('Apply requires migration 20260715_240000_media_storage_prefix to be applied first.')
  }

  const generatedDate = typeof manifest.generated_date === 'string' ? manifest.generated_date : 'unknown-date'
  const result = await applyPreparedFiles(zip, vehicleVerification.prepared, generatedDate)
  console.log(`Apply complete: ${result.created} created, ${result.reused} already staged.`)
  console.log('All staged assets remain needs_review with unknown rights and no usage assignment.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
