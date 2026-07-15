import assert from 'node:assert/strict'
import test from 'node:test'

import {
  matchDealershipForImport,
  normalizeDealershipKey,
  splitSourceAliases,
} from '../src/services/dealershipMatching'

const dealerships = [
  {
    id: 8,
    brandName: 'dongfeng',
    displayName: 'Dongfeng Culiacán',
    city: 'Culiacán',
    sourceAliases: 'DONGFENG CULIACAN\nDONGFENG TRES RIOS',
  },
  {
    id: 9,
    brandName: 'dongfeng',
    displayName: 'Dongfeng Obregón',
    city: 'Ciudad Obregón',
    sourceAliases: 'DONGFENG CIUDAD OBREGON\nDONGFENG OBREGON',
  },
  {
    id: 23,
    brandName: 'stellantis',
    displayName: 'Stellantis Culiacán',
    city: 'Culiacán',
    sourceAliases: 'STELLANTIS CULIACAN\nPEUGEOT CULIACAN\nRAM TRES RIOS',
  },
]

test('dealership keys ignore accents, punctuation, case and spaces', () => {
  assert.equal(normalizeDealershipKey('  Stellantis Culiacán '), 'stellantisculiacan')
  assert.equal(normalizeDealershipKey('RAM-TRES RÍOS'), 'ramtresrios')
})

test('newline-delimited aliases discard blank lines without changing source text', () => {
  assert.deepEqual(splitSourceAliases('FORD CULIACAN\r\n\r\nFORD TRES RIOS '), [
    'FORD CULIACAN',
    'FORD TRES RIOS',
  ])
})

test('DONGFENG TRES RIOS resolves to the Culiacán branch by exact alias', () => {
  const result = matchDealershipForImport(dealerships, 'Dongfeng', 'DONGFENG TRES RIOS')
  assert.equal(result.strategy, 'sourceAlias')
  assert.equal(result.dealership?.id, 8)
})

test('PEUGEOT CULIACAN and RAM TRES RIOS resolve to Stellantis Culiacán', () => {
  for (const sourceName of ['PEUGEOT CULIACAN', 'RAM TRES RIOS']) {
    const result = matchDealershipForImport(dealerships, 'Peugeot', sourceName)
    assert.equal(result.strategy, 'sourceAlias')
    assert.equal(result.dealership?.id, 23)
  }
})

test('exact aliases take precedence over display-name and brand fallbacks', () => {
  const competing = [
    ...dealerships,
    {
      id: 99,
      brandName: 'dongfeng',
      displayName: 'DONGFENG TRES RIOS',
      city: 'Elsewhere',
      sourceAliases: null,
    },
  ]
  const result = matchDealershipForImport(competing, 'dongfeng', 'DONGFENG TRES RIOS')
  assert.equal(result.strategy, 'sourceAlias')
  assert.equal(result.dealership?.id, 8)
})

test('a brand fallback fails closed when the brand has multiple city branches', () => {
  const result = matchDealershipForImport(dealerships, 'dongfeng', 'unknown source agency')
  assert.equal(result.strategy, 'ambiguousBrand')
  assert.equal(result.dealership, undefined)
})
