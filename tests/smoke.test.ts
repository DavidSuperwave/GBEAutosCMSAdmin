import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { formatMileage } from '../src/utils/formatMileage'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationChecker = path.join(root, 'scripts', 'check-migrations.mjs')

const migrationStem = '20260101_000000_fixture'
const validMigration = `
import { sql } from '@payloadcms/db-postgres'

interface FixtureContext { value: string }
type FixtureValue = FixtureContext['value']
function helper(value: FixtureValue): FixtureValue { return value }

export async function up(): Promise<void> {}
export async function down(): Promise<void> {}
`
const validIndex = `
import * as fixture from './${migrationStem}'

export const migrations = [
  { up: fixture.up, down: fixture.down, name: '${migrationStem}' },
]
`

function runMigrationChecker(migrationsDirectory?: string) {
  const arguments_ = migrationsDirectory ? ['--migrations-dir', migrationsDirectory] : []
  return spawnSync(process.execPath, [migrationChecker, ...arguments_], {
    cwd: root,
    encoding: 'utf8',
  })
}

function withMigrationFixture(
  testContext: { after: (cleanup: () => void) => void },
  sources: { index?: string; migration?: string },
) {
  const directory = mkdtempSync(path.join(tmpdir(), 'gbe-migrations-'))
  testContext.after(() => rmSync(directory, { recursive: true, force: true }))
  writeFileSync(path.join(directory, `${migrationStem}.ts`), sources.migration ?? validMigration)
  writeFileSync(path.join(directory, 'index.ts'), sources.index ?? validIndex)
  return directory
}

test('formatMileage handles missing and zero values', () => {
  assert.equal(formatMileage(undefined), 'Por confirmar')
  assert.equal(formatMileage(null), 'Por confirmar')
  assert.equal(formatMileage(0), 'Por confirmar')
})

test('formatMileage formats positive mileage for Mexico', () => {
  assert.equal(formatMileage(12345), '12,345 km')
})

test('migration checker accepts the current repository corpus', () => {
  const result = runMigrationChecker()

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Migration check passed: validated 15 migration module\(s\)\./)
})

test('migration checker rejects an index-level expression', (testContext) => {
  const directory = withMigrationFixture(testContext, {
    index: `${validIndex}\nconsole.log('unexpected')\n`,
  })
  const result = runMigrationChecker(directory)

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /unexpected top-level expression statement; index\.ts may contain only namespace migration imports and one exported const migrations registry\./,
  )
})

test('migration checker rejects an index-level initialized declaration', (testContext) => {
  const directory = withMigrationFixture(testContext, {
    index: `${validIndex}\nconst probe = sideEffect()\n`,
  })
  const result = runMigrationChecker(directory)

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /unexpected top-level variable declaration; index\.ts may contain only namespace migration imports and one exported const migrations registry\./,
  )
})

test('migration checker rejects migration top-level destructuring', (testContext) => {
  const directory = withMigrationFixture(testContext, {
    migration: `${validMigration}\nconst { value } = source\n`,
  })
  const result = runMigrationChecker(directory)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /unexpected executable top-level variable statement;/)
})

test('migration checker rejects migration side-effect-only imports', (testContext) => {
  const directory = withMigrationFixture(testContext, {
    migration: `import './unexpected-side-effect'\n${validMigration}`,
  })
  const result = runMigrationChecker(directory)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /side-effect-only imports are not allowed in migration modules\./)
})

test('migration checker rejects a top-level initializer that would execute a getter', (testContext) => {
  const directory = withMigrationFixture(testContext, {
    migration: `${validMigration}
const value = ({ get value() { throw new Error('executed') } }).value
`,
  })
  const result = runMigrationChecker(directory)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /unexpected executable top-level variable statement;/)
  assert.doesNotMatch(result.stderr, /executed/)
})

test('migration checker rejects a top-level initializer using Symbol.toPrimitive coercion', (testContext) => {
  const directory = withMigrationFixture(testContext, {
    migration: `${validMigration}
const value = ({
  [Symbol.toPrimitive]() { throw new Error('executed') },
}) + ''
`,
  })
  const result = runMigrationChecker(directory)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /unexpected executable top-level variable statement;/)
  assert.doesNotMatch(result.stderr, /executed/)
})
