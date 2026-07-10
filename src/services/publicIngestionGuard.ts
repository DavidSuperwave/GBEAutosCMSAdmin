/**
 * Hardening for the public (anonymous) create paths on `leads` and
 * `analytics-events` (F006/F022 additive slice).
 *
 * The live Storefront still POSTs to the raw Payload collection endpoints, so
 * this layer must stay additive: legitimate form submissions and analytics
 * beacons pass unchanged, while management-field injection, oversized bodies,
 * and per-IP floods are stopped at ingestion time. The dedicated narrow
 * ingestion endpoints (full F006) land once the Storefront migrates off the
 * raw endpoints.
 *
 * The rate limiter is in-memory per server instance. On serverless that means
 * per-warm-instance buckets — imperfect global enforcement, but it bounds
 * abuse per instance without external infrastructure.
 */

type RateLimitRule = { limit: number; windowMs: number }

export const PUBLIC_LEAD_RATE_LIMIT: RateLimitRule = { limit: 10, windowMs: 10 * 60 * 1000 }
export const PUBLIC_ANALYTICS_RATE_LIMIT: RateLimitRule = { limit: 60, windowMs: 60 * 1000 }

const MAX_TRACKED_KEYS = 10_000

const buckets = new Map<string, number[]>()

/** Sliding-window limiter. Returns true when the key is over its limit. */
export function isRateLimited(
  key: string,
  { limit, windowMs }: RateLimitRule,
  now: number = Date.now(),
): boolean {
  const cutoff = now - windowMs
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return true
  }
  hits.push(now)
  if (buckets.size >= MAX_TRACKED_KEYS && !buckets.has(key)) {
    // Prevent unbounded growth under key-churn abuse: drop expired buckets,
    // then oldest entries if still at the cap.
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= cutoff)) buckets.delete(k)
    }
    if (buckets.size >= MAX_TRACKED_KEYS) {
      const first = buckets.keys().next()
      if (!first.done) buckets.delete(first.value)
    }
  }
  buckets.set(key, hits)
  return false
}

/** Test hook. */
export function resetRateLimits(): void {
  buckets.clear()
}

/** Best-effort client key from proxy headers (Vercel/standard). */
export function clientKeyFromHeaders(
  headers: { get(name: string): string | null } | null | undefined,
): string {
  const forwarded = headers?.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || headers?.get('x-real-ip') || 'unknown'
}

// ---- Input sanitation ------------------------------------------------------

/** Fields an anonymous submitter may set on a lead. Everything else —
 * management fields (stage, assignedTo, contactedBy, contactedAt, notes) and
 * unknown keys — is dropped before validation. */
export const PUBLIC_LEAD_FIELDS: ReadonlySet<string> = new Set([
  'firstName',
  'lastName',
  'email',
  'phone',
  'city',
  'agency',
  'vehicle',
  'vehicleLabel',
  'whatsappNumber',
  'whatsappOpenedAt',
  'sourcePage',
  'sourceSection',
  'leadSource',
  'source',
  'message',
  'stage',
])

/** Entry stages an anonymous submitter may declare (the Storefront sends
 * `whatsapp_opened` when the visitor jumps to WhatsApp). Anything further
 * down the funnel is sales-only. */
export const PUBLIC_LEAD_STAGES: ReadonlySet<string> = new Set(['new', 'whatsapp_opened'])

export const PUBLIC_ANALYTICS_FIELDS: ReadonlySet<string> = new Set([
  'eventType',
  'pagePath',
  'pageTitle',
  'vehicle',
  'vehicleLabel',
  'targetLabel',
  'agency',
  'city',
  'brand',
  'condition',
  'collectionId',
  'leadId',
  'sourceSection',
  'durationSeconds',
  'sessionId',
  'visitorId',
  'deviceType',
  'referrer',
])

const DEFAULT_TEXT_CAP = 500
const TEXT_CAPS: Record<string, number> = {
  message: 2000,
  notes: 2000,
  referrer: 1000,
  pagePath: 1000,
}

type UnknownRecord = Record<string, unknown>

function sanitize(data: UnknownRecord, allowed: ReadonlySet<string>): UnknownRecord {
  const out: UnknownRecord = {}
  for (const [key, value] of Object.entries(data)) {
    if (!allowed.has(key)) continue
    if (typeof value === 'string') {
      const cap = TEXT_CAPS[key] ?? DEFAULT_TEXT_CAP
      out[key] = value.length > cap ? value.slice(0, cap) : value
    } else {
      out[key] = value
    }
  }
  if (typeof out.durationSeconds === 'number') {
    out.durationSeconds = Math.min(Math.max(out.durationSeconds, 0), 86_400)
  }
  return out
}

export function sanitizePublicLeadInput(data: UnknownRecord): UnknownRecord {
  const out = sanitize(data, PUBLIC_LEAD_FIELDS)
  if (typeof out.stage !== 'string' || !PUBLIC_LEAD_STAGES.has(out.stage)) {
    delete out.stage
  }
  return out
}

export function sanitizePublicAnalyticsInput(data: UnknownRecord): UnknownRecord {
  return sanitize(data, PUBLIC_ANALYTICS_FIELDS)
}
