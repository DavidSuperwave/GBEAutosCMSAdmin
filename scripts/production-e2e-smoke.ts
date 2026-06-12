import 'dotenv/config'

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

import {
  calculateVehicleCompleteness,
  canPublish,
  deriveImageStatus,
  deriveSpecStatus,
  getVehiclePublishIssues,
} from '../src/services/vehicleWorkflow'
import {
  normalizeImportRow,
  normalizeImportedBrand,
  normalizeImportedColor,
  normalizeImportedCondition,
  normalizeImportedMileage,
  normalizeImportedYear,
  suggestFieldForHeader,
  WORKBOOK_COLUMN_MAP,
} from '../src/services/importNormalize'

type Severity = 'pass' | 'warn' | 'fail' | 'skip'

type Check = {
  name: string
  severity: Severity
  detail?: string
}

type QueryRow = Record<string, unknown>

const checks: Check[] = []
const dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(dirname, '..')

function record(severity: Severity, name: string, detail?: string) {
  checks.push({ severity, name, detail })
}

function section(name: string) {
  console.log(`\n== ${name} ==`)
}

function pass(name: string, detail?: string) {
  record('pass', name, detail)
}

function warn(name: string, detail?: string) {
  record('warn', name, detail)
}

function fail(name: string, detail?: string) {
  record('fail', name, detail)
}

function skip(name: string, detail?: string) {
  record('skip', name, detail)
}

function env(name: string) {
  return process.env[name]?.trim()
}

function maskUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.username || url.password) {
      url.username = '***'
      url.password = '***'
    }
    return url.toString()
  } catch {
    return value.replace(/\/\/.*@/, '//***@')
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function migrationNamesFromIndex() {
  const indexPath = path.join(workspaceRoot, 'src', 'migrations', 'index.ts')
  const source = fs.readFileSync(indexPath, 'utf8')
  return Array.from(source.matchAll(/name:\s*['"]([^'"]+)['"]/g), (match) => match[1])
}

async function withDatabase<T>(fn: (client: Client) => Promise<T>) {
  const databaseUri = env('DATABASE_URI')
  if (!databaseUri) {
    fail('DATABASE_URI is configured', 'Missing DATABASE_URI.')
    return undefined
  }

  const client = new Client({
    connectionString: databaseUri,
    connectionTimeoutMillis: 10_000,
    query_timeout: 20_000,
  })
  try {
    await client.connect()
    pass('Database connection opens', maskUrl(databaseUri))
    return await fn(client)
  } catch (error) {
    fail('Database connection opens', error instanceof Error ? error.message : String(error))
    return undefined
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function query(client: Client, sql: string, params: unknown[] = []) {
  const result = await client.query<QueryRow>(sql, params)
  return result.rows
}

async function checkEnvironment() {
  section('Environment')
  const required = ['DATABASE_URI', 'PAYLOAD_SECRET', 'NEXT_PUBLIC_SERVER_URL', 'NEXT_PUBLIC_FRONTEND_URL']
  for (const key of required) {
    if (env(key)) pass(`Env ${key}`, 'Set.')
    else fail(`Env ${key}`, 'Required for production.')
  }

  const smtp = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL']
  const missingSmtp = smtp.filter((key) => !env(key))
  if (missingSmtp.length === 0) {
    pass('SMTP invite/reset configuration', 'All required SMTP variables are set.')
  } else {
    warn('SMTP invite/reset configuration', `Missing: ${missingSmtp.join(', ')}`)
  }

  if (env('AI_IMAGE_API_KEY')) pass('AI image generation key', 'Set.')
  else warn('AI image generation key', 'Missing; workshop should return configured=false.')

  if (env('RAPIDAPI_KEY')) pass('Vehicle specs provider key', 'Set.')
  else warn('Vehicle specs provider key', 'Missing; specs lookup should fail gracefully.')

  if (env('CARSXE_API_KEY')) pass('Vehicle photo provider key', 'Set.')
  else warn('Vehicle photo provider key', 'Missing; photo lookup should fail gracefully.')
}

async function checkMigrationsAndSchema() {
  section('Migrations and schema')
  await withDatabase(async (client) => {
    const migrationRows = await query(client, 'select name from payload_migrations order by name')
    const applied = new Set(migrationRows.map((row) => stringValue(row.name)))
    const expected = migrationNamesFromIndex()
    const missing = expected.filter((name) => !applied.has(name))

    if (missing.length === 0) {
      pass('All registered Payload migrations are applied', `${expected.length} migrations recorded.`)
    } else {
      fail('All registered Payload migrations are applied', `Missing: ${missing.join(', ')}`)
    }

    const columns = await query(
      client,
      `
        select table_name, column_name, data_type
        from information_schema.columns
        where table_schema = 'public'
          and table_name in ('site_config_navigation_footer_links', 'site_config_navigation_legal_links')
          and column_name = 'id'
        order by table_name
      `,
    )

    const badColumns = columns.filter((row) => row.data_type !== 'character varying')
    if (columns.length === 2 && badColumns.length === 0) {
      pass('SiteConfig footer/legal link IDs are varchar', 'Both navigation link array tables match Payload schema.')
    } else {
      fail(
        'SiteConfig footer/legal link IDs are varchar',
        columns.length === 0
          ? 'Navigation link tables were not found.'
          : `Unexpected column types: ${columns
              .map((row) => `${String(row.table_name)}.${String(row.column_name)}=${String(row.data_type)}`)
              .join(', ')}`,
      )
    }
  })
}

async function checkPayloadData() {
  section('Payload data and public catalog')
  await withDatabase(async (client) => {
    const count = async (table: string, where = '') => {
      const rows = await query(client, `select count(*)::int as count from ${table} ${where}`)
      return Number(rows[0]?.count ?? 0)
    }

    const users = await count('users')
    if (users > 0) pass('Admin users exist', `${users} user record(s) found.`)
    else fail('Admin users exist', 'Create the first admin user before production cutover.')

    const dealerships = await count('dealerships')
    if (dealerships > 0) pass('Dealership seed data exists', `${dealerships} dealership(s) found.`)
    else fail('Dealership seed data exists', 'Seed or migrate dealership records before launch.')

    const siteConfig = await count('site_config')
    if (siteConfig > 0) pass('SiteConfig global loads', `${siteConfig} row(s) found.`)
    else fail('SiteConfig global loads', 'Site configuration is missing.')

    const publicVehicles = await count('vehicles', "where publish_status = 'published' and inventory_status <> 'sold'")
    if (publicVehicles > 0) pass('Published public vehicles exist', `${publicVehicles} public vehicle(s) found.`)
    else warn('Published public vehicles exist', 'No public vehicles are available to smoke-test detail shape.')

    const invalidPublicRows = await query(
      client,
      `
        select count(*)::int as count
        from vehicles
        where publish_status = 'published'
          and inventory_status <> 'sold'
          and (slug is null or slug = '' or brand is null or brand = '' or model is null or model = '')
      `,
    )
    if (Number(invalidPublicRows[0]?.count ?? 0) === 0) {
      pass('Published vehicle rows have required public card fields')
    } else {
      fail('Published vehicle rows have required public card fields', `${String(invalidPublicRows[0]?.count)} invalid row(s).`)
    }

    const negativeFixtures = await count(
      'vehicles',
      "where publish_status <> 'published' or inventory_status = 'sold'",
    )
    if (negativeFixtures > 0) {
      pass('Negative vehicle visibility fixtures exist', `${negativeFixtures} sold/draft/non-public vehicle(s).`)
    } else {
      warn('Negative vehicle visibility fixtures exist', 'Add a sold/draft fixture before final browser QA.')
    }

    const visibleCollections = await count('vehicle_collections', 'where is_visible = true')
    const hiddenCollections = await count('vehicle_collections', 'where is_visible = false')
    if (visibleCollections > 0) pass('Visible public collections exist', `${visibleCollections} visible collection(s).`)
    else warn('Visible public collections exist', 'No visible collections found.')

    if (hiddenCollections > 0) pass('Hidden collection fixtures exist', `${hiddenCollections} hidden collection(s).`)
    else warn('Hidden collection fixtures exist', 'Add one hidden collection to verify public exclusion manually.')

    const manualCollections = await count('vehicle_collections', "where collection_type = 'manual'")
    const smartCollections = await count('vehicle_collections', "where collection_type = 'smart'")
    if (manualCollections > 0) pass('Manual collection fixtures exist', `${manualCollections} manual collection(s).`)
    else warn('Manual collection fixtures exist', 'Add a manual collection before final browser QA.')
    if (smartCollections > 0) pass('Smart collection fixtures exist', `${smartCollections} smart collection(s).`)
    else warn('Smart collection fixtures exist', 'Add a smart collection before final browser QA.')

    const pages = await count('pages')
    if (pages > 0) pass('CMS pages exist', `${pages} page(s) found.`)
    else warn('CMS pages exist', 'No dynamic CMS pages found.')

    const leads = await count('leads')
    if (leads > 0) pass('Lead records exist', `${leads} lead(s) found.`)
    else warn('Lead records exist', 'Submit one safe production test lead during cutover.')

    const events = await count('analytics_events')
    if (events > 0) pass('Analytics event records exist', `${events} event(s) found.`)
    else warn('Analytics event records exist', 'Run public-site smoke actions to create analytics events.')
  })
}

function checkBusinessRules() {
  section('Business rules')
  const completeVehicle = {
    brand: 'Mazda',
    model: 'CX-5',
    year: 2025,
    condition: 'used',
    dealership: 1,
    inventoryStatus: 'available',
    slug: 'mazda-cx-5-test',
    price: '499000',
    mileage: 12000,
    image: 1,
    imageStatus: 'approved',
    gallery: [{ image: 1 }],
    description: 'Mazda CX-5 seminueva en excelente estado y lista para entrega inmediata.',
    features: [{ feature: 'Garantia' }],
    specs: { motor: '2.5L', transmision: 'Automatica', combustible: 'Gasolina', traccion: 'FWD' },
    sourceMeta: { specSource: 'manual' },
  }

  if (canPublish(completeVehicle)) pass('Vehicle publish validation allows complete vehicles')
  else fail('Vehicle publish validation allows complete vehicles', getVehiclePublishIssues(completeVehicle).critical.join(', '))

  const incompleteVehicle = { brand: 'Mazda', publishStatus: 'draft' }
  const issues = getVehiclePublishIssues(incompleteVehicle)
  if (!canPublish(incompleteVehicle) && issues.critical.length > 0) {
    pass('Vehicle publish validation blocks incomplete vehicles', `${issues.critical.length} critical issue(s).`)
  } else {
    fail('Vehicle publish validation blocks incomplete vehicles')
  }

  if (calculateVehicleCompleteness(completeVehicle) > calculateVehicleCompleteness(incompleteVehicle)) {
    pass('Vehicle completeness scoring ranks complete records higher')
  } else {
    fail('Vehicle completeness scoring ranks complete records higher')
  }

  if (deriveImageStatus({ image: 1 }) === 'uploaded' && deriveImageStatus({ imageStatus: 'approved' }) === 'approved') {
    pass('Vehicle image status derivation preserves explicit approvals')
  } else {
    fail('Vehicle image status derivation preserves explicit approvals')
  }

  if (deriveSpecStatus(completeVehicle) === 'manual' || deriveSpecStatus(completeVehicle) === 'partial') {
    pass('Vehicle spec status derivation handles manual specs')
  } else {
    fail('Vehicle spec status derivation handles manual specs')
  }

  const normalized = normalizeImportRow(
    {
      TIPO: 'Seminuevo',
      IDV: 'QA-1',
      DES_MARCA: 'vw',
      DES_MODELO: 'Jetta',
      DES_COLOR: 'blanco perla',
      KM: '12,345 km',
      ANIO_VEHI: '2024',
      DES_TIPO_MOTOR: 'Gasolina',
      DES_SEGMENTO: 'Sedan',
    },
    WORKBOOK_COLUMN_MAP,
  )

  if (
    normalized.draft.condition === 'used' &&
    normalized.draft.brand === 'Volkswagen' &&
    normalized.draft.year === 2024 &&
    normalized.draft.mileage === 12345 &&
    normalized.draft.exteriorColor === 'Blanco' &&
    normalized.draft.fuel === 'gasoline' &&
    normalized.draft.bodyType === 'sedan'
  ) {
    pass('Import normalization maps dealership workbook fields')
  } else {
    fail('Import normalization maps dealership workbook fields', JSON.stringify(normalized.draft))
  }

  const missing = normalizeImportRow({ DES_MARCA: 'Mazda' }, WORKBOOK_COLUMN_MAP)
  if (missing.issues.some((issue) => issue.field === 'model' && issue.severity === 'error')) {
    pass('Import normalization reports missing required fields')
  } else {
    fail('Import normalization reports missing required fields')
  }

  const directChecks = [
    normalizeImportedCondition('0km') === 'new',
    normalizeImportedYear('2025') === 2025,
    normalizeImportedMileage('25,100') === 25100,
    normalizeImportedBrand('chevy') === 'Chevrolet',
    normalizeImportedColor('negro') === 'Negro',
    suggestFieldForHeader('DES_MARCA') === 'brand',
  ]
  if (directChecks.every(Boolean)) pass('Import helper edge cases normalize correctly')
  else fail('Import helper edge cases normalize correctly')
}

async function checkHttpContracts() {
  section('Optional HTTP contracts')
  const baseUrl = env('E2E_BASE_URL')
  if (!baseUrl) {
    skip('HTTP public API smoke', 'Set E2E_BASE_URL to check deployed/local HTTP endpoints.')
    return
  }

  const cleanBase = baseUrl.replace(/\/+$/, '')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const vehicles = await fetch(`${cleanBase}/api/public/vehicles?limit=101`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (vehicles.ok) {
      const data = (await vehicles.json()) as { limit?: unknown; docs?: unknown }
      if (numberValue(data.limit) === 100 && Array.isArray(data.docs)) {
        pass('HTTP public vehicles endpoint responds', `${cleanBase}/api/public/vehicles`)
      } else {
        fail('HTTP public vehicles endpoint responds', 'Unexpected response shape.')
      }
    } else {
      fail('HTTP public vehicles endpoint responds', `${vehicles.status} ${vehicles.statusText}`)
    }

    const collections = await fetch(`${cleanBase}/api/public/collections?limit=10`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (collections.ok) pass('HTTP public collections endpoint responds', `${cleanBase}/api/public/collections`)
    else fail('HTTP public collections endpoint responds', `${collections.status} ${collections.statusText}`)
  } catch (error) {
    fail('HTTP public API smoke', error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timeout)
  }
}

function printSummary() {
  const icon: Record<Severity, string> = {
    pass: 'PASS',
    warn: 'WARN',
    fail: 'FAIL',
    skip: 'SKIP',
  }

  for (const check of checks) {
    const detail = check.detail ? ` - ${check.detail}` : ''
    console.log(`${icon[check.severity]} ${check.name}${detail}`)
  }

  const totals = checks.reduce(
    (acc, check) => {
      acc[check.severity] += 1
      return acc
    },
    { pass: 0, warn: 0, fail: 0, skip: 0 } satisfies Record<Severity, number>,
  )

  console.log('')
  console.log(
    `Summary: ${totals.pass} passed, ${totals.warn} warnings, ${totals.skip} skipped, ${totals.fail} failed.`,
  )

  if (totals.fail > 0) process.exitCode = 1
}

async function main() {
  await checkEnvironment()
  await checkMigrationsAndSchema()
  await checkPayloadData()
  checkBusinessRules()
  await checkHttpContracts()
  printSummary()
}

main().catch((error) => {
  fail('Production E2E smoke runner crashed', error instanceof Error ? error.stack || error.message : String(error))
  printSummary()
  process.exitCode = 1
})
