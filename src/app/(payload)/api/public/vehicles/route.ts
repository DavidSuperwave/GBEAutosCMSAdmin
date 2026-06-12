import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { findPublicVehicles, optionsFromSearchParams } from '../../../../../services/publicVehicleCatalog'

export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { searchParams } = new URL(request.url)
  const result = await findPublicVehicles(payload, optionsFromSearchParams(searchParams))

  return NextResponse.json(result)
}
