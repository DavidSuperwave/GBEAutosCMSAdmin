import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { findPublicCollections } from '../../../../../services/publicVehicleCatalog'

function numberParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { searchParams } = new URL(request.url)
  const result = await findPublicCollections(payload, {
    page: numberParam(searchParams, 'page'),
    limit: numberParam(searchParams, 'limit'),
  })

  return NextResponse.json(result)
}
