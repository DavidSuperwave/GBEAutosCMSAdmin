import { NextResponse } from 'next/server'

import { MEDIA_REVIEW_ROLES } from '../../../../../../access/roles'
import { requireCmsRole } from '../../../../../../services/cmsRequestAuth'
import {
  assignApprovedVehicleMediaAsset,
  relationId,
  sameRelationId,
} from '../../../../../../services/vehicleMediaPolicy'

type ReviewBody = {
  assetId?: number | string
  decision?: 'approve_owned' | 'approve_licensed' | 'reject'
  assignTo?: 'hero' | 'gallery'
  vehicleId?: number | string
}

export async function POST(request: Request) {
  let body: ReviewBody
  try {
    body = (await request.json()) as ReviewBody
  } catch {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400 })
  }

  const { assetId, decision, assignTo, vehicleId } = body
  if (!assetId || !decision) {
    return NextResponse.json({ error: 'assetId y decision son requeridos.' }, { status: 400 })
  }
  if (!['approve_owned', 'approve_licensed', 'reject'].includes(decision)) {
    return NextResponse.json({ error: 'Decision no soportada.' }, { status: 400 })
  }
  if (assignTo && assignTo !== 'hero' && assignTo !== 'gallery') {
    return NextResponse.json({ error: 'assignTo debe ser hero o gallery.' }, { status: 400 })
  }

  const auth = await requireCmsRole(request, MEDIA_REVIEW_ROLES, 'Sin permisos para revisar imagenes.')
  if (auth.response) return auth.response
  const { payload, user } = auth

  const reqContext = { user }
  const existing = (await payload
    .findByID({ collection: 'vehicle-media-assets', id: assetId, depth: 0, overrideAccess: true })
    .catch(() => null)) as
    | {
        id?: string | number
        vehicle?: unknown
        media?: unknown
      }
    | null

  if (!existing?.id) {
    return NextResponse.json({ error: 'La imagen no existe.' }, { status: 404 })
  }

  const assetVehicleId = relationId(existing.vehicle)
  if (vehicleId && assetVehicleId != null && !sameRelationId(assetVehicleId, vehicleId)) {
    return NextResponse.json({ error: 'La imagen pertenece a otro vehiculo.' }, { status: 400 })
  }

  const reviewData =
    decision === 'reject'
      ? {
          approvalStatus: 'rejected',
          rightsStatus: 'unknown',
          usage: null,
        }
      : {
          approvalStatus: 'approved',
          rightsStatus: decision === 'approve_owned' ? 'owned' : 'licensed',
        }

  const asset = await payload.update({
    collection: 'vehicle-media-assets',
    id: existing.id,
    data: reviewData as never,
    overrideAccess: true,
    req: reqContext,
  })

  if (decision === 'reject') {
    // Detach the rejected media from the vehicle so it doesn't stay published
    // as hero/gallery while pointing at media that failed review.
    const mediaId = relationId(existing.media)
    const targetVehicleId = vehicleId || assetVehicleId
    if (mediaId != null && targetVehicleId != null) {
      const vehicle = (await payload
        .findByID({ collection: 'vehicles', id: targetVehicleId, depth: 0, overrideAccess: true })
        .catch(() => null)) as
        | {
            image?: unknown
            gallery?: Array<{ image?: unknown }> | null
            publishStatus?: string | null
          }
        | null
      if (vehicle) {
        const heroRejected = sameRelationId(vehicle.image, mediaId)
        const gallery = Array.isArray(vehicle.gallery) ? vehicle.gallery : []
        const nextGallery = gallery.filter((item) => !sameRelationId(item?.image, mediaId))
        const detach: Record<string, unknown> = {}
        if (heroRejected) {
          detach.image = null
          detach.imageStatus = 'rejected'
          if (vehicle.publishStatus === 'published') detach.publishStatus = 'needs_review'
        }
        if (nextGallery.length !== gallery.length) detach.gallery = nextGallery
        if (Object.keys(detach).length > 0) {
          await payload.update({
            collection: 'vehicles',
            id: targetVehicleId,
            data: detach as never,
            overrideAccess: true,
            req: reqContext,
          })
        }
      }
    }
    return NextResponse.json({ ok: true, asset })
  }

  if (!assignTo) {
    return NextResponse.json({ ok: true, asset })
  }

  const targetVehicleId = vehicleId || assetVehicleId
  if (targetVehicleId == null) {
    return NextResponse.json({ error: 'Falta vehicleId para publicar la imagen.' }, { status: 400 })
  }

  try {
    const assigned = await assignApprovedVehicleMediaAsset({
      payload,
      vehicleId: targetVehicleId,
      assetId: existing.id,
      target: assignTo,
      req: reqContext,
    })
    return NextResponse.json({ ok: true, asset, assigned })
  } catch (error) {
    const status = Number((error as Error & { status?: number }).status) || 500
    const message = error instanceof Error ? error.message : 'No se pudo publicar la imagen aprobada.'
    return NextResponse.json({ error: message }, { status })
  }
}
