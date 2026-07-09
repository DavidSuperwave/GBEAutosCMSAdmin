import type { Payload, Where } from 'payload'

import { approvedVehicleMediaMap } from './vehicleMediaPolicy'
import { relationId, relationIds } from './relations'
import { SPEC_KEYS } from './vehicleWorkflow'

type JsonRecord = Record<string, unknown>
type RelationValue = string | number | JsonRecord | null | undefined

export type PublicVehicleCard = {
  id: string
  slug: string
  title: string
  condition: 'new' | 'used'
  inventoryStatus: 'available' | 'reserved' | 'sold'
  brand: string
  model: string
  modelFamily?: string
  trim?: string
  year?: number
  priceLabel?: string
  mileage?: number
  city?: string
  agencyName?: string
  exteriorColor?: string
  bodyType?: string
  segment?: string
  fuel?: string
  transmission?: string
  tags: string[]
  image?: { url: string; alt?: string }
  stats?: {
    views?: number
    leads?: number
  }
}

export type PublicVehicleDetail = PublicVehicleCard & {
  description?: string
  features: string[]
  gallery: Array<{ url: string; alt?: string }>
  landing: PublicLandingBlock[]
  specs?: Record<string, unknown>
  templateOverrides?: Record<string, unknown>
}

export type PublicLandingBlock =
  | {
      blockType: 'imageText'
      eyebrow?: string
      heading: string
      body?: string
      image?: { url: string; alt?: string }
      imagePosition?: 'left' | 'right'
    }
  | {
      blockType: 'gallery'
      heading?: string
      images: Array<{ image: { url: string; alt?: string }; alt?: string }>
    }
  | {
      blockType: 'highlightList'
      heading: string
      body?: string
      items: Array<{ label: string; description?: string }>
    }
  | {
      blockType: 'featureGrid'
      heading: string
      items: string[]
    }
  | {
      blockType: 'cta'
      heading: string
      body?: string
      buttonLabel?: string
    }

export type PublicVehicleListOptions = {
  page?: number
  limit?: number
  sort?: string
  keyword?: string
  brand?: string
  model?: string
  modelFamily?: string
  city?: string
  agency?: string
  yearMin?: number
  yearMax?: number
  mileageMin?: number
  mileageMax?: number
  bodyType?: string
  segment?: string
  vehicleType?: string
  fuel?: string
  transmission?: string
  condition?: string
  inventoryStatus?: string
  tags?: string[]
}

type PublicVehicleListResult = {
  docs: PublicVehicleCard[]
  totalDocs: number
  totalPages: number
  page: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

type PublicSerializationOptions = {
  approvedMediaIds?: Set<string>
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function numberValue(value: unknown): number | undefined {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

function relationDoc(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' ? (value as JsonRecord) : undefined
}

export function toPublicImage(value: unknown): PublicVehicleCard['image'] {
  const media = relationDoc(value)
  const url = text(media?.url || media?.thumbnailURL)
  if (!url) return undefined
  const alt = text(media?.alt)
  return alt ? { url, alt } : { url }
}

function titleForVehicle(vehicle: JsonRecord): string {
  return [vehicle.year, vehicle.brand, vehicle.model, vehicle.trim].map(text).filter(Boolean).join(' ')
}

function tagLabels(vehicle: JsonRecord): string[] {
  const tags = Array.isArray(vehicle.tags)
    ? vehicle.tags
        .map((tag) => {
          if (tag && typeof tag === 'object') {
            const doc = tag as JsonRecord
            return text(doc.label || doc.name || doc.slug)
          }
          return ''
        })
        .filter(Boolean)
    : []

  const badges = Array.isArray(vehicle.badges)
    ? vehicle.badges
        .map((badge) => (badge && typeof badge === 'object' ? text((badge as JsonRecord).label) : ''))
        .filter(Boolean)
    : []

  return Array.from(new Set([...tags, ...badges]))
}

function sortToPayload(sort?: string): string {
  switch (sort) {
    case 'priceAsc':
      return 'price'
    case 'priceDesc':
      return '-price'
    case 'mileageAsc':
      return 'mileage'
    case 'yearDesc':
      return '-year'
    case 'newest':
    case 'mostViewed':
    case 'mostClicked':
    case 'mostLeads':
    default:
      return '-createdAt'
  }
}

async function resolveTagIDs(payload: Payload, tags?: string[]) {
  const cleaned = (tags || []).map(text).filter(Boolean)
  if (cleaned.length === 0) return []

  const ids = cleaned.filter((tag) => /^\d+$/.test(tag))
  const slugs = cleaned.filter((tag) => !/^\d+$/.test(tag))

  if (slugs.length === 0) return ids

  const result = await payload.find({
    collection: 'vehicle-tags',
    depth: 0,
    limit: 100,
    where: {
      slug: {
        in: slugs,
      },
    },
  })

  return [...ids, ...result.docs.map((doc) => String(doc.id))]
}

async function buildVehicleWhere(payload: Payload, options: PublicVehicleListOptions): Promise<Where> {
  const and: JsonRecord[] = [
    { publishStatus: { equals: 'published' } },
    { inventoryStatus: { not_equals: 'sold' } },
  ]

  const equalsFields: Array<[keyof PublicVehicleListOptions, string]> = [
    ['brand', 'brand'],
    ['model', 'model'],
    ['modelFamily', 'modelFamily'],
    ['city', 'city'],
    ['bodyType', 'bodyType'],
    ['segment', 'segment'],
    ['vehicleType', 'vehicleType'],
    ['fuel', 'fuel'],
    ['transmission', 'transmission'],
    ['condition', 'condition'],
  ]

  for (const [optionKey, fieldName] of equalsFields) {
    const value = text(options[optionKey])
    if (value) and.push({ [fieldName]: { equals: value } })
  }

  if (options.inventoryStatus) {
    and.push({ inventoryStatus: { equals: options.inventoryStatus } })
  }

  if (options.agency) {
    and.push({ dealership: { equals: options.agency } })
  }

  if (options.yearMin !== undefined) and.push({ year: { greater_than_equal: options.yearMin } })
  if (options.yearMax !== undefined) and.push({ year: { less_than_equal: options.yearMax } })
  if (options.mileageMin !== undefined) and.push({ mileage: { greater_than_equal: options.mileageMin } })
  if (options.mileageMax !== undefined) and.push({ mileage: { less_than_equal: options.mileageMax } })

  if (options.keyword) {
    const keyword = options.keyword
    and.push({
      or: [
        { brand: { contains: keyword } },
        { model: { contains: keyword } },
        { modelFamily: { contains: keyword } },
        { trim: { contains: keyword } },
        { stockId: { contains: keyword } },
      ],
    })
  }

  const tagIDs = await resolveTagIDs(payload, options.tags)
  if (tagIDs.length > 0) {
    and.push({ tags: { in: tagIDs } })
  }

  return (and.length === 1 ? and[0] : { and }) as Where
}

export function toPublicVehicleCard(
  vehicle: JsonRecord,
  options: PublicSerializationOptions = {},
): PublicVehicleCard {
  const dealership = relationDoc(vehicle.dealership)
  const condition = vehicle.condition === 'used' ? 'used' : 'new'
  const inventoryStatus =
    vehicle.inventoryStatus === 'reserved' || vehicle.inventoryStatus === 'sold'
      ? vehicle.inventoryStatus
      : 'available'
  const heroMediaId = relationId(vehicle.image)
  const approvedHero =
    heroMediaId !== undefined && Boolean(options.approvedMediaIds?.has(String(heroMediaId)))

  return {
    id: String(vehicle.id),
    slug: text(vehicle.slug),
    title: titleForVehicle(vehicle),
    condition,
    inventoryStatus,
    brand: text(vehicle.brand),
    model: text(vehicle.model),
    modelFamily: text(vehicle.modelFamily) || undefined,
    trim: text(vehicle.trim) || undefined,
    year: numberValue(vehicle.year),
    priceLabel: text(vehicle.price) || undefined,
    mileage: numberValue(vehicle.mileage),
    city: text(vehicle.city || dealership?.city) || undefined,
    agencyName: text(dealership?.displayName || dealership?.brandName) || undefined,
    exteriorColor: text(vehicle.exteriorColor) || undefined,
    bodyType: text(vehicle.bodyType) || undefined,
    segment: text(vehicle.segment) || undefined,
    fuel: text(vehicle.fuel) || undefined,
    transmission: text(vehicle.transmission) || undefined,
    tags: tagLabels(vehicle),
    image:
      vehicle.imageStatus === 'approved' && approvedHero
        ? toPublicImage(vehicle.image as RelationValue)
        : undefined,
  }
}

function featureLabels(vehicle: JsonRecord): string[] {
  return Array.isArray(vehicle.features)
    ? vehicle.features
        .map((item) => (item && typeof item === 'object' ? text((item as JsonRecord).feature) : text(item)))
        .filter(Boolean)
    : []
}

function galleryImages(
  vehicle: JsonRecord,
  options: PublicSerializationOptions = {},
): PublicVehicleDetail['gallery'] {
  return Array.isArray(vehicle.gallery)
    ? vehicle.gallery
        .map((item) => {
          if (!item || typeof item !== 'object') return undefined
          const mediaId = relationId((item as JsonRecord).image)
          if (mediaId === undefined || !options.approvedMediaIds?.has(String(mediaId))) return undefined
          return toPublicImage((item as JsonRecord).image)
        })
        .filter((item): item is { url: string; alt?: string } => Boolean(item?.url))
    : []
}

function approvedPublicImage(
  value: unknown,
  options: PublicSerializationOptions = {},
): PublicVehicleCard['image'] {
  const mediaId = relationId(value)
  if (mediaId === undefined || !options.approvedMediaIds?.has(String(mediaId))) return undefined
  return toPublicImage(value)
}

function stringItems(values: unknown, key: string): string[] {
  if (!Array.isArray(values)) return []
  return values
    .map((value) => (value && typeof value === 'object' ? text((value as JsonRecord)[key]) : text(value)))
    .filter(Boolean)
}

export function serializePublicLandingBlocks(
  landing: unknown,
  options: PublicSerializationOptions = {},
): PublicLandingBlock[] {
  if (!Array.isArray(landing)) return []

  return landing
    .map((block): PublicLandingBlock | undefined => {
      if (!block || typeof block !== 'object') return undefined
      const record = block as JsonRecord
      const blockType = text(record.blockType)
      const heading = text(record.heading)
      const body = text(record.body)

      if (blockType === 'imageText') {
        if (!heading) return undefined
        const image = approvedPublicImage(record.image, options)
        return {
          blockType: 'imageText',
          eyebrow: text(record.eyebrow) || undefined,
          heading,
          body: body || undefined,
          image,
          imagePosition: record.imagePosition === 'right' ? 'right' : 'left',
        }
      }

      if (blockType === 'gallery') {
        const images = Array.isArray(record.images)
          ? record.images
              .map((item) => {
                if (!item || typeof item !== 'object') return undefined
                const itemRecord = item as JsonRecord
                const image = approvedPublicImage(itemRecord.image, options)
                if (!image) return undefined
                const alt = text(itemRecord.alt) || image.alt || undefined
                return {
                  image,
                  ...(alt ? { alt } : {}),
                }
              })
              .filter((item): item is { image: { url: string; alt?: string }; alt?: string } => Boolean(item))
          : []
        return images.length ? { blockType: 'gallery', heading: heading || undefined, images } : undefined
      }

      if (blockType === 'highlightList') {
        const items = Array.isArray(record.items)
          ? record.items
              .map((item) => {
                const itemRecord = relationDoc(item) || {}
                const label = text(itemRecord.label)
                const description = text(itemRecord.description) || undefined
                return label
                  ? {
                      label,
                      ...(description ? { description } : {}),
                    }
                  : undefined
              })
              .filter((item): item is { label: string; description?: string } => Boolean(item))
          : []
        return heading || body || items.length
          ? { blockType: 'highlightList', heading: heading || 'Puntos clave', body: body || undefined, items }
          : undefined
      }

      if (blockType === 'featureGrid') {
        const items = stringItems(record.items, 'feature')
        return heading || items.length
          ? { blockType: 'featureGrid', heading: heading || 'Beneficios', items }
          : undefined
      }

      if (blockType === 'cta') {
        return heading
          ? {
              blockType: 'cta',
              heading,
              body: body || undefined,
              buttonLabel: text(record.buttonLabel) || undefined,
            }
          : undefined
      }

      return undefined
    })
    .filter((block): block is PublicLandingBlock => Boolean(block))
}

function publicSpecs(value: unknown): Record<string, unknown> | undefined {
  const specs = relationDoc(value)
  if (!specs) return undefined
  const result = Object.fromEntries(SPEC_KEYS.map((key) => [key, specs[key]]).filter(([, value]) => text(value)))
  return Object.keys(result).length ? result : undefined
}

function publicTemplateOverrides(value: unknown): Record<string, unknown> | undefined {
  const overrides = relationDoc(value)
  if (!overrides) return undefined
  const allowed = [
    'gallery',
    'purchaseCard',
    'quickSpecs',
    'description',
    'features',
    'similarVehicles',
    'mobileCta',
  ]
  const result = Object.fromEntries(
    allowed
      .map((key) => [key, overrides[key]])
      .filter(([, value]) => value === 'inherit' || value === 'show' || value === 'hide'),
  )
  return Object.keys(result).length ? result : undefined
}

export async function toPublicVehicleDetail(
  payload: Payload,
  vehicle: JsonRecord,
): Promise<PublicVehicleDetail> {
  const approved = await approvedVehicleMediaMap(payload, [
    {
      id: relationId(vehicle.id),
      image: vehicle.image as RelationValue,
      gallery: vehicle.gallery,
      landing: vehicle.landing,
    },
  ])
  const options = { approvedMediaIds: approved.get(String(relationId(vehicle.id))) }

  return {
    ...toPublicVehicleCard(vehicle, options),
    description: text(vehicle.description) || undefined,
    features: featureLabels(vehicle),
    gallery: galleryImages(vehicle, options),
    landing: serializePublicLandingBlocks(vehicle.landing, options),
    specs: publicSpecs(vehicle.specs),
    templateOverrides: publicTemplateOverrides(vehicle.templateOverrides),
  }
}

/**
 * Fetch one publicly-visible vehicle by slug, applying the same base
 * visibility rules as the public list (published, not sold). Returns the
 * fully serialized public detail or null when not visible.
 */
export async function findPublicVehicleBySlug(
  payload: Payload,
  slug: string,
): Promise<PublicVehicleDetail | null> {
  const visibility = await buildVehicleWhere(payload, {})
  const result = await payload.find({
    collection: 'vehicles',
    depth: 2,
    limit: 1,
    overrideAccess: true,
    where: { and: [{ slug: { equals: slug } }, visibility] } as Where,
  })

  const vehicle = result.docs[0] as unknown as JsonRecord | undefined
  if (!vehicle) return null
  return toPublicVehicleDetail(payload, vehicle)
}

export async function findPublicVehicles(
  payload: Payload,
  options: PublicVehicleListOptions,
): Promise<PublicVehicleListResult> {
  const page = Math.max(1, Number(options.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 24))
  const where = await buildVehicleWhere(payload, options)

  const result = await payload.find({
    collection: 'vehicles',
    depth: 2,
    limit,
    overrideAccess: true,
    page,
    sort: sortToPayload(options.sort),
    where,
  })
  const vehicles = result.docs as unknown as JsonRecord[]
  const approved = await approvedVehicleMediaMap(
    payload,
    vehicles.map((vehicle) => ({
      id: relationId(vehicle.id),
      image: vehicle.image as RelationValue,
      gallery: vehicle.gallery,
    })),
  )

  return {
    docs: vehicles.map((doc) =>
      toPublicVehicleCard(doc, { approvedMediaIds: approved.get(String(relationId(doc.id))) }),
    ),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page || page,
    limit: result.limit || limit,
    hasNextPage: Boolean(result.hasNextPage),
    hasPrevPage: Boolean(result.hasPrevPage),
  }
}

function rulesToOptions(collection: JsonRecord, limit?: number): PublicVehicleListOptions {
  const rules = (collection.rules && typeof collection.rules === 'object' ? collection.rules : {}) as JsonRecord
  const tags = relationIds(rules.tags).map(String)

  return {
    brand: text(rules.brand) || undefined,
    city: text(rules.city) || undefined,
    agency: relationId(rules.dealership as RelationValue)?.toString(),
    bodyType: text(rules.bodyType) || undefined,
    segment: text(rules.segment) || undefined,
    vehicleType: text(rules.vehicleType) || undefined,
    fuel: text(rules.fuel) || undefined,
    transmission: text(rules.transmission) || undefined,
    condition: text(rules.condition) || undefined,
    inventoryStatus: text(rules.inventoryStatus) || undefined,
    sort: text(collection.sort) || 'newest',
    limit: limit || numberValue(collection.limit) || 12,
    tags,
  }
}

export async function resolveVehicleCollection(
  payload: Payload,
  collectionSlugOrID: string,
  options: Pick<PublicVehicleListOptions, 'page' | 'limit'> = {},
) {
  const collectionLookup: Where[] = [{ slug: { equals: collectionSlugOrID } }]
  if (/^\d+$/.test(collectionSlugOrID)) {
    collectionLookup.push({ id: { equals: Number(collectionSlugOrID) } })
  }

  const collectionResult = await payload.find({
    collection: 'vehicle-collections',
    depth: 2,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [{ or: collectionLookup }, { isVisible: { equals: true } }],
    },
  })

  const collection = collectionResult.docs[0] as unknown as JsonRecord | undefined
  if (!collection) return null

  if (collection.collectionType === 'manual') {
    const vehicles = Array.isArray(collection.manualVehicles) ? collection.manualVehicles : []
    const docs = vehicles
      .filter((vehicle): vehicle is JsonRecord => Boolean(vehicle && typeof vehicle === 'object'))
      .filter((vehicle) => vehicle.publishStatus === 'published' && vehicle.inventoryStatus !== 'sold')
      .slice(0, options.limit || numberValue(collection.limit) || 12)
    const approved = await approvedVehicleMediaMap(
      payload,
      docs.map((vehicle) => ({
        id: relationId(vehicle.id),
        image: vehicle.image as RelationValue,
        gallery: vehicle.gallery,
      })),
    )
    const cards = docs.map((vehicle) =>
      toPublicVehicleCard(vehicle, { approvedMediaIds: approved.get(String(relationId(vehicle.id))) }),
    )

    return {
      collection: publicCollectionMeta(collection),
      docs: cards,
      totalDocs: cards.length,
      totalPages: 1,
      page: 1,
      limit: cards.length,
      hasNextPage: false,
      hasPrevPage: false,
    }
  }

  const result = await findPublicVehicles(payload, {
    ...rulesToOptions(collection, options.limit),
    page: options.page,
  })

  return {
    collection: publicCollectionMeta(collection),
    ...result,
  }
}

export async function findPublicCollections(
  payload: Payload,
  options: Pick<PublicVehicleListOptions, 'page' | 'limit'> = {},
) {
  const page = Math.max(1, Number(options.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 24))

  const result = await payload.find({
    collection: 'vehicle-collections',
    depth: 2,
    limit,
    overrideAccess: true,
    page,
    sort: 'name',
    where: {
      isVisible: { equals: true },
    },
  })

  return {
    docs: result.docs.map((doc) => publicCollectionMeta(doc as unknown as JsonRecord)),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page || page,
    limit: result.limit || limit,
    hasNextPage: Boolean(result.hasNextPage),
    hasPrevPage: Boolean(result.hasPrevPage),
  }
}

function publicCollectionMeta(collection: JsonRecord) {
  const seo = (collection.seo && typeof collection.seo === 'object' ? collection.seo : {}) as JsonRecord
  return {
    id: String(collection.id),
    name: text(collection.name),
    slug: text(collection.slug),
    description: text(collection.description) || undefined,
    collectionType: text(collection.collectionType) || 'smart',
    image: toPublicImage(collection.image as RelationValue),
    seo: {
      title: text(seo.title) || undefined,
      description: text(seo.description) || undefined,
      image: toPublicImage(seo.image as RelationValue),
    },
  }
}

export function optionsFromSearchParams(searchParams: URLSearchParams): PublicVehicleListOptions {
  const value = (key: string) => {
    const raw = searchParams.get(key)?.trim()
    if (!raw || raw === 'null' || raw === 'undefined') return undefined
    return raw
  }
  const num = (key: string) => {
    const raw = value(key)
    if (!raw) return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return {
    page: num('page'),
    limit: num('limit'),
    sort: value('sort'),
    keyword: value('q') || value('keyword'),
    brand: value('brand'),
    model: value('model'),
    modelFamily: value('modelFamily'),
    city: value('city'),
    agency: value('agency') || value('dealership'),
    yearMin: num('yearMin'),
    yearMax: num('yearMax'),
    mileageMin: num('mileageMin'),
    mileageMax: num('mileageMax'),
    bodyType: value('bodyType'),
    segment: value('segment'),
    vehicleType: value('vehicleType'),
    fuel: value('fuel'),
    transmission: value('transmission'),
    condition: value('condition'),
    inventoryStatus: value('inventoryStatus'),
    tags: (value('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  }
}
