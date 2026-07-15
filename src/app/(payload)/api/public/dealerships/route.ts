import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import type { PublicDealership, PublicDealershipList } from '../../../../../contracts/publicIngestion'
import type { Dealership } from '../../../../../payload-types'

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null

const publicUrl = (value: unknown): string | null => {
  const candidate = text(value)
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function toPublicDealership(doc: Dealership): PublicDealership {
  return {
    id: doc.id,
    brandName: doc.brandName,
    displayName: doc.displayName,
    city: doc.city,
    state: text(doc.state),
    address: text(doc.address),
    phone: text(doc.phone),
    whatsapp: text(doc.whatsapp),
    email: text(doc.email),
    hours: text(doc.hours),
    websiteUrl: publicUrl(doc.websiteUrl),
    mapUrl: publicUrl(doc.mapUrl),
    defaultForCity: Boolean(doc.defaultForCity),
  }
}

/** Bounded public dealership directory: active agencies only, safe fields
 * only. Replaces the Storefront's raw `/api/dealerships` consumption. */
export async function GET() {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'dealerships',
    where: { isActive: { equals: true } },
    limit: 200,
    depth: 0,
    sort: 'displayName',
    overrideAccess: true,
  })

  const body: PublicDealershipList = { docs: result.docs.map(toPublicDealership) }
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}
