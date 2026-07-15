import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePostgresPoolMax } from '../src/services/postgresPoolConfig'

test('production keeps the two connections configured for Payload request initialization', () => {
  assert.equal(
    resolvePostgresPoolMax({
      NODE_ENV: 'production',
      POSTGRES_POOL_MAX: '2',
    }),
    2,
  )
})

test('production defaults to two connections and caps accidental over-allocation', () => {
  assert.equal(resolvePostgresPoolMax({ NODE_ENV: 'production' }), 2)
  assert.equal(
    resolvePostgresPoolMax({
      NODE_ENV: 'production',
      POSTGRES_POOL_MAX: '1',
    }),
    2,
  )
  assert.equal(
    resolvePostgresPoolMax({
      NODE_ENV: 'production',
      POSTGRES_POOL_MAX: '20',
    }),
    2,
  )
})

test('development retains a slightly larger configurable pool', () => {
  assert.equal(resolvePostgresPoolMax({ NODE_ENV: 'development' }), 3)
  assert.equal(
    resolvePostgresPoolMax({
      NODE_ENV: 'development',
      POSTGRES_POOL_MAX: '5',
    }),
    5,
  )
})
