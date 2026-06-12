import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { resolveVehicleCollection } from '../../../../../../services/publicVehicleCatalog'

type RouteContext = {
  params: Promise<{ slug: string }>
}

function numberParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await getPayload({ config })
  const { searchParams } = new URL(request.url)
  const result = await resolveVehicleCollection(payload, slug, {
    page: numberParam(searchParams, 'page'),
    limit: numberParam(searchParams, 'limit'),
  })

  if (!result) {
    return NextResponse.json({ error: 'Coleccion no encontrada' }, { status: 404 })
  }

  return NextResponse.json(result)
}
