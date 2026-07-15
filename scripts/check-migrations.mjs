import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function migrationsDirectoryFromArguments(arguments_) {
  if (arguments_.length === 0) return path.join(root, 'src', 'migrations')
  if (arguments_.length === 2 && arguments_[0] === '--migrations-dir' && arguments_[1]) {
    return path.resolve(arguments_[1])
  }

  console.error('Usage: node scripts/check-migrations.mjs [--migrations-dir <path>]')
  process.exit(2)
}

// --migrations-dir is intentionally limited to isolated static-check fixtures.
// The checker only reads TypeScript source and never imports migration modules.
const migrationsDirectory = migrationsDirectoryFromArguments(process.argv.slice(2))
const indexPath = path.join(migrationsDirectory, 'index.ts')
const failures = []

function fail(message) {
  failures.push(message)
}

function relativePath(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/')
}

function location(sourceFile, node) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  return `${relativePath(sourceFile.fileName)}:${line + 1}:${character + 1}`
}

function failAt(sourceFile, node, message) {
  fail(`${location(sourceFile, node)} ${message}`)
}

function parse(filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

  for (const diagnostic of sourceFile.parseDiagnostics) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    if (diagnostic.start === undefined) {
      fail(`${relativePath(filePath)} TypeScript syntax error: ${message}`)
      continue
    }

    const { line, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start)
    fail(
      `${relativePath(filePath)}:${line + 1}:${character + 1} TypeScript syntax error TS${diagnostic.code}: ${message}`,
    )
  }

  return sourceFile
}

function hasModifier(node, kind) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind)
}

function unwrapExpression(expression) {
  let current = expression
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function modifierKinds(node) {
  return (node.modifiers ?? []).map((modifier) => modifier.kind)
}

function hasOnlyModifiers(node, allowedKinds) {
  return modifierKinds(node).every((kind) => allowedKinds.has(kind))
}

function validateMigrationImport(sourceFile, statement) {
  const specifier = ts.isStringLiteralLike(statement.moduleSpecifier)
    ? statement.moduleSpecifier.text
    : statement.moduleSpecifier.getText(sourceFile)

  if (specifier !== '@payloadcms/db-postgres') {
    failAt(
      sourceFile,
      statement,
      `migration imports must come from "@payloadcms/db-postgres", received ${JSON.stringify(specifier)}.`,
    )
  }

  if (!statement.importClause) {
    failAt(sourceFile, statement, 'side-effect-only imports are not allowed in migration modules.')
  } else {
    const namedBindings = statement.importClause.namedBindings
    if (
      statement.importClause.name ||
      !namedBindings ||
      !ts.isNamedImports(namedBindings) ||
      namedBindings.elements.length === 0
    ) {
      failAt(
        sourceFile,
        statement,
        'migration imports must use one or more explicit named import bindings.',
      )
    }
  }

  if (statement.attributes || statement.assertClause) {
    failAt(sourceFile, statement, 'import assertions or attributes are not allowed in migration modules.')
  }
}

function isAllowedMigrationFunction(statement) {
  if (!statement.name || !statement.body || statement.asteriskToken) return false

  const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword)
  const async = hasModifier(statement, ts.SyntaxKind.AsyncKeyword)
  if (!hasOnlyModifiers(statement, new Set([ts.SyntaxKind.ExportKeyword, ts.SyntaxKind.AsyncKeyword]))) {
    return false
  }

  if (statement.name.text === 'up' || statement.name.text === 'down') return exported && async
  return !exported
}

function isAllowedErasedTypeDeclaration(statement) {
  return hasOnlyModifiers(statement, new Set([ts.SyntaxKind.ExportKeyword]))
}

function migrationStatementKind(statement) {
  if (ts.isVariableStatement(statement)) return 'variable statement'
  if (ts.isClassDeclaration(statement)) return 'class declaration'
  if (ts.isEnumDeclaration(statement)) return 'enum declaration'
  if (ts.isModuleDeclaration(statement)) return 'namespace/module declaration'
  if (ts.isExpressionStatement(statement)) return 'expression statement'
  return ts.SyntaxKind[statement.kind]
}

function validateTopLevelStatements(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      validateMigrationImport(sourceFile, statement)
      continue
    }
    if (ts.isFunctionDeclaration(statement) && isAllowedMigrationFunction(statement)) continue
    if (
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
      isAllowedErasedTypeDeclaration(statement)
    ) {
      continue
    }

    failAt(
      sourceFile,
      statement,
      `unexpected executable top-level ${migrationStatementKind(statement)}; migration modules may contain only named @payloadcms/db-postgres imports, function declarations, and erased type/interface declarations.`,
    )
  }
}

function callableExports(sourceFile) {
  const exportedNames = new Set()

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      if (
        hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
        !hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
      ) {
        exportedNames.add(statement.name.text)
      }
    }
  }

  return exportedNames
}

function validateMigrationModule(sourceFile) {
  validateTopLevelStatements(sourceFile)
  const exports = callableExports(sourceFile)
  for (const name of ['up', 'down']) {
    if (!exports.has(name)) {
      fail(`${relativePath(sourceFile.fileName)} must export ${name} as a callable declaration.`)
    }
  }
}

function propertyName(property) {
  if (!property.name || ts.isComputedPropertyName(property.name)) return undefined
  if (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) return property.name.text
  return undefined
}

function namespaceReference(expression, memberName) {
  const node = unwrapExpression(expression)
  if (
    !ts.isPropertyAccessExpression(node) ||
    !ts.isIdentifier(node.expression) ||
    node.name.text !== memberName
  ) {
    return undefined
  }
  return node.expression.text
}

function describeSequence(values) {
  return values.length ? values.join(', ') : '(none)'
}

function sameSequence(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index])
}

function duplicateValues(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].sort()
}

function indexStatementKind(statement) {
  if (ts.isExpressionStatement(statement)) return 'expression statement'
  if (ts.isVariableStatement(statement)) return 'variable declaration'
  if (ts.isImportDeclaration(statement)) return 'import declaration'
  if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) return 'export declaration'
  return ts.SyntaxKind[statement.kind]
}

function isExportedConstRegistryStatement(statement) {
  if (
    !ts.isVariableStatement(statement) ||
    statement.declarationList.declarations.length !== 1 ||
    (statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
    !hasModifier(statement, ts.SyntaxKind.ExportKeyword)
  ) {
    return false
  }

  const modifiers = ts.getModifiers(statement) ?? []
  if (modifiers.some((modifier) => modifier.kind !== ts.SyntaxKind.ExportKeyword)) return false

  const [declaration] = statement.declarationList.declarations
  return ts.isIdentifier(declaration.name) && declaration.name.text === 'migrations'
}

function validateIndexTopLevelStatements(sourceFile, registryStatement) {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) || statement === registryStatement) continue
    failAt(
      sourceFile,
      statement,
      `unexpected top-level ${indexStatementKind(statement)}; index.ts may contain only namespace migration imports and one exported const migrations registry.`,
    )
  }
}

function validateIndex(sourceFile, migrationStems) {
  const migrationStemSet = new Set(migrationStems)
  const imports = []

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const specifier = ts.isStringLiteralLike(statement.moduleSpecifier)
      ? statement.moduleSpecifier.text
      : statement.moduleSpecifier.getText(sourceFile)
    const namespaceImport = statement.importClause?.namedBindings
    const namespace = namespaceImport && ts.isNamespaceImport(namespaceImport) ? namespaceImport.name.text : undefined

    if (!specifier.startsWith('./')) {
      failAt(sourceFile, statement, `migration import must be relative, received ${JSON.stringify(specifier)}.`)
    }

    const relativeSpecifier = specifier.startsWith('./') ? specifier.slice(2) : ''
    const hasUnexpectedPath =
      !relativeSpecifier ||
      relativeSpecifier.includes('/') ||
      relativeSpecifier.includes('\\') ||
      (path.extname(relativeSpecifier) && path.extname(relativeSpecifier) !== '.ts')
    const stem = hasUnexpectedPath
      ? undefined
      : relativeSpecifier.endsWith('.ts')
        ? relativeSpecifier.slice(0, -3)
        : relativeSpecifier

    if (hasUnexpectedPath) {
      failAt(sourceFile, statement, `migration import points outside the expected src/migrations/*.ts shape: ${JSON.stringify(specifier)}.`)
    }

    if (
      !namespace ||
      statement.importClause?.name ||
      statement.importClause?.isTypeOnly ||
      statement.attributes ||
      statement.assertClause
    ) {
      failAt(sourceFile, statement, `migration import ${JSON.stringify(specifier)} must use exactly one namespace import.`)
    }

    const expectedPath = stem ? path.join(migrationsDirectory, `${stem}.ts`) : undefined
    if (expectedPath && !existsSync(expectedPath)) {
      failAt(sourceFile, statement, `migration import ${JSON.stringify(specifier)} points to missing file ${relativePath(expectedPath)}.`)
    }
    if (stem && !migrationStemSet.has(stem)) {
      failAt(sourceFile, statement, `migration import ${JSON.stringify(specifier)} does not match an on-disk migration module.`)
    }

    imports.push({ namespace, stem, statement })
  }

  const importStems = imports.map((entry) => entry.stem).filter((stem) => stem !== undefined)
  const namespaces = imports.map((entry) => entry.namespace).filter((namespace) => namespace !== undefined)
  for (const duplicate of duplicateValues(importStems)) {
    fail(`${relativePath(indexPath)} imports migration ${duplicate} more than once.`)
  }
  for (const duplicate of duplicateValues(namespaces)) {
    fail(`${relativePath(indexPath)} reuses namespace import ${duplicate} more than once.`)
  }

  if (!sameSequence(importStems, migrationStems)) {
    fail(
      `${relativePath(indexPath)} migration imports must follow filename order. Expected: ${describeSequence(migrationStems)}. Found: ${describeSequence(importStems)}.`,
    )
  }

  const importsByStem = new Map()
  const importsByNamespace = new Map()
  for (const entry of imports) {
    if (entry.stem) {
      const entries = importsByStem.get(entry.stem) ?? []
      entries.push(entry)
      importsByStem.set(entry.stem, entries)
    }
    if (entry.namespace) {
      const entries = importsByNamespace.get(entry.namespace) ?? []
      entries.push(entry)
      importsByNamespace.set(entry.namespace, entries)
    }
  }

  for (const stem of migrationStems) {
    const count = importsByStem.get(stem)?.length ?? 0
    if (count === 0) fail(`${relativePath(indexPath)} has no matching namespace import for ${stem}.ts.`)
    if (count > 1) fail(`${relativePath(indexPath)} has ${count} namespace imports for ${stem}.ts; expected exactly one.`)
  }

  const registryDeclarations = []
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'migrations') {
        registryDeclarations.push({ declaration, statement })
      }
    }
  }

  const registryStatement =
    registryDeclarations.length === 1 && isExportedConstRegistryStatement(registryDeclarations[0].statement)
      ? registryDeclarations[0].statement
      : undefined
  validateIndexTopLevelStatements(sourceFile, registryStatement)

  if (registryDeclarations.length !== 1) {
    fail(`${relativePath(indexPath)} must declare exactly one exported migrations registry; found ${registryDeclarations.length}.`)
    return
  }

  const { declaration, statement } = registryDeclarations[0]
  if (!isExportedConstRegistryStatement(statement)) {
    failAt(sourceFile, statement, 'migrations registry must be the sole declaration in an exported const statement.')
  }

  const registry = declaration.initializer && unwrapExpression(declaration.initializer)
  if (!registry || !ts.isArrayLiteralExpression(registry)) {
    failAt(sourceFile, declaration, 'migrations registry must be an array literal.')
    return
  }

  const entries = []
  registry.elements.forEach((element, index) => {
    const entryNumber = index + 1
    const unwrapped = unwrapExpression(element)
    if (!ts.isObjectLiteralExpression(unwrapped)) {
      failAt(sourceFile, element, `migration registry entry ${entryNumber} must be an object literal.`)
      return
    }

    const properties = new Map()
    let validShape = true
    for (const property of unwrapped.properties) {
      if (!ts.isPropertyAssignment(property)) {
        failAt(sourceFile, property, `migration registry entry ${entryNumber} must use plain up, down, and name properties.`)
        validShape = false
        continue
      }
      const name = propertyName(property)
      if (!name) {
        failAt(sourceFile, property, `migration registry entry ${entryNumber} has a computed or unsupported property name.`)
        validShape = false
        continue
      }
      if (properties.has(name)) {
        failAt(sourceFile, property, `migration registry entry ${entryNumber} duplicates property ${name}.`)
        validShape = false
      }
      properties.set(name, property)
    }

    const foundNames = [...properties.keys()].sort()
    const expectedNames = ['down', 'name', 'up']
    if (!sameSequence(foundNames, expectedNames)) {
      failAt(
        sourceFile,
        unwrapped,
        `migration registry entry ${entryNumber} must contain exactly up, down, and name properties; found ${describeSequence(foundNames)}.`,
      )
      validShape = false
    }
    if (!validShape) return

    const upProperty = properties.get('up')
    const downProperty = properties.get('down')
    const nameProperty = properties.get('name')
    const upNamespace = namespaceReference(upProperty.initializer, 'up')
    const downNamespace = namespaceReference(downProperty.initializer, 'down')
    const nameExpression = unwrapExpression(nameProperty.initializer)
    const name = ts.isStringLiteralLike(nameExpression) ? nameExpression.text : undefined

    if (!upNamespace) {
      failAt(sourceFile, upProperty, `migration registry entry ${entryNumber} up must reference an imported namespace's up export.`)
    }
    if (!downNamespace) {
      failAt(sourceFile, downProperty, `migration registry entry ${entryNumber} down must reference an imported namespace's down export.`)
    }
    if (!name) {
      failAt(sourceFile, nameProperty, `migration registry entry ${entryNumber} name must be a non-empty string literal.`)
    }
    if (upNamespace && downNamespace && upNamespace !== downNamespace) {
      failAt(sourceFile, unwrapped, `migration registry entry ${entryNumber} up and down reference different namespaces.`)
    }

    const namespace = upNamespace === downNamespace ? upNamespace : undefined
    const namespaceImports = namespace ? importsByNamespace.get(namespace) ?? [] : []
    if (namespace && namespaceImports.length !== 1) {
      failAt(
        sourceFile,
        unwrapped,
        `migration registry entry ${entryNumber} references namespace ${namespace}, which does not resolve to exactly one import.`,
      )
    }
    const stem = namespaceImports.length === 1 ? namespaceImports[0].stem : undefined
    if (name && stem && name !== stem) {
      failAt(sourceFile, nameProperty, `migration registry name ${JSON.stringify(name)} must equal imported filename stem ${JSON.stringify(stem)}.`)
    }

    entries.push({ name, namespace, stem })
  })

  const registryNames = entries.map((entry) => entry.name).filter((name) => name !== undefined)
  const registryStems = entries.map((entry) => entry.stem).filter((stem) => stem !== undefined)
  for (const duplicate of duplicateValues(registryNames)) {
    fail(`${relativePath(indexPath)} registry name ${duplicate} appears more than once.`)
  }
  for (const duplicate of duplicateValues(registryStems)) {
    fail(`${relativePath(indexPath)} registers migration ${duplicate} more than once.`)
  }

  if (!sameSequence(registryNames, migrationStems)) {
    fail(
      `${relativePath(indexPath)} registry names must follow filename order. Expected: ${describeSequence(migrationStems)}. Found: ${describeSequence(registryNames)}.`,
    )
  }
  if (!sameSequence(registryStems, migrationStems)) {
    fail(
      `${relativePath(indexPath)} registry entries must follow filename order. Expected: ${describeSequence(migrationStems)}. Found: ${describeSequence(registryStems)}.`,
    )
  }

  for (const stem of migrationStems) {
    const count = registryStems.filter((entryStem) => entryStem === stem).length
    if (count === 0) fail(`${relativePath(indexPath)} does not register migration ${stem}.ts.`)
    if (count > 1) fail(`${relativePath(indexPath)} registers migration ${stem}.ts ${count} times; expected exactly once.`)
  }
}

const migrationFiles = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.ts') && name !== 'index.ts')
  .sort()
const migrationStems = migrationFiles.map((name) => name.slice(0, -3))
const migrationSources = migrationFiles.map((name) => parse(path.join(migrationsDirectory, name)))
const indexSource = parse(indexPath)

for (const sourceFile of migrationSources) validateMigrationModule(sourceFile)
validateIndex(indexSource, migrationStems)

if (failures.length) {
  console.error(`Migration check failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Migration check passed: validated ${migrationFiles.length} migration module(s).`)
