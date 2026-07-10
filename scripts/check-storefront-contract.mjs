import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function fixturePathFromArguments(arguments_) {
  if (arguments_.length === 0) return path.join(root, 'contracts', 'storefront-consumption.json')
  if (arguments_.length === 2 && arguments_[0] === '--fixture' && arguments_[1]) {
    return path.resolve(arguments_[1])
  }

  console.error('Usage: node scripts/check-storefront-contract.mjs [--fixture <path>]')
  process.exit(2)
}

const fixturePath = fixturePathFromArguments(process.argv.slice(2))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const failures = []

function fail(message) {
  failures.push(message)
}

const sourceFileCache = new Map()

function sourceFor(relativeFile) {
  if (sourceFileCache.has(relativeFile)) return sourceFileCache.get(relativeFile)
  const filePath = path.join(root, relativeFile)
  if (!existsSync(filePath)) {
    fail(`${relativeFile} no longer exists but the Storefront consumes it.`)
    sourceFileCache.set(relativeFile, undefined)
    return undefined
  }
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  sourceFileCache.set(relativeFile, sourceFile)
  return sourceFile
}

function propertyNameText(name) {
  if (!name || ts.isComputedPropertyName(name)) return undefined
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text
  return undefined
}

// Every string literal assigned to the given property name, in both runtime
// object literals ({ name: 'x' }) and type literals ({ blockType: 'x' }).
function collectPropertyStringValues(sourceFile, propertyName) {
  const values = new Set()
  const visit = (node) => {
    if (ts.isPropertyAssignment(node) && propertyNameText(node.name) === propertyName) {
      if (ts.isStringLiteralLike(node.initializer)) values.add(node.initializer.text)
    }
    if (ts.isPropertySignature(node) && propertyNameText(node.name) === propertyName && node.type) {
      if (ts.isLiteralTypeNode(node.type) && ts.isStringLiteralLike(node.type.literal)) {
        values.add(node.type.literal.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return values
}

function collectAllStringLiterals(sourceFile) {
  const values = new Set()
  const visit = (node) => {
    if (ts.isStringLiteralLike(node)) values.add(node.text)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return values
}

// Property names declared by a named type alias or interface, following local
// intersections, unions, and references to other local aliases/interfaces.
function collectTypeMemberNames(sourceFile, typeName) {
  const aliases = new Map()
  const interfaces = new Map()
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement)) aliases.set(statement.name.text, statement.type)
    if (ts.isInterfaceDeclaration(statement)) interfaces.set(statement.name.text, statement)
  }

  const names = new Set()
  const seen = new Set()

  const visitTypeNode = (typeNode) => {
    if (!typeNode) return
    if (ts.isTypeLiteralNode(typeNode)) {
      for (const member of typeNode.members) {
        if (ts.isPropertySignature(member)) {
          const name = propertyNameText(member.name)
          if (name) names.add(name)
        }
      }
      return
    }
    if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
      for (const part of typeNode.types) visitTypeNode(part)
      return
    }
    if (ts.isParenthesizedTypeNode(typeNode)) {
      visitTypeNode(typeNode.type)
      return
    }
    if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
      visitByName(typeNode.typeName.text)
    }
  }

  const visitByName = (name) => {
    if (seen.has(name)) return
    seen.add(name)
    if (aliases.has(name)) visitTypeNode(aliases.get(name))
    const declaration = interfaces.get(name)
    if (declaration) {
      for (const member of declaration.members) {
        if (ts.isPropertySignature(member)) {
          const memberName = propertyNameText(member.name)
          if (memberName) names.add(memberName)
        }
      }
      for (const heritage of declaration.heritageClauses ?? []) {
        for (const type of heritage.types) {
          if (ts.isIdentifier(type.expression)) visitByName(type.expression.text)
        }
      }
    }
  }

  if (!aliases.has(typeName) && !interfaces.has(typeName)) return undefined
  visitByName(typeName)
  return names
}

function checkSubset(relativeFile, label, consumed, declared) {
  for (const value of consumed) {
    if (!declared.has(value)) {
      fail(`${relativeFile}: ${label} ${JSON.stringify(value)} is consumed by the Storefront but no longer declared.`)
    }
  }
}

for (const routeFile of fixture.routeFiles ?? []) {
  if (!existsSync(path.join(root, routeFile))) {
    fail(`${routeFile} route file is missing; the Storefront calls this endpoint.`)
  }
}

for (const [relativeFile, types] of Object.entries(fixture.dtoTypes ?? {})) {
  const sourceFile = sourceFor(relativeFile)
  if (!sourceFile) continue
  for (const [typeName, fields] of Object.entries(types)) {
    const declared = collectTypeMemberNames(sourceFile, typeName)
    if (!declared) {
      fail(`${relativeFile}: exported type ${typeName} no longer exists; the Storefront depends on its shape.`)
      continue
    }
    checkSubset(relativeFile, `${typeName} field`, fields, declared)
  }
}

for (const [relativeFile, blockTypes] of Object.entries(fixture.landingBlockTypes ?? {})) {
  const sourceFile = sourceFor(relativeFile)
  if (!sourceFile) continue
  checkSubset(relativeFile, 'landing blockType', blockTypes, collectPropertyStringValues(sourceFile, 'blockType'))
}

for (const [relativeFile, slugs] of Object.entries(fixture.siteSectionBlockSlugs ?? {})) {
  const sourceFile = sourceFor(relativeFile)
  if (!sourceFile) continue
  checkSubset(relativeFile, 'site section block slug', slugs, collectPropertyStringValues(sourceFile, 'slug'))
}

for (const [relativeFile, slug] of Object.entries({
  ...(fixture.collectionSlugs ?? {}),
  ...(fixture.globalSlugs ?? {}),
})) {
  const sourceFile = sourceFor(relativeFile)
  if (!sourceFile) continue
  if (!collectPropertyStringValues(sourceFile, 'slug').has(slug)) {
    fail(`${relativeFile}: slug ${JSON.stringify(slug)} is consumed by the Storefront but no longer declared.`)
  }
}

for (const [relativeFile, fields] of Object.entries({
  ...(fixture.collectionFields ?? {}),
  ...(fixture.globalFields ?? {}),
})) {
  const sourceFile = sourceFor(relativeFile)
  if (!sourceFile) continue
  checkSubset(relativeFile, 'field', fields, collectPropertyStringValues(sourceFile, 'name'))
}

for (const [relativeFile, eventTypes] of Object.entries(fixture.analyticsEventTypes ?? {})) {
  const sourceFile = sourceFor(relativeFile)
  if (!sourceFile) continue
  checkSubset(relativeFile, 'analytics event type', eventTypes, collectPropertyStringValues(sourceFile, 'value'))
}

for (const [relativeFile, literals] of Object.entries(fixture.stringLiterals ?? {})) {
  const sourceFile = sourceFor(relativeFile)
  if (!sourceFile) continue
  checkSubset(relativeFile, 'contract literal', literals, collectAllStringLiterals(sourceFile))
}

if (failures.length) {
  console.error(`Storefront contract drift check failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  console.error(
    '\nThe Storefront (pinned at ' +
      `${fixture.pinnedStorefront?.sha ?? 'unknown SHA'}) consumes these contracts. ` +
      'If a change is intentional, update the Storefront first (or in lockstep) and then update contracts/storefront-consumption.json.',
  )
  process.exit(1)
}

console.log('Storefront contract drift check passed.')
