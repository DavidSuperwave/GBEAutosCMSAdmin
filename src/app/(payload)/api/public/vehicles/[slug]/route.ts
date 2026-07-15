import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { findPublicVehicleBySlug } from '../../../../../../services/publicVehicleCatalog'

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await getPayload({ config })

  const vehicle = await findPublicVehicleBySlug(payload, slug)
  if (!vehicle) {
    return NextResponse.json({ error: 'Vehiculo no encontrado' }, { status: 404 })
  }

  return NextResponse.json(vehicle)
}
