import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { toPublicVehicleDetail } from '../../../../../../services/publicVehicleCatalog'

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'vehicles',
    depth: 2,
    limit: 1,
    where: {
      and: [
        { slug: { equals: slug } },
        { publishStatus: { equals: 'published' } },
        { inventoryStatus: { not_equals: 'sold' } },
      ],
    },
  })

  const vehicle = result.docs[0]
  if (!vehicle) {
    return NextResponse.json({ error: 'Vehiculo no encontrado' }, { status: 404 })
  }

  return NextResponse.json(toPublicVehicleDetail(vehicle as unknown as Record<string, unknown>))
}
