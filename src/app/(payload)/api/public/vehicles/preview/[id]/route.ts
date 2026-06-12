import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { toPublicVehicleDetail } from '../../../../../../../services/publicVehicleCatalog'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const payload = await getPayload({ config })
  const authResult =
    process.env.NODE_ENV === 'production'
      ? await payload.auth({ canSetHeaders: false, headers: request.headers })
      : { user: true }

  if (!authResult.user) {
    return NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 })
  }

  const vehicle = await payload
    .findByID({
      collection: 'vehicles',
      depth: 2,
      id,
    })
    .catch(() => null)

  if (!vehicle) {
    return NextResponse.json({ error: 'Vehiculo no encontrado' }, { status: 404 })
  }

  return NextResponse.json(toPublicVehicleDetail(vehicle as unknown as Record<string, unknown>))
}
