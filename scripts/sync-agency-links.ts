import 'dotenv/config'

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { Client } from 'pg'
import XLSX from 'xlsx'

import { selectAgencyMapLink } from '../src/services/agencyLinkPolicy'
import { normalizeDealershipKey } from '../src/services/dealershipMatching'

type Arguments = {
  apply: boolean
  workbookPath: string
}

type AgencyLinkRow = {
  brandNames: string
  agency: string
  city: string
  websiteUrl: string
  mapUrl: string
  inventoryNameMapping: string
  verification: string
}

type DesiredAgency = AgencyLinkRow & {
  brandName: string
  canonicalCity: string
  sourceAliases: string
  targetKey: string
  mapReviewRequired: boolean
  withheldMapUrl?: string
}

type DatabaseDealership = {
  id: number
  brand_name: string
  display_name: string
  city: string
  website_url: string | null
  map_url: string | null
  source_aliases: string | null
}

type DatabaseVehicle = {
  id: number
  source_dealer_name: string | null
  dealership_id: number | null
}

type AgencyPlan = {
  desired: DesiredAgency
  existing?: DatabaseDealership
  changes: Record<string, { from: string | null; to: string }>
  targetId?: number
}

const DEFAULT_WORKBOOK = path.join(
  homedir(),
  'Downloads',
  'GBA_Client_Intake_2026-07-15.xlsx',
)

/** Extra exact source names observed in the immutable inventory rows. */
const ALIAS_EXPANSIONS: Record<string, string[]> = {
  dongfengculiacan: ['DONGFENG TRES RIOS'],
  dongfengciudadobregon: ['DONGFENG OBREGON'],
  jetoursoueastculiacan: ['JETOUR CULIACAN'],
  jetoursoueastobregon: ['JETOUR OBREGON'],
  automotrizdelnoroeste: ['STELLANTIS OBREGON'],
  stellantisculiacan: ['PEUGEOT CULIACAN', 'RAM TRES RIOS'],
}

function usage(): string {
  return [
    'Usage: npm run sync:agency-links -- [--workbook <path>] [--apply]',
    '',
    'Defaults to a read-only dry run. --apply is required for any database mutation.',
  ].join('\n')
}

function parseArguments(arguments_: string[]): Arguments {
  let apply = false
  let workbookPath = process.env.GBA_CLIENT_INTAKE_PATH || DEFAULT_WORKBOOK

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]
    if (argument === '--apply') {
      apply = true
      continue
    }
    if (argument === '--workbook' && arguments_[index + 1]) {
      workbookPath = path.resolve(arguments_[index + 1])
      index += 1
      continue
    }
    if (argument === '--help' || argument === '-h') {
      console.log(usage())
      process.exit(0)
    }
    throw new Error(`Unknown argument: ${argument}\n\n${usage()}`)
  }

  return { apply, workbookPath }
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function readAgencyLinkRows(workbookPath: string): AgencyLinkRow[] {
  if (!existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`)

  const workbook = XLSX.readFile(workbookPath, { raw: true })
  const worksheet = workbook.Sheets['Agency Links']
  if (!worksheet) throw new Error('Workbook does not contain an "Agency Links" sheet.')

  const grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    raw: true,
  })
  const headerIndex = grid.findIndex((row) => {
    const headers = row.map((value) => text(value))
    return headers.includes('Brand(s)') && headers.includes('Agency')
  })
  if (headerIndex < 0) throw new Error('Could not find the Agency Links header row.')

  const headers = grid[headerIndex].map((value) => text(value))
  const records = grid.slice(headerIndex + 1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])),
  )

  return records
    .map((record) => ({
      brandNames: text(record['Brand(s)']),
      agency: text(record.Agency),
      city: text(record.City),
      websiteUrl: text(record['Official Website']),
      mapUrl: text(record.Map),
      inventoryNameMapping: text(record['Inventory Name Mapping']),
      verification: text(record.Verification),
    }))
    .filter((row) => row.agency && row.city && row.inventoryNameMapping)
}

function brandGroup(brandNames: string): string {
  const key = normalizeDealershipKey(brandNames)
  if (key.includes('ford')) return 'ford'
  if (key.includes('lincoln')) return 'lincoln'
  if (key.includes('mazda')) return 'mazda'
  if (key.includes('dongfeng')) return 'dongfeng'
  if (key.includes('jetour') || key.includes('soueast')) return 'jetour'
  if (
    ['dodge', 'fiat', 'jeep', 'peugeot', 'ram', 'stellantis'].some((brand) =>
      key.includes(brand),
    )
  ) {
    return 'stellantis'
  }
  throw new Error(`Unsupported agency brand group: ${brandNames}`)
}

function canonicalCity(city: string): string {
  const key = normalizeDealershipKey(city)
  const knownCities: Record<string, string> = {
    cdobregon: 'Ciudad Obregón',
    ciudadobregon: 'Ciudad Obregón',
    culiacan: 'Culiacán',
    guadalajara: 'Guadalajara',
    hermosillo: 'Hermosillo',
    loscabos: 'Los Cabos',
    losmochis: 'Los Mochis',
    mazatlan: 'Mazatlán',
  }
  return knownCities[key] || city
}

function desiredAgency(row: AgencyLinkRow): DesiredAgency {
  const brandName = brandGroup(row.brandNames)
  const city = canonicalCity(row.city)
  const mapDecision = selectAgencyMapLink(row.mapUrl, row.verification)
  const mappingKey = normalizeDealershipKey(row.inventoryNameMapping)
  const aliases = [row.inventoryNameMapping, ...(ALIAS_EXPANSIONS[mappingKey] ?? [])]
    .map((alias) => alias.trim())
    .filter((alias, index, all) =>
      all.findIndex(
        (candidate) => normalizeDealershipKey(candidate) === normalizeDealershipKey(alias),
      ) === index,
    )

  return {
    ...row,
    brandName,
    canonicalCity: city,
    mapUrl: mapDecision.mapUrl,
    mapReviewRequired: mapDecision.reviewRequired,
    withheldMapUrl: mapDecision.withheldMapUrl,
    sourceAliases: aliases.join('\n'),
    targetKey: `${normalizeDealershipKey(brandName)}:${normalizeDealershipKey(city)}`,
  }
}

function changedFields(
  existing: DatabaseDealership | undefined,
  desired: DesiredAgency,
): Record<string, { from: string | null; to: string }> {
  if (!existing) return {}
  const fields = {
    display_name: desired.agency,
    website_url: desired.websiteUrl,
    map_url: desired.mapUrl,
    source_aliases: desired.sourceAliases,
  }
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([field, value]) => (existing[field as keyof DatabaseDealership] ?? '') !== value)
      .map(([field, value]) => [
        field,
        { from: (existing[field as keyof DatabaseDealership] as string | null) ?? null, to: value },
      ]),
  )
}

function relationshipId(value: number | null): number | null {
  return typeof value === 'number' ? value : null
}

function printAgencyPlan(plans: AgencyPlan[]): void {
  console.log('\nDealership updates')
  for (const plan of plans) {
    const { desired, existing, changes } = plan
    const label = `${desired.agency} — ${desired.canonicalCity}`
    if (!existing) {
      console.log(`[INSERT] ${label}`)
      console.log(`  aliases: ${desired.sourceAliases.replaceAll('\n', ' | ')}`)
    } else if (Object.keys(changes).length === 0) {
      console.log(`[UNCHANGED #${existing.id}] ${label}`)
    } else {
      console.log(`[UPDATE #${existing.id}] ${label}`)
      for (const [field, change] of Object.entries(changes)) {
        console.log(`  ${field}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`)
      }
    }
    if (desired.withheldMapUrl) {
      console.log(
        `  map_url: WITHHELD pending client confirmation (${desired.withheldMapUrl})`,
      )
    }
    if (desired.verification) console.log(`  verification: ${desired.verification}`)
  }
}

function correctionSummary(
  vehicles: DatabaseVehicle[],
  plansByAlias: Map<string, AgencyPlan>,
): { corrections: DatabaseVehicle[]; counts: Map<string, number> } {
  const corrections: DatabaseVehicle[] = []
  const counts = new Map<string, number>()
  for (const vehicle of vehicles) {
    const sourceName = text(vehicle.source_dealer_name)
    const plan = plansByAlias.get(normalizeDealershipKey(sourceName))
    if (!plan) continue

    const currentId = relationshipId(vehicle.dealership_id)
    if (plan.targetId === undefined || currentId !== plan.targetId) {
      corrections.push(vehicle)
      const key = `${sourceName} -> ${plan.desired.agency} (#${plan.targetId ?? 'new'})`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return { corrections, counts }
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2))
  const databaseUri = process.env.DATABASE_URI
  if (!databaseUri) throw new Error('DATABASE_URI is required.')

  const desiredAgencies = readAgencyLinkRows(arguments_.workbookPath).map(desiredAgency)
  if (desiredAgencies.length !== 15) {
    throw new Error(`Expected 15 Agency Links rows, found ${desiredAgencies.length}.`)
  }

  const client = new Client({ connectionString: databaseUri })
  await client.connect()
  await client.query(arguments_.apply ? 'BEGIN' : 'BEGIN READ ONLY')

  try {
    const columnResult = await client.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dealerships'
    `)
    const columns = new Set(columnResult.rows.map((row) => row.column_name))
    const migrationColumns = ['website_url', 'map_url', 'source_aliases']
    const missingColumns = migrationColumns.filter((column) => !columns.has(column))
    if (arguments_.apply && missingColumns.length > 0) {
      throw new Error(
        `Run the dealership links migration before --apply. Missing columns: ${missingColumns.join(', ')}`,
      )
    }

    const optionalColumn = (column: string) =>
      columns.has(column) ? `"${column}"` : `NULL::text AS "${column}"`
    const dealershipResult = await client.query<DatabaseDealership>(`
      SELECT id, brand_name, display_name, city,
        ${optionalColumn('website_url')},
        ${optionalColumn('map_url')},
        ${optionalColumn('source_aliases')}
      FROM dealerships
      ORDER BY id
    `)
    const vehicleResult = await client.query<DatabaseVehicle>(`
      SELECT id, source_dealer_name, dealership_id
      FROM vehicles
      ORDER BY id
    `)

    const plans: AgencyPlan[] = desiredAgencies.map((desired) => {
      const matches = dealershipResult.rows.filter(
        (dealership) =>
          `${normalizeDealershipKey(dealership.brand_name)}:${normalizeDealershipKey(dealership.city)}` ===
          desired.targetKey,
      )
      if (matches.length > 1) {
        throw new Error(`Multiple dealerships match ${desired.agency} in ${desired.canonicalCity}.`)
      }
      const existing = matches[0]
      return {
        desired,
        existing,
        changes: changedFields(existing, desired),
        targetId: existing?.id,
      }
    })

    if (arguments_.apply) {
      for (const plan of plans) {
        const { desired, existing, changes } = plan
        if (existing && Object.keys(changes).length > 0) {
          await client.query(
            `UPDATE dealerships
             SET display_name = $1, website_url = $2, map_url = $3,
                 source_aliases = $4, updated_at = now()
             WHERE id = $5`,
            [
              desired.agency,
              desired.websiteUrl || null,
              desired.mapUrl || null,
              desired.sourceAliases,
              existing.id,
            ],
          )
        } else if (!existing) {
          const inserted = await client.query<{ id: number }>(
            `INSERT INTO dealerships (
               brand_name, display_name, city, website_url, map_url,
               source_aliases, default_for_city, is_active, updated_at, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, false, true, now(), now())
             RETURNING id`,
            [
              desired.brandName,
              desired.agency,
              desired.canonicalCity,
              desired.websiteUrl || null,
              desired.mapUrl || null,
              desired.sourceAliases,
            ],
          )
          plan.targetId = inserted.rows[0].id
        }
      }
    }

    const plansByAlias = new Map<string, AgencyPlan>()
    for (const plan of plans) {
      for (const alias of plan.desired.sourceAliases.split(/\r?\n/)) {
        const aliasKey = normalizeDealershipKey(alias)
        const existingPlan = plansByAlias.get(aliasKey)
        if (existingPlan && existingPlan !== plan) {
          throw new Error(`Source alias ${alias} is assigned to multiple agencies.`)
        }
        plansByAlias.set(aliasKey, plan)
      }
    }

    const beforeApply = correctionSummary(vehicleResult.rows, plansByAlias)

    console.log(arguments_.apply ? 'Mode: APPLY' : 'Mode: DRY RUN (no mutations)')
    console.log(`Workbook: ${arguments_.workbookPath}`)
    console.log(
      `Withheld map links pending client confirmation: ${plans.filter((plan) => plan.desired.mapReviewRequired).length}`,
    )
    if (missingColumns.length > 0) {
      console.log(`Migration pending: ${missingColumns.join(', ')}`)
    }
    printAgencyPlan(plans)
    console.log('\nVehicle dealership corrections')
    for (const [label, count] of [...beforeApply.counts].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      console.log(`[${count}] ${label}`)
    }
    console.log(`Total vehicle corrections: ${beforeApply.corrections.length}`)
    console.log('Immutable source_dealer_name values will not be changed.')

    let appliedCorrections = 0
    if (arguments_.apply) {
      const actualSourceNamesByPlan = new Map<AgencyPlan, Set<string>>()
      for (const vehicle of beforeApply.corrections) {
        const sourceName = text(vehicle.source_dealer_name)
        const plan = plansByAlias.get(normalizeDealershipKey(sourceName))
        if (!plan?.targetId) continue
        const names = actualSourceNamesByPlan.get(plan) ?? new Set<string>()
        names.add(sourceName)
        actualSourceNamesByPlan.set(plan, names)
      }

      for (const [plan, sourceNames] of actualSourceNamesByPlan) {
        const result = await client.query(
          `UPDATE vehicles
           SET dealership_id = $1, updated_at = now()
           WHERE source_dealer_name = ANY($2::text[])
             AND dealership_id IS DISTINCT FROM $1`,
          [plan.targetId, [...sourceNames]],
        )
        appliedCorrections += result.rowCount ?? 0
      }
      await client.query('COMMIT')
      console.log(`Applied vehicle corrections: ${appliedCorrections}`)
    } else {
      await client.query('ROLLBACK')
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
