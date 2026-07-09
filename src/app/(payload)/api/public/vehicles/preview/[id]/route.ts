import { NextResponse } from 'next/server'

import { requireCmsRole } from '../../../../../../../services/cmsRequestAuth'
import { toPublicVehicleDetail } from '../../../../../../../services/publicVehicleCatalog'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const auth = await requireCmsRole(
    request,
    ['inventory_manager', 'content_editor'],
    'Sin permisos para previsualizar vehiculos.',
  )
  if (auth.response) return auth.response
  const { payload } = auth

  const vehicle = await payload
    .findByID({
      collection: 'vehicles',
      depth: 2,
      id,
      overrideAccess: true,
    })
    .catch(() => null)

  if (!vehicle) {
    return NextResponse.json({ error: 'Vehiculo no encontrado' }, { status: 404 })
  }

  return NextResponse.json(await toPublicVehicleDetail(payload, vehicle as unknown as Record<string, unknown>))
}
