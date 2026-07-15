import assert from 'node:assert/strict'
import test from 'node:test'

import { isUnsafePublicPolicy } from '../scripts/supabase-data-api-policy.mjs'
import { resolveVehicleImageSyncMode } from '../scripts/vehicle-image-sync-mode.mjs'

test('vehicle image sync cannot mutate without an explicit apply flag', () => {
  assert.deepEqual(resolveVehicleImageSyncMode([]), { apply: false, dryRun: true })
  assert.deepEqual(resolveVehicleImageSyncMode(['--upload-only']), { apply: false, dryRun: true })
  assert.deepEqual(resolveVehicleImageSyncMode(['--db-only']), { apply: false, dryRun: true })
  assert.deepEqual(resolveVehicleImageSyncMode(['--apply']), { apply: true, dryRun: false })
})

test('explicit and environment dry-run controls override apply', () => {
  assert.deepEqual(resolveVehicleImageSyncMode(['--apply', '--dry-run']), {
    apply: false,
    dryRun: true,
  })
  assert.deepEqual(resolveVehicleImageSyncMode(['--apply'], { environmentDryRun: true }), {
    apply: false,
    dryRun: true,
  })
})

test('literal deny-all policies remain safe for every PostgreSQL policy command', () => {
  assert.equal(isUnsafePublicPolicy({ cmd: 'SELECT', qual: '(false)', with_check: null }), false)
  assert.equal(
    isUnsafePublicPolicy({ cmd: 'SELECT', qual: '((false)::pg_catalog.bool)', with_check: null }),
    false,
  )
  assert.equal(isUnsafePublicPolicy({ cmd: 'DELETE', qual: 'false', with_check: null }), false)
  assert.equal(isUnsafePublicPolicy({ cmd: 'INSERT', qual: null, with_check: 'false' }), false)
  assert.equal(isUnsafePublicPolicy({ cmd: 'UPDATE', qual: 'true', with_check: 'false' }), false)
  assert.equal(isUnsafePublicPolicy({ cmd: 'ALL', qual: 'false', with_check: null }), false)
})

test('permissive or incomplete public policies fail closed for every command', () => {
  assert.equal(isUnsafePublicPolicy({ cmd: 'SELECT', qual: 'true', with_check: null }), true)
  assert.equal(isUnsafePublicPolicy({ cmd: 'DELETE', qual: null, with_check: null }), true)
  assert.equal(isUnsafePublicPolicy({ cmd: 'INSERT', qual: null, with_check: null }), true)
  assert.equal(isUnsafePublicPolicy({ cmd: 'UPDATE', qual: 'true', with_check: 'true' }), true)
  assert.equal(isUnsafePublicPolicy({ cmd: 'ALL', qual: 'false', with_check: 'true' }), true)
  assert.equal(isUnsafePublicPolicy({ cmd: 'FUTURE', qual: 'false', with_check: 'false' }), true)
})
