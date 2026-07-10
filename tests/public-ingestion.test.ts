import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PUBLIC_ANALYTICS_RATE_LIMIT,
  PUBLIC_LEAD_RATE_LIMIT,
  clientKeyFromHeaders,
  isRateLimited,
  resetRateLimits,
  sanitizePublicAnalyticsInput,
  sanitizePublicLeadInput,
} from '../src/services/publicIngestionGuard'

// ---- rate limiter ----------------------------------------------------------

test('rate limiter allows up to the limit and blocks the next hit', () => {
  resetRateLimits()
  const rule = { limit: 3, windowMs: 1000 }
  const t0 = 1_000_000
  assert.equal(isRateLimited('k', rule, t0), false)
  assert.equal(isRateLimited('k', rule, t0 + 1), false)
  assert.equal(isRateLimited('k', rule, t0 + 2), false)
  assert.equal(isRateLimited('k', rule, t0 + 3), true)
})

test('rate limiter window slides: old hits expire', () => {
  resetRateLimits()
  const rule = { limit: 2, windowMs: 1000 }
  const t0 = 5_000_000
  assert.equal(isRateLimited('k', rule, t0), false)
  assert.equal(isRateLimited('k', rule, t0 + 10), false)
  assert.equal(isRateLimited('k', rule, t0 + 20), true)
  assert.equal(isRateLimited('k', rule, t0 + 1500), false)
})

test('rate limiter tracks keys independently', () => {
  resetRateLimits()
  const rule = { limit: 1, windowMs: 1000 }
  const t0 = 9_000_000
  assert.equal(isRateLimited('a', rule, t0), false)
  assert.equal(isRateLimited('b', rule, t0), false)
  assert.equal(isRateLimited('a', rule, t0 + 1), true)
})

test('shipped limits are storefront-compatible (generous)', () => {
  assert.ok(PUBLIC_LEAD_RATE_LIMIT.limit >= 5)
  assert.ok(PUBLIC_ANALYTICS_RATE_LIMIT.limit >= 30)
})

// ---- client key ------------------------------------------------------------

test('clientKeyFromHeaders prefers first x-forwarded-for hop', () => {
  const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1', 'x-real-ip': '9.9.9.9' })
  assert.equal(clientKeyFromHeaders(headers), '1.2.3.4')
  assert.equal(clientKeyFromHeaders(new Headers({ 'x-real-ip': '9.9.9.9' })), '9.9.9.9')
  assert.equal(clientKeyFromHeaders(new Headers()), 'unknown')
  assert.equal(clientKeyFromHeaders(null), 'unknown')
})

// ---- lead sanitation -------------------------------------------------------

test('public lead input drops management and unknown fields', () => {
  const out = sanitizePublicLeadInput({
    firstName: 'Ana',
    phone: '5512345678',
    message: 'Me interesa',
    stage: 'closed_won',
    assignedTo: 1,
    contactedBy: 1,
    contactedAt: '2026-07-10',
    notes: 'injected',
    isAdmin: true,
    unknown: 'x',
  })
  assert.deepEqual(out, { firstName: 'Ana', phone: '5512345678', message: 'Me interesa' })
})

test('public lead input keeps legitimate storefront routing fields', () => {
  const input = {
    firstName: 'Ana',
    lastName: 'García',
    email: 'a@example.com',
    phone: '5512345678',
    city: 'CDMX',
    agency: 3,
    vehicle: 42,
    vehicleLabel: 'Toyota Hilux 2023',
    whatsappNumber: '+525512345678',
    whatsappOpenedAt: '2026-07-10T12:00:00Z',
    sourcePage: '/vehiculos/toyota-hilux',
    sourceSection: 'hero',
    leadSource: 'whatsapp_vehicle_form',
    source: 'website_form',
    message: 'Hola',
  }
  assert.deepEqual(sanitizePublicLeadInput(input), input)
})

test('public lead input caps oversized strings', () => {
  const out = sanitizePublicLeadInput({
    firstName: 'x'.repeat(10_000),
    message: 'y'.repeat(10_000),
  })
  assert.equal((out.firstName as string).length, 500)
  assert.equal((out.message as string).length, 2000)
})

// ---- analytics sanitation --------------------------------------------------

test('public analytics input keeps taxonomy fields and drops unknown keys', () => {
  const out = sanitizePublicAnalyticsInput({
    eventType: 'page_view',
    pagePath: '/autos',
    sessionId: 's1',
    visitorId: 'v1',
    deviceType: 'mobile',
    referrer: 'https://google.com',
    injected: { $set: 'nope' },
  })
  assert.deepEqual(out, {
    eventType: 'page_view',
    pagePath: '/autos',
    sessionId: 's1',
    visitorId: 'v1',
    deviceType: 'mobile',
    referrer: 'https://google.com',
  })
})

test('public analytics input clamps durationSeconds', () => {
  assert.equal(sanitizePublicAnalyticsInput({ durationSeconds: -5 }).durationSeconds, 0)
  assert.equal(sanitizePublicAnalyticsInput({ durationSeconds: 999_999 }).durationSeconds, 86_400)
  assert.equal(sanitizePublicAnalyticsInput({ durationSeconds: 30 }).durationSeconds, 30)
})
