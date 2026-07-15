import 'dotenv/config'

import AdmZip from 'adm-zip'
import { parse } from 'csv-parse/sync'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

import { resolveVehicleImageSyncMode } from './vehicle-image-sync-mode.mjs'

const flags = new Set(process.argv.slice(2))
const { apply, dryRun } = resolveVehicleImageSyncMode([...flags], {
  environmentDryRun: envBool('DRY_RUN', false),
})
const verifyOnly = flags.has('--verify-only')
const uploadOnly = flags.has('--upload-only')
const dbOnly = flags.has('--db-only')

const modeCount = [verifyOnly, uploadOnly, dbOnly].filter(Boolean).length
if (modeCount > 1) {
  throw new Error('Use only one of --verify-only, --upload-only, or --db-only at a time.')
}

const config = {
  supabaseUrl: requireEnv('SUPABASE_URL', !verifyOnly && !dryRun),
  supabaseServiceKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY', !verifyOnly && !dryRun),
  bucket: envString('SUPABASE_BUCKET', 'vehicle-images'),
  prefix: cleanPrefix(envString('SUPABASE_STORAGE_PREFIX', 'vehicle_images')),
  storageUpsert: envBool('STORAGE_UPSERT', true),
  zipPath: envString('ZIP_PATH', './vehicle_images_full.zip'),
  csvPath: envString('CSV_PATH', './inventory_with_images.csv'),
  inventoryTable: envString('INVENTORY_TABLE', 'vehicles'),
  inventoryIdColumn: envString('INVENTORY_ID_COLUMN', 'source_id'),
  csvIdColumn: envString('CSV_ID_COLUMN', 'IDV'),
  csvImageFilenameColumn: envString('CSV_IMAGE_FILENAME_COLUMN', 'image_filename'),
  csvImagePathColumn: envString('CSV_IMAGE_PATH_COLUMN', 'image_path'),
  inventoryImageUrlColumn: envString('INVENTORY_IMAGE_URL_COLUMN', 'image_url'),
  inventoryImagePathColumn: envString('INVENTORY_IMAGE_PATH_COLUMN', 'image_path'),
  inventoryImageFilenameColumn: envString('INVENTORY_IMAGE_FILENAME_COLUMN', 'image_filename'),
  inventoryImageStatusColumn: envString('INVENTORY_IMAGE_STATUS_COLUMN', 'image_status'),
  inventoryImageStatusValue: envString('INVENTORY_IMAGE_STATUS_VALUE', 'uploaded'),
  allowDirectDbUpdate: envBool('ALLOW_DIRECT_VEHICLE_IMAGE_DB_UPDATE', false),
  publicUrlBase: envString('PUBLIC_URL_BASE', ''),
  uploadConcurrency: envInt('UPLOAD_BATCH_CONCURRENCY', 4),
  updateConcurrency: envInt('UPDATE_BATCH_CONCURRENCY', 8),
}

main().catch((error) => {
  console.error('\nFatal error:', error?.stack || error?.message || error)
  process.exit(1)
})

async function main() {
  console.log('Vehicle image sync starting')
  console.log({
    apply,
    dryRun,
    verifyOnly,
    uploadOnly,
    dbOnly,
    bucket: config.bucket,
    prefix: config.prefix,
    zipPath: config.zipPath,
    csvPath: config.csvPath,
    inventoryTable: config.inventoryTable,
    inventoryIdColumn: config.inventoryIdColumn,
  })

  const zipImages = readZipIndex(config.zipPath)
  const csvExists = fs.existsSync(config.csvPath)
  if (!csvExists && !uploadOnly) {
    throw new Error(`CSV mapping file not found: ${config.csvPath}. Set CSV_PATH to inventory_with_images.csv.`)
  }

  const mappingRows = csvExists ? readMappingCsv(config.csvPath) : []
  if (!csvExists && uploadOnly) {
    console.warn(`CSV mapping file not found at ${config.csvPath}; continuing because --upload-only was requested.`)
  }

  const validation = validateMapping(mappingRows, zipImages)
  printValidation(validation)
  assertValidation(validation)

  if (verifyOnly) {
    console.log('Verify-only mode complete. No upload or DB update was performed.')
    return
  }

  const supabase = dryRun
    ? null
    : createClient(config.supabaseUrl, config.supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

  if (!dbOnly) {
    await ensureBucket(supabase)
    await uploadImages(supabase, zipImages)
  }

  if (!uploadOnly) {
    await updateInventoryRows(supabase, validation.updatableRows)
  }

  console.log('Vehicle image sync complete.')
}

function readZipIndex(zipPath) {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Zip file not found: ${zipPath}`)
  }

  const zip = new AdmZip(zipPath)
  const images = new Map()
  const duplicateFilenames = []

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue

    const filename = path.basename(entry.entryName)
    if (!/\.jpe?g$/i.test(filename)) continue

    if (images.has(filename)) duplicateFilenames.push(filename)
    images.set(filename, entry)
  }

  if (duplicateFilenames.length > 0) {
    throw new Error(`Duplicate JPG filenames in zip: ${duplicateFilenames.slice(0, 20).join(', ')}`)
  }

  if (images.size === 0) {
    throw new Error(`No JPG files found in zip: ${zipPath}`)
  }

  return images
}

function readMappingCsv(csvPath) {
  const csvText = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')
  const firstLine = csvText.split(/\r?\n/, 1)[0] || ''
  const delimiter = detectDelimiter(firstLine)

  const records = parse(csvText, {
    columns: true,
    delimiter,
    skip_empty_lines: true,
    trim: true,
  })

  const headers = records.length > 0 ? Object.keys(records[0]) : parseHeaders(firstLine, delimiter)
  const columnMap = {
    idv: findHeader(headers, config.csvIdColumn, ['IDV', 'idv', 'source_id', 'sourceId']),
    imageFilename: findHeader(headers, config.csvImageFilenameColumn, [
      'image_filename',
      'imageFileName',
      'filename',
    ]),
    imagePath: findHeader(headers, config.csvImagePathColumn, ['image_path', 'imagePath', 'path', 'storage_path']),
  }

  const missingColumns = Object.entries(columnMap)
    .filter(([, header]) => !header)
    .map(([name]) => name)

  if (missingColumns.length > 0) {
    throw new Error(
      `CSV is missing required column(s): ${missingColumns.join(', ')}. Headers found: ${headers.join(', ')}`,
    )
  }

  return records.map((row, index) => {
    const rowNumber = index + 2
    const idv = String(row[columnMap.idv] || '').trim()
    const imageFilename = String(row[columnMap.imageFilename] || '').trim()
    const imagePath = normalizeStoragePath(row[columnMap.imagePath] || imageFilename)
    const skipReason = junkRowReason({ idv, imageFilename, imagePath })

    return {
      rowNumber,
      idv,
      imageFilename,
      imagePath,
      skipReason,
    }
  })
}

function validateMapping(mappingRows, zipImages) {
  const missingIdRows = []
  const missingFilenameRows = []
  const missingImageFiles = []
  const skippedRows = []
  const updatableRows = []
  const uniqueIdv = new Set()
  const uniqueMappedFiles = new Set()

  for (const row of mappingRows) {
    if (row.skipReason) {
      skippedRows.push(row)
      continue
    }

    if (!row.idv) missingIdRows.push(row)
    if (!row.imageFilename) missingFilenameRows.push(row)
    if (row.idv) uniqueIdv.add(row.idv)
    if (row.imageFilename) uniqueMappedFiles.add(row.imageFilename)

    if (row.imageFilename && !zipImages.has(row.imageFilename)) {
      missingImageFiles.push(row)
      continue
    }

    if (row.idv && row.imageFilename) updatableRows.push(row)
  }

  const unusedZipFiles = [...zipImages.keys()].filter((filename) => !uniqueMappedFiles.has(filename))

  return {
    mappingRows: mappingRows.length,
    uniqueIdv: uniqueIdv.size,
    zipImageCount: zipImages.size,
    uniqueMappedFiles: uniqueMappedFiles.size,
    missingIdRows,
    missingFilenameRows,
    missingImageFiles,
    skippedRows,
    unusedZipFiles,
    updatableRows,
  }
}

function printValidation(validation) {
  console.log('Validation summary:', {
    csvRows: validation.mappingRows,
    zipImages: validation.zipImageCount,
    uniqueIdv: validation.uniqueIdv,
    uniqueMappedFiles: validation.uniqueMappedFiles,
    updatableRows: validation.updatableRows.length,
    skippedRows: validation.skippedRows.length,
    missingIds: validation.missingIdRows.length,
    missingFilenames: validation.missingFilenameRows.length,
    missingImageFiles: validation.missingImageFiles.length,
    unusedZipFiles: validation.unusedZipFiles.length,
  })

  printRows('Skipped rows, first 20:', validation.skippedRows, ({ rowNumber, idv, imageFilename, skipReason }) => {
    return `CSV row ${rowNumber}: IDV=${idv || '(blank)'} filename=${imageFilename || '(blank)'} reason=${skipReason}`
  })
  printRows('Rows missing IDV, first 20:', validation.missingIdRows, ({ rowNumber, imageFilename }) => {
    return `CSV row ${rowNumber}: filename=${imageFilename || '(blank)'}`
  })
  printRows('Rows missing image_filename, first 20:', validation.missingFilenameRows, ({ rowNumber, idv }) => {
    return `CSV row ${rowNumber}: IDV=${idv || '(blank)'}`
  })
  printRows('Missing image files referenced by CSV, first 20:', validation.missingImageFiles, (row) => {
    return `CSV row ${row.rowNumber}: IDV=${row.idv} filename=${row.imageFilename}`
  })
  printRows('Zip files not referenced by CSV, first 20:', validation.unusedZipFiles, (filename) => filename)
}

function assertValidation(validation) {
  const errors = []

  if (validation.missingIdRows.length > 0) errors.push(`${validation.missingIdRows.length} CSV rows are missing IDV`)
  if (validation.missingFilenameRows.length > 0) {
    errors.push(`${validation.missingFilenameRows.length} CSV rows are missing image_filename`)
  }
  if (validation.missingImageFiles.length > 0) {
    errors.push(`${validation.missingImageFiles.length} CSV image_filename values are missing from the zip`)
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`)
  }
}

async function ensureBucket(supabase) {
  if (dryRun) {
    console.log(`[dry-run] Would verify storage bucket exists: ${config.bucket}`)
    return
  }

  const { data, error } = await supabase.storage.getBucket(config.bucket)
  if (error) throw new Error(`Storage bucket check failed for ${config.bucket}: ${error.message}`)
  if (!data) throw new Error(`Storage bucket not found: ${config.bucket}`)

  console.log(`Storage bucket exists: ${config.bucket}`)
}

async function uploadImages(supabase, zipImages) {
  const entries = [...zipImages.entries()]
  let uploaded = 0
  let failed = 0

  await mapWithConcurrency(entries, config.uploadConcurrency, async ([filename, entry]) => {
    const storagePath = storagePathFor(filename)

    if (dryRun) {
      console.log(`[dry-run] upload ${filename} -> ${config.bucket}/${storagePath}`)
      uploaded += 1
      return
    }

    const { error } = await supabase.storage.from(config.bucket).upload(storagePath, entry.getData(), {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: config.storageUpsert,
    })

    if (error) {
      failed += 1
      console.error(`Upload failed for ${filename}: ${error.message}`)
      return
    }

    uploaded += 1
    if (uploaded % 25 === 0 || uploaded === entries.length) {
      console.log(`Uploaded ${uploaded}/${entries.length}`)
    }
  })

  console.log(`Upload summary: uploaded=${uploaded}, failed=${failed}`)
  if (failed > 0) throw new Error(`${failed} uploads failed`)
}

async function updateInventoryRows(supabase, rowsToUpdate) {
  if (!config.allowDirectDbUpdate && !dryRun) {
    console.warn(
      'Skipping direct vehicle table image updates. Import uploaded images through Payload Media, or set ALLOW_DIRECT_VEHICLE_IMAGE_DB_UPDATE=true for a one-off legacy backfill.',
    )
    return { updated: 0, unmatched: rowsToUpdate.length, failed: 0 }
  }

  let updated = 0
  let unmatched = 0
  let failed = 0

  await mapWithConcurrency(rowsToUpdate, config.updateConcurrency, async (row) => {
    const storagePath = row.imagePath || storagePathFor(row.imageFilename)
    const publicUrl = publicUrlFor(supabase, storagePath)
    const payload = {
      [config.inventoryImageUrlColumn]: publicUrl,
    }

    if (config.inventoryImagePathColumn) payload[config.inventoryImagePathColumn] = storagePath
    if (config.inventoryImageFilenameColumn) payload[config.inventoryImageFilenameColumn] = row.imageFilename
    if (config.inventoryImageStatusColumn) payload[config.inventoryImageStatusColumn] = config.inventoryImageStatusValue

    if (dryRun) {
      console.log(`[dry-run] update ${config.inventoryTable}.${config.inventoryIdColumn}=${row.idv}`, payload)
      updated += 1
      return
    }

    const { count, error } = await supabase
      .from(config.inventoryTable)
      .update(payload, { count: 'exact' })
      .eq(config.inventoryIdColumn, row.idv)

    if (error) {
      failed += 1
      console.error(`DB update failed for CSV row ${row.rowNumber}, IDV=${row.idv}: ${error.message}`)
      return
    }

    if (!count) {
      unmatched += 1
      console.warn(`No DB row matched CSV row ${row.rowNumber}, ${config.inventoryIdColumn}=${row.idv}`)
      return
    }

    updated += count
    if (updated % 100 === 0 || updated >= rowsToUpdate.length) {
      console.log(`Updated ${updated}/${rowsToUpdate.length}`)
    }
  })

  console.log(`DB update summary: updated=${updated}, unmatched=${unmatched}, failed=${failed}`)
  if (failed > 0) throw new Error(`${failed} DB updates failed`)
}

function publicUrlFor(supabase, storagePath) {
  if (config.publicUrlBase) {
    return `${config.publicUrlBase.replace(/\/+$/, '')}/${storagePath.replace(/^\/+/, '')}`
  }

  if (dryRun) {
    const projectUrl = config.supabaseUrl || 'https://YOUR_PROJECT_REF.supabase.co'
    return `${projectUrl}/storage/v1/object/public/${config.bucket}/${storagePath}`
  }

  const { data } = supabase.storage.from(config.bucket).getPublicUrl(storagePath)
  return data.publicUrl
}

function storagePathFor(filename) {
  return normalizeStoragePath(filename)
}

function normalizeStoragePath(input) {
  let value = String(input || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!value) return value

  if (value.startsWith(`${config.bucket}/`)) value = value.slice(config.bucket.length + 1)

  const filename = path.basename(value)
  if (!value.includes('/') && config.prefix) return `${config.prefix}/${filename}`
  return value
}

function junkRowReason(row) {
  const joined = [row.idv, row.imageFilename, row.imagePath].join(' ')
  return /MAZDA_NO_USAR_2026/i.test(joined) ? 'MAZDA_NO_USAR_2026' : ''
}

function findHeader(headers, preferred, fallbacks) {
  const candidates = [preferred, ...fallbacks].filter(Boolean)

  for (const candidate of candidates) {
    const exact = headers.find((header) => header === candidate)
    if (exact) return exact

    const lower = headers.find((header) => header.toLowerCase() === candidate.toLowerCase())
    if (lower) return lower
  }

  return ''
}

function parseHeaders(firstLine, delimiter) {
  return firstLine.split(delimiter).map((header) => header.trim().replace(/^"|"$/g, ''))
}

function detectDelimiter(firstLine) {
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  return semicolonCount > commaCount ? ';' : ','
}

function printRows(title, rows, format) {
  if (rows.length === 0) return

  console.warn(title)
  for (const row of rows.slice(0, 20)) console.warn(`  ${format(row)}`)
}

async function mapWithConcurrency(items, concurrency, worker) {
  const queue = [...items]
  const workerCount = Math.max(1, Math.min(concurrency, queue.length || 1))
  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      await worker(item)
    }
  })

  await Promise.all(workers)
}

function cleanPrefix(prefix) {
  return String(prefix || '').trim().replace(/^\/+|\/+$/g, '')
}

function envString(name, defaultValue) {
  const value = process.env[name]
  return value == null || value === '' ? defaultValue : value
}

function requireEnv(name, required) {
  const value = process.env[name]
  if (required && !value) throw new Error(`Missing required environment variable: ${name}`)
  return value || ''
}

function envBool(name, defaultValue) {
  const value = process.env[name]
  if (value == null || value === '') return defaultValue
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).toLowerCase())
}

function envInt(name, defaultValue) {
  const value = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(value) && value > 0 ? value : defaultValue
}
