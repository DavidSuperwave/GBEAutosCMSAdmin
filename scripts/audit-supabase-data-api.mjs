import 'dotenv/config'

import pg from 'pg'

import { isUnsafePublicPolicy } from './supabase-data-api-policy.mjs'

const requireLocked = process.argv.includes('--require-locked')
const connectionString = process.env.DATABASE_URI

if (!connectionString) {
  console.error('DATABASE_URI is required.')
  process.exit(2)
}

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
})

await client.connect()

try {
  await client.query('BEGIN READ ONLY')
  const relations = await client.query(`
    SELECT
      c.relname AS relation_name,
      c.relkind,
      array_remove(ARRAY[
        CASE WHEN has_table_privilege('anon', c.oid, 'SELECT')
          OR has_any_column_privilege('anon', c.oid, 'SELECT') THEN 'SELECT' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'INSERT')
          OR has_any_column_privilege('anon', c.oid, 'INSERT') THEN 'INSERT' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'UPDATE')
          OR has_any_column_privilege('anon', c.oid, 'UPDATE') THEN 'UPDATE' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'DELETE') THEN 'DELETE' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'REFERENCES')
          OR has_any_column_privilege('anon', c.oid, 'REFERENCES') THEN 'REFERENCES' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'TRIGGER') THEN 'TRIGGER' END
      ]::text[], NULL) AS anon_privileges,
      array_remove(ARRAY[
        CASE WHEN has_table_privilege('authenticated', c.oid, 'SELECT')
          OR has_any_column_privilege('authenticated', c.oid, 'SELECT') THEN 'SELECT' END,
        CASE WHEN has_table_privilege('authenticated', c.oid, 'INSERT')
          OR has_any_column_privilege('authenticated', c.oid, 'INSERT') THEN 'INSERT' END,
        CASE WHEN has_table_privilege('authenticated', c.oid, 'UPDATE')
          OR has_any_column_privilege('authenticated', c.oid, 'UPDATE') THEN 'UPDATE' END,
        CASE WHEN has_table_privilege('authenticated', c.oid, 'DELETE') THEN 'DELETE' END,
        CASE WHEN has_table_privilege('authenticated', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END,
        CASE WHEN has_table_privilege('authenticated', c.oid, 'REFERENCES')
          OR has_any_column_privilege('authenticated', c.oid, 'REFERENCES') THEN 'REFERENCES' END,
        CASE WHEN has_table_privilege('authenticated', c.oid, 'TRIGGER') THEN 'TRIGGER' END
      ]::text[], NULL) AS authenticated_privileges
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    ORDER BY c.relname
  `)
  const policies = await client.query(`
    SELECT tablename, policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles && ARRAY['anon', 'authenticated', 'public']::name[]
    ORDER BY tablename, policyname
  `)
  const sequences = await client.query(`
    SELECT
      c.relname AS sequence_name,
      array_remove(ARRAY[
        CASE WHEN has_sequence_privilege('anon', c.oid, 'USAGE') THEN 'USAGE' END,
        CASE WHEN has_sequence_privilege('anon', c.oid, 'SELECT') THEN 'SELECT' END,
        CASE WHEN has_sequence_privilege('anon', c.oid, 'UPDATE') THEN 'UPDATE' END
      ]::text[], NULL) AS anon_privileges,
      array_remove(ARRAY[
        CASE WHEN has_sequence_privilege('authenticated', c.oid, 'USAGE') THEN 'USAGE' END,
        CASE WHEN has_sequence_privilege('authenticated', c.oid, 'SELECT') THEN 'SELECT' END,
        CASE WHEN has_sequence_privilege('authenticated', c.oid, 'UPDATE') THEN 'UPDATE' END
      ]::text[], NULL) AS authenticated_privileges
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
    ORDER BY c.relname
  `)
  const functions = await client.query(`
    SELECT
      p.oid::regprocedure::text AS function_name,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    ORDER BY p.oid::regprocedure::text
  `)

  const exposedRelations = relations.rows.filter(
    (row) => row.anon_privileges.length > 0 || row.authenticated_privileges.length > 0,
  )
  const unsafePolicies = policies.rows.filter(isUnsafePublicPolicy)
  const exposedSequences = sequences.rows.filter(
    (row) => row.anon_privileges.length > 0 || row.authenticated_privileges.length > 0,
  )
  const exposedFunctions = functions.rows.filter(
    (row) => row.anon_execute || row.authenticated_execute,
  )

  console.log(
    JSON.stringify(
      {
        exposedRelationCount: exposedRelations.length,
        exposedRelations: exposedRelations.map((row) => ({
          name: row.relation_name,
          kind: row.relkind,
          anonPrivileges: row.anon_privileges,
          authenticatedPrivileges: row.authenticated_privileges,
        })),
        exposedSequenceCount: exposedSequences.length,
        exposedSequences: exposedSequences.map((row) => ({
          name: row.sequence_name,
          anonPrivileges: row.anon_privileges,
          authenticatedPrivileges: row.authenticated_privileges,
        })),
        exposedFunctionCount: exposedFunctions.length,
        exposedFunctions: exposedFunctions.map((row) => row.function_name),
        applicablePolicyCount: policies.rows.length,
        unsafePolicyCount: unsafePolicies.length,
        unsafePolicies: unsafePolicies.map((row) => ({
          table: row.tablename,
          policy: row.policyname,
          command: row.cmd,
          roles: row.roles,
          qualifier: row.qual,
          withCheck: row.with_check,
        })),
      },
      null,
      2,
    ),
  )
  await client.query('ROLLBACK')

  if (
    requireLocked &&
    (exposedRelations.length > 0 ||
      exposedSequences.length > 0 ||
      exposedFunctions.length > 0 ||
      unsafePolicies.length > 0)
  ) {
    console.error('Raw Supabase Data API access is still enabled for Payload tables.')
    process.exitCode = 1
  }
} finally {
  await client.end()
}
