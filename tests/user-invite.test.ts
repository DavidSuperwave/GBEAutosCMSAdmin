import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAdminResetUrl,
  canInviteUsers,
  isSmtpReady,
  parseInviteRole,
} from '../src/services/userInvite'

test('only the admin role can see or use the invite workflow', () => {
  assert.equal(canInviteUsers({ role: 'admin' }), true)
  for (const role of ['general', 'sales', 'viewer', '', null, undefined]) {
    assert.equal(canInviteUsers({ role }), false)
  }
  assert.equal(canInviteUsers(null), false)
  assert.equal(canInviteUsers(undefined), false)
})

test('invite role defaults to sales only when the role is omitted', () => {
  assert.deepEqual(parseInviteRole(undefined), { ok: true, role: 'sales' })
})

test('invite role accepts each role in the approved three-role model', () => {
  for (const role of ['admin', 'general', 'sales'] as const) {
    assert.deepEqual(parseInviteRole(role), { ok: true, role })
  }
})

test('invite role rejects invalid values instead of granting a fallback role', () => {
  const invalidValues: unknown[] = [
    null,
    '',
    ' sales ',
    'ADMIN',
    'viewer',
    'inventory_manager',
    1,
    {},
    ['sales'],
  ]

  for (const value of invalidValues) {
    assert.deepEqual(parseInviteRole(value), { ok: false })
  }
})

test('SMTP is ready when all required settings are present and the default port is used', () => {
  assert.equal(
    isSmtpReady({
      SMTP_FROM_EMAIL: 'noreply@example.com',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PASS: 'secret',
      SMTP_USER: 'mailer',
    }),
    true,
  )
})

test('SMTP is not ready when a required setting is missing or blank', () => {
  const complete = {
    SMTP_FROM_EMAIL: 'noreply@example.com',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PASS: 'secret',
    SMTP_PORT: '587',
    SMTP_USER: 'mailer',
  }

  for (const key of ['SMTP_FROM_EMAIL', 'SMTP_HOST', 'SMTP_PASS', 'SMTP_USER'] as const) {
    assert.equal(isSmtpReady({ ...complete, [key]: '   ' }), false)
  }
})

test('SMTP is not ready with an invalid port', () => {
  for (const port of ['0', 'not-a-port', '65536']) {
    assert.equal(
      isSmtpReady({
        SMTP_FROM_EMAIL: 'noreply@example.com',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PASS: 'secret',
        SMTP_PORT: port,
        SMTP_USER: 'mailer',
      }),
      false,
    )
  }
})

test('admin reset URL uses the configured server and safely encodes the token', () => {
  assert.equal(
    buildAdminResetUrl('https://cms.example.com/', 'token/with spaces'),
    'https://cms.example.com/admin/reset/token%2Fwith%20spaces',
  )
})

test('admin reset URL fails closed for a missing or non-http server URL', () => {
  assert.equal(buildAdminResetUrl(undefined, 'token'), null)
  assert.equal(buildAdminResetUrl('javascript:alert(1)', 'token'), null)
  assert.equal(buildAdminResetUrl('https://cms.example.com', ''), null)
})
