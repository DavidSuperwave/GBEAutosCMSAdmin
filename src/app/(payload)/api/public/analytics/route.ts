import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { ANALYTICS_EVENT_TYPES } from '../../../../../contracts/analytics'

const MAX_BODY_BYTES = 16_384

/**
 * Narrow public analytics ingestion (F006). Taxonomy-validated, size-capped,
 * per-IP rate-limited (via the AnalyticsEvents ingestion hook). Events are
 * fire-and-forget for the Storefront; failures return JSON but should never
 * block the visitor journey.
 */
export async function POST(request: Request) {
  const raw = await request.text().catch(() => '')
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: 'Cuerpo demasiado grande.' }, { status: 413 })
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 })
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 })
  }
  if (!ANALYTICS_EVENT_TYPES.includes(data.eventType as never)) {
    return NextResponse.json({ ok: false, error: 'Tipo de evento desconocido.' }, { status: 400 })
  }
  if (typeof data.pagePath !== 'string' || data.pagePath.trim() === '') {
    return NextResponse.json({ ok: false, error: 'pagePath es requerido.' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  try {
    const created = await payload.create({
      collection: 'analytics-events',
      data: data as never,
      overrideAccess: false,
      req: { headers: request.headers },
    })
    return NextResponse.json({ ok: true, eventId: created.id }, { status: 201 })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 429) {
      return NextResponse.json({ ok: false, error: 'Demasiadas solicitudes.' }, { status: 429 })
    }
    return NextResponse.json({ ok: false, error: 'No se pudo registrar el evento.' }, { status: 400 })
  }
}
