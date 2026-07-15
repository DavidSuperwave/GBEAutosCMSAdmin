import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import type { PublicLeadResult } from '../../../../../contracts/publicIngestion'

const MAX_BODY_BYTES = 32_768
/** Identical submissions inside this window reuse the original lead. */
const REPLAY_WINDOW_MS = 10 * 60 * 1000

function json(body: PublicLeadResult, status: number) {
  return NextResponse.json(body, { status })
}

/**
 * Narrow public lead ingestion (F006). One submission produces exactly one
 * lead; an identical replay within the window is a no-op that returns the
 * original lead id. Field whitelisting, entry-stage limits, and per-IP rate
 * limiting are enforced by the Leads collection ingestion hook.
 */
export async function POST(request: Request) {
  const raw = await request.text().catch(() => '')
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'Cuerpo demasiado grande.' }, 413)
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return json({ ok: false, error: 'Solicitud inválida.' }, 400)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return json({ ok: false, error: 'Solicitud inválida.' }, 400)
  }
  if (typeof data.firstName !== 'string' || data.firstName.trim() === '') {
    return json({ ok: false, error: 'El nombre es requerido.' }, 400)
  }

  const payload = await getPayload({ config })

  // Replay detection: same contact + message + vehicle inside the window.
  const replayClauses = ['phone', 'email', 'message', 'vehicleLabel'].map((field) => {
    const value = data[field]
    return typeof value === 'string' && value !== ''
      ? { [field]: { equals: value } }
      : { [field]: { exists: false } }
  })
  const existing = await payload.find({
    collection: 'leads',
    where: {
      and: [
        { firstName: { equals: data.firstName } },
        ...replayClauses,
        { createdAt: { greater_than: new Date(Date.now() - REPLAY_WINDOW_MS).toISOString() } },
      ],
    },
    limit: 1,
    depth: 0,
    sort: '-createdAt',
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    return json({ ok: true, leadId: existing.docs[0].id, duplicate: true }, 200)
  }

  try {
    const created = await payload.create({
      collection: 'leads',
      data: data as never,
      overrideAccess: false,
      req: { headers: request.headers },
    })
    return json({ ok: true, leadId: created.id, duplicate: false }, 201)
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 429) {
      return json({ ok: false, error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }, 429)
    }
    return json({ ok: false, error: 'No se pudo guardar el lead.' }, 400)
  }
}
