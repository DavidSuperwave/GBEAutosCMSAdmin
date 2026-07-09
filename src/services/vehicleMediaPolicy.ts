import type { Payload } from 'payload'

import { galleryMediaIds, landingMediaIds, relationId, sameRelationId } from './relations'

export { galleryMediaIds, landingMediaIds, relationId, sameRelationId } from './relations'

type RelationValue = string | number | { id?: string | number | null } | null | undefined

/** Rights states that allow media to be published on public surfaces. */
export const APPROVED_RIGHTS = ['owned', 'licensed'] as const
const APPROVED_RIGHTS_SET = new Set<string>(APPROVED_RIGHTS)

/** Whether a media asset's rights status allows it to be published. */
export function isPublishableRights(rights: unknown): boolean {
  return APPROVED_RIGHTS_SET.has(String(rights ?? ''))
}

export type VehicleMediaLookupInput = {
  id?: string | number | null
  image?: unknown
  gallery?: unknown
  landing?: unknown
}

export async function approvedVehicleMediaMap(
  payload: Payload,
  vehicles: VehicleMediaLookupInput[],
): Promise<Map<string, Set<string>>> {
  const vehicleIds = vehicles
    .map((vehicle) => relationId(vehicle.id))
    .filter((id): id is string | number => id !== undefined)
  const mediaIds = vehicles
    .flatMap((vehicle) => [
      relationId(vehicle.image),
      ...galleryMediaIds(vehicle.gallery),
      ...landingMediaIds(vehicle.landing),
    ])
    .filter((id): id is string | number => id !== undefined)

  if (vehicleIds.length === 0 || mediaIds.length === 0) return new Map()

  const result = await payload.find({
    collection: 'vehicle-media-assets',
    depth: 0,
    limit: Math.max(100, vehicleIds.length * Math.max(1, mediaIds.length)),
    overrideAccess: true,
    where: {
      and: [
        { vehicle: { in: [...new Set(vehicleIds.map(String))] } },
        { media: { in: [...new Set(mediaIds.map(String))] } },
        { approvalStatus: { equals: 'approved' } },
        { rightsStatus: { in: APPROVED_RIGHTS as unknown as string[] } },
      ],
    },
  })

  const approved = new Map<string, Set<string>>()
  for (const asset of result.docs as Array<{ vehicle?: RelationValue; media?: RelationValue }>) {
    const vehicleId = relationId(asset.vehicle)
    const mediaId = relationId(asset.media)
    if (vehicleId === undefined || mediaId === undefined) continue
    const key = String(vehicleId)
    const set = approved.get(key) || new Set<string>()
    set.add(String(mediaId))
    approved.set(key, set)
  }

  return approved
}

export async function isApprovedVehicleMedia(
  payload: Payload,
  vehicleId: unknown,
  mediaId: unknown,
): Promise<boolean> {
  const vehicle = relationId(vehicleId)
  const media = relationId(mediaId)
  if (vehicle === undefined || media === undefined) return false
  const approved = await approvedVehicleMediaMap(payload, [{ id: vehicle, image: media }])
  return Boolean(approved.get(String(vehicle))?.has(String(media)))
}

type AssignTarget = 'hero' | 'gallery'

export async function assignApprovedVehicleMediaAsset({
  payload,
  vehicleId,
  assetId,
  target,
  req,
}: {
  payload: Payload
  vehicleId: string | number
  assetId: string | number
  target: AssignTarget
  req?: unknown
}) {
  const asset = (await payload
    .findByID({ collection: 'vehicle-media-assets', id: assetId, depth: 0, overrideAccess: true })
    .catch(() => null)) as
    | {
        id?: string | number
        vehicle?: unknown
        media?: unknown
        approvalStatus?: string | null
        rightsStatus?: string | null
        usage?: unknown
      }
    | null

  if (!asset?.id) {
    const error = new Error('La imagen aprobada no existe.')
    ;(error as Error & { status?: number }).status = 404
    throw error
  }

  const assetVehicleId = relationId(asset.vehicle)
  if (assetVehicleId != null && !sameRelationId(assetVehicleId, vehicleId)) {
    const error = new Error('La imagen pertenece a otro vehiculo.')
    ;(error as Error & { status?: number }).status = 400
    throw error
  }

  const mediaId = relationId(asset.media)
  if (mediaId == null) {
    const error = new Error('La imagen no tiene un archivo Media asociado.')
    ;(error as Error & { status?: number }).status = 400
    throw error
  }

  if (asset.approvalStatus !== 'approved' || !isPublishableRights(asset.rightsStatus)) {
    const error = new Error('Solo imagenes aprobadas y con derechos claros pueden publicarse.')
    ;(error as Error & { status?: number }).status = 409
    throw error
  }

  const vehicle = (await payload.findByID({
    collection: 'vehicles',
    id: vehicleId,
    depth: 0,
    overrideAccess: true,
  })) as {
    gallery?: Array<{ image?: unknown; alt?: string | null }> | null
  }

  const previousAsset = {
    vehicle: asset.vehicle,
    usage: asset.usage,
  }

  await payload.update({
    collection: 'vehicle-media-assets',
    id: asset.id,
    data: {
      vehicle: vehicleId,
      usage: target === 'hero' ? 'vehicle_hero' : 'vehicle_gallery',
    } as never,
    overrideAccess: true,
    req: req as never,
  })

  try {
    if (target === 'hero') {
      await payload.update({
        collection: 'vehicles',
        id: vehicleId,
        data: { image: mediaId, imageStatus: 'approved' } as never,
        overrideAccess: true,
        req: req as never,
      })
    } else {
      const gallery = Array.isArray(vehicle.gallery) ? vehicle.gallery : []
      const exists = gallery.some((item) => sameRelationId(relationId(item?.image), mediaId))
      await payload.update({
        collection: 'vehicles',
        id: vehicleId,
        data: {
          gallery: exists ? gallery : [...gallery, { image: mediaId }],
        } as never,
        overrideAccess: true,
        req: req as never,
      })
    }
  } catch (error) {
    await payload
      .update({
        collection: 'vehicle-media-assets',
        id: asset.id,
        data: previousAsset as never,
        overrideAccess: true,
        req: req as never,
      })
      .catch(() => null)
    throw error
  }

  return { assetId: asset.id, mediaId, target }
}
