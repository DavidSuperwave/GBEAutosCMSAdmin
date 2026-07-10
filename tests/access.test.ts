import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ROLES,
  getRoles,
  hasRole,
  isAdmin,
  isMediaReviewer,
  isAdminAccess,
  isAuthenticated,
  canManageInventory,
  canManageContent,
  canManageMedia,
  canManageLeads,
  rolesAccess,
  adminFieldAccess,
  type Role,
} from '../src/access/roles'

type AnyUser = Record<string, unknown> | null | undefined

const asReq = (user: AnyUser) => ({ req: { user } }) as never

const ALL_ROLES = ROLES.map((r) => r.value)

// ---- getRoles: fail-closed resolution -------------------------------------

test('getRoles returns no roles for an unauthenticated user', () => {
  assert.deepEqual(getRoles(null), [])
  assert.deepEqual(getRoles(undefined), [])
})

test('getRoles fails closed for a user with no role', () => {
  assert.deepEqual(getRoles({}), [])
  assert.deepEqual(getRoles({ role: null }), [])
  assert.deepEqual(getRoles({ role: undefined }), [])
})

test('getRoles fails closed for unrecognized role values', () => {
  assert.deepEqual(getRoles({ role: 'superuser' as Role }), [])
  assert.deepEqual(getRoles({ role: '' as Role }), [])
  assert.deepEqual(getRoles({ role: 'ADMIN' as Role }), [])
  assert.deepEqual(getRoles({ roles: ['owner', 'root'] as unknown as Role[] }), [])
  assert.deepEqual(getRoles({ role: 123 as unknown as Role }), [])
})

test('getRoles keeps valid roles and drops invalid ones from mixed input', () => {
  assert.deepEqual(getRoles({ role: 'sales', roles: ['bogus'] as unknown as Role[] }), ['sales'])
  assert.deepEqual(getRoles({ roles: ['general', 'bogus'] as unknown as Role[] }), ['general'])
})

test('getRoles fails closed for retired legacy role values', () => {
  for (const legacy of ['inventory_manager', 'content_editor', 'media_editor', 'sales_manager', 'viewer']) {
    assert.deepEqual(getRoles({ role: legacy as Role }), [])
  }
})

test('getRoles resolves every cataloged role', () => {
  for (const role of ALL_ROLES) {
    assert.deepEqual(getRoles({ role }), [role])
  }
})

// ---- hasRole / isAdmin -----------------------------------------------------

test('hasRole denies roleless and invalid-role users for every role', () => {
  for (const target of ALL_ROLES) {
    assert.equal(hasRole(null, target), false)
    assert.equal(hasRole({}, target), false)
    assert.equal(hasRole({ role: 'bogus' as Role }, target), false)
  }
})

test('isAdmin is true only for a valid admin role', () => {
  assert.equal(isAdmin({ role: 'admin' }), true)
  assert.equal(isAdmin({}), false)
  assert.equal(isAdmin(null), false)
  for (const role of ALL_ROLES.filter((r) => r !== 'admin')) {
    assert.equal(isAdmin({ role }), false)
  }
})

// ---- Access helpers: deny-by-default matrix --------------------------------

const accessMatrix: { name: string; fn: (args: never) => unknown; allowed: Role[] }[] = [
  { name: 'isAdminAccess', fn: isAdminAccess, allowed: ['admin'] },
  { name: 'canManageInventory', fn: canManageInventory, allowed: ['admin', 'general'] },
  { name: 'canManageContent', fn: canManageContent, allowed: ['admin', 'general'] },
  { name: 'canManageMedia', fn: canManageMedia, allowed: ['admin', 'general'] },
  { name: 'canManageLeads', fn: canManageLeads, allowed: ['admin', 'sales'] },
  { name: 'adminFieldAccess', fn: adminFieldAccess, allowed: ['admin'] },
  { name: 'rolesAccess(sales)', fn: rolesAccess('sales'), allowed: ['admin', 'sales'] },
]

test('every role-gated access helper denies anonymous, roleless, and invalid-role users', () => {
  for (const { name, fn } of accessMatrix) {
    assert.equal(fn(asReq(null)), false, `${name} must deny anonymous`)
    assert.equal(fn(asReq({})), false, `${name} must deny roleless`)
    assert.equal(fn(asReq({ role: 'bogus' })), false, `${name} must deny invalid role`)
  }
})

test('every role-gated access helper matches its allow-list exactly', () => {
  for (const { name, fn, allowed } of accessMatrix) {
    for (const role of ALL_ROLES) {
      assert.equal(
        fn(asReq({ role })),
        allowed.includes(role),
        `${name} for role "${role}" should be ${allowed.includes(role)}`,
      )
    }
  }
})

test('isAuthenticated requires a user but no role', () => {
  assert.equal(isAuthenticated(asReq(null)), false)
  assert.equal(isAuthenticated(asReq({})), true)
})

// ---- Media review roles ----------------------------------------------------

test('isMediaReviewer allows only admin and general', () => {
  const allowed: Role[] = ['admin', 'general']
  for (const role of ALL_ROLES) {
    assert.equal(isMediaReviewer({ role }), allowed.includes(role))
  }
  assert.equal(isMediaReviewer({}), false)
  assert.equal(isMediaReviewer(null), false)
})
