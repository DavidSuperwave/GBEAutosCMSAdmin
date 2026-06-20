import 'dotenv/config'

import fs from 'node:fs/promises'
import path from 'node:path'

import pg from 'pg'

const { Client } = pg

type BackupRecord = Record<string, unknown>

type CleanupTarget = {
  table:
    | 'analytics_events'
    | 'leads'
    | 'pages'
    | 'pages_blocks_inventory_collection'
    | 'site_config_blocks_inventory_collection'
    | 'vehicle_collections'
  label: string
  selectSql: string
}

const execute = process.argv.includes('--execute')
const databaseUri = process.env.DATABASE_URI
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outputDir = path.resolve('output', 'production-cleanup')
const backupPath = path.join(outputDir, `qa-cleanup-backup-${timestamp}.json`)

const targets: CleanupTarget[] = [
  {
    table: 'pages',
    label: 'QA P3 public page',
    selectSql: `select * from pages where slug = 'qa-p3-public-page'`,
  },
  {
    table: 'vehicle_collections',
    label: 'QA P3 vehicle collections',
    selectSql: `
      select *
      from vehicle_collections
      where slug in ('qa-p3-manual', 'qa-p3-mazda-culiacan')
    `,
  },
  {
    table: 'pages_blocks_inventory_collection',
    label: 'Page blocks referencing QA P3 collections',
    selectSql: `
      select *
      from pages_blocks_inventory_collection
      where collection_id in (
        select id
        from vehicle_collections
        where slug in ('qa-p3-manual', 'qa-p3-mazda-culiacan')
      )
    `,
  },
  {
    table: 'site_config_blocks_inventory_collection',
    label: 'Site config blocks referencing QA P3 collections',
    selectSql: `
      select *
      from site_config_blocks_inventory_collection
      where collection_id in (
        select id
        from vehicle_collections
        where slug in ('qa-p3-manual', 'qa-p3-mazda-culiacan')
      )
    `,
  },
  {
    table: 'leads',
    label: 'QA/Codex leads',
    selectSql: `
      select *
      from leads
      where first_name ilike '%QA%'
        or first_name ilike '%Codex%'
        or source_section ilike '%p3_%'
        or source_page ilike '%qa-p3%'
    `,
  },
  {
    table: 'analytics_events',
    label: 'QA/P3 analytics events',
    selectSql: `
      select *
      from analytics_events
      where source_section ilike '%p3_%'
        or source_section ilike '%qa%'
        or page_path ilike '%qa-p3%'
        or page_title ilike '%QA P3%'
    `,
  },
]

function requireDatabaseUri() {
  if (!databaseUri) {
    throw new Error('DATABASE_URI is required to run the QA cleanup script.')
  }

  return databaseUri
}

function createClient() {
  const connectionString = requireDatabaseUri()

  return new Client({
    connectionString,
    connectionTimeoutMillis: 15000,
    ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  })
}

async function main() {
  const client = createClient()

  await fs.mkdir(outputDir, { recursive: true })
  await client.connect()

  try {
    const records: Record<CleanupTarget['table'], BackupRecord[]> = {
      analytics_events: [],
      leads: [],
      pages: [],
      pages_blocks_inventory_collection: [],
      site_config_blocks_inventory_collection: [],
      vehicle_collections: [],
    }

    for (const target of targets) {
      const result = await client.query<BackupRecord>(target.selectSql)
      records[target.table] = result.rows
    }

    const summary = targets.map((target) => ({
      table: target.table,
      label: target.label,
      count: records[target.table].length,
    }))

    await fs.writeFile(
      backupPath,
      JSON.stringify(
        {
          executed: execute,
          timestamp: new Date().toISOString(),
          summary,
          records,
        },
        null,
        2,
      ),
    )

    console.table(summary)
    console.log(`Backup written to ${backupPath}`)

    if (!execute) {
      console.log('Dry run only. Re-run with --execute to hard-delete these QA records.')
      return
    }

    await client.query('begin')

    try {
      for (const target of [
        ...targets.filter((target) => target.table === 'analytics_events'),
        ...targets.filter((target) => target.table === 'leads'),
        ...targets.filter((target) => target.table === 'pages_blocks_inventory_collection'),
        ...targets.filter((target) => target.table === 'site_config_blocks_inventory_collection'),
        ...targets.filter((target) => target.table === 'pages'),
        ...targets.filter((target) => target.table === 'vehicle_collections'),
      ]) {
        const ids = records[target.table]
          .map((doc) => doc.id)
          .filter((id): id is number | string => typeof id === 'number' || typeof id === 'string')
          .map(String)

        if (ids.length === 0) continue

        await client.query(`delete from ${target.table} where id::text = any($1::text[])`, [ids])
      }

      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    }

    console.log('QA cleanup complete.')
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
