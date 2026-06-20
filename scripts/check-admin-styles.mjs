import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const failures = []

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function fail(message) {
  failures.push(message)
}

const customScss = read('src/app/(payload)/custom.scss')
for (const phrase of [
  'Appended last',
  'overrides win the cascade',
  'Final AI image studio overrides',
]) {
  if (customScss.includes(phrase))
    fail(`custom.scss still contains cascade-policy phrase: ${phrase}`)
}

const singleOwnerSelectors = [
  '.admin-kit-shell',
  '.admin-kit-header',
  '.admin-kit-btn',
  '.admin-kit-btn--primary',
  '.admin-kit-btn--secondary',
  '.admin-kit-card',
  '.admin-kit-preview',
  '.vehicle-ai-wizard--studio',
  '.vehicle-ai-wizard--studio .vehicle-ai-wizard__chat',
  '.vehicle-ai-wizard--studio .pk-prompt-input.vehicle-ai-wizard__composer',
]

function isTopLevel(line) {
  return line.length === line.trimStart().length
}

function parseSelectorPrelude(lines) {
  return lines
    .join(' ')
    .replace(/\s*\{\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean)
}

function collectTopLevelSelectors(text) {
  const selectorLocations = new Map()
  const lines = text.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()

    if (isTopLevel(line) && trimmed.startsWith('@media')) {
      let depth = 0
      do {
        const current = lines[index] ?? ''
        depth += (current.match(/\{/g) || []).length
        depth -= (current.match(/\}/g) || []).length
        index += 1
      } while (index < lines.length && depth > 0)
      index -= 1
      continue
    }

    if (!isTopLevel(line) || !trimmed.startsWith('.') || trimmed.startsWith('..')) continue

    const startLine = index + 1
    const prelude = []
    while (index < lines.length) {
      prelude.push(lines[index])
      if (lines[index].includes('{')) break
      index += 1
    }

    for (const selector of parseSelectorPrelude(prelude)) {
      if (!selectorLocations.has(selector)) selectorLocations.set(selector, [])
      selectorLocations.get(selector).push(startLine)
    }
  }

  return selectorLocations
}

const selectorLocations = collectTopLevelSelectors(customScss)

for (const selector of singleOwnerSelectors) {
  const lines = selectorLocations.get(selector) || []

  if (lines.length > 1) {
    fail(`${selector} has multiple top-level base definitions in custom.scss: ${lines.join(', ')}`)
  }
}

for (const [selector, lines] of selectorLocations) {
  if (selector.startsWith('.vehicle-ai-wizard--studio') && lines.length > 1) {
    fail(
      `${selector} has multiple top-level AI studio definitions in custom.scss: ${lines.join(', ')}`,
    )
  }
}

if (customScss.includes('var(--admin-kit-focus)') && !/--admin-kit-focus\s*:/.test(customScss)) {
  fail('custom.scss uses --admin-kit-focus but does not define it.')
}

const payloadConfig = read('src/payload.config.ts')
if (!/theme\s*:\s*['"]light['"]/.test(payloadConfig)) {
  fail("payload.config.ts must keep admin.theme fixed to 'light' while dark/auto is deferred.")
}

if (/actions\s*:\s*\[[\s\S]*?['"]\.\/components\/ThemeToggle['"][\s\S]*?\]/.test(payloadConfig)) {
  fail('ThemeToggle is registered while admin.theme is fixed to light.')
}

const adminDocs = read('docs/admin-screens.md')
if (/Claro\s*\/\s*Oscuro\s*\/\s*Auto|interruptor de tema/i.test(adminDocs)) {
  fail('admin-screens.md still describes a light/dark/auto theme toggle.')
}

const e2ePlan = read('docs/production-e2e-test-plan.md')
if (/open media workspace with/i.test(e2ePlan) || /theme toggle states/i.test(e2ePlan)) {
  fail('production-e2e-test-plan.md still requires hidden media workspace or theme toggle QA.')
}

for (const path of [
  'src/components/VehicleLookupField.tsx',
  'src/components/VehicleAdminLinks.tsx',
  'src/components/PriceFormatter.tsx',
]) {
  const text = read(path)
  if (/\bstyle=\{/.test(text) || /React\.CSSProperties/.test(text)) {
    fail(`${path} reintroduced inline layout/color styling.`)
  }
}

if (failures.length) {
  console.error('Admin style guard failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Admin style guard passed.')
