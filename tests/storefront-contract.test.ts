import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checker = path.join(root, 'scripts', 'check-storefront-contract.mjs')
const fixturePath = path.join(root, 'contracts', 'storefront-consumption.json')

function runChecker(fixture?: string) {
  const arguments_ = fixture ? ['--fixture', fixture] : []
  return spawnSync(process.execPath, [checker, ...arguments_], {
    cwd: root,
    encoding: 'utf8',
  })
}

function withProbeFixture(
  testContext: { after: (cleanup: () => void) => void },
  mutate: (fixture: Record<string, Record<string, unknown>>) => void,
) {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
  mutate(fixture)
  const directory = mkdtempSync(path.join(tmpdir(), 'gbe-contract-'))
  testContext.after(() => rmSync(directory, { recursive: true, force: true }))
  const probePath = path.join(directory, 'probe.json')
  writeFileSync(probePath, JSON.stringify(fixture))
  return probePath
}

test('storefront contract check passes on the current repository', () => {
  const result = runChecker()

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Storefront contract drift check passed\./)
})

test('storefront contract check fails when a consumed DTO field disappears', (testContext) => {
  const probe = withProbeFixture(testContext, (fixture) => {
    const dtoTypes = fixture.dtoTypes['src/contracts/publicCatalog.ts'] as Record<
      string,
      string[]
    >
    dtoTypes.PublicVehicleCard.push('fieldThatDoesNotExist')
  })
  const result = runChecker(probe)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /PublicVehicleCard field "fieldThatDoesNotExist" is consumed/)
})

test('storefront contract check fails when a consumed block slug disappears', (testContext) => {
  const probe = withProbeFixture(testContext, (fixture) => {
    const blocks = fixture.siteSectionBlockSlugs['src/blocks/SiteSections.ts'] as string[]
    blocks.push('blockThatDoesNotExist')
  })
  const result = runChecker(probe)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /site section block slug "blockThatDoesNotExist" is consumed/)
})

test('storefront contract check fails when a consumed route file disappears', (testContext) => {
  const probe = withProbeFixture(testContext, (fixture) => {
    const routes = fixture.routeFiles as unknown as string[]
    routes.push('src/app/(payload)/api/public/route-that-does-not-exist/route.ts')
  })
  const result = runChecker(probe)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /route file is missing/)
})
