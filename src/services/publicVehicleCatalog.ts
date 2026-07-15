import type { Payload, Where } from 'payload'

import type {
  PublicLandingBlock,
  PublicVehicleCard,
  PublicVehicleDetail,
  PublicVehicleListOptions,
  PublicVehicleListResult,
} from '../contracts/publicCatalog'
import { approvedVehicleMediaMap } from './vehicleMediaPolicy'
import { relationId, relationIds } from './relations'
import { SPEC_KEYS } from './vehicleWorkflow'

// The DTO shapes live in src/contracts (F038); re-export for existing consumers.
export type {
  PublicLandingBlock,
  PublicVehicleCard,
  PublicVehicleDetail,
  PublicVehicleListOptions,
} from '../contracts/publicCatalog'

type JsonRecord = Record<string, unknown>
type RelationValue = string | number | JsonRecord | null | undefined

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

function normalizedListingPart(value: unknown): string {
  return text(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function modelFamilyForCard(card: PublicVehicleCard): string {
  return text(card.modelFamily) || text(card.model)
}

function modelFamilyWithoutBrand(card: PublicVehicleCard): string {
  const brandWords = text(card.brand).split(/\s+/).filter(Boolean)
  const familyWords = modelFamilyForCard(card).split(/\s+/).filter(Boolean)
  const startsWithBrand =
    brandWords.length > 0 &&
    familyWords.length >= brandWords.length &&
    brandWords.every(
      (word, index) => normalizedListingPart(word) === normalizedListingPart(familyWords[index]),
    )

  return startsWithBrand
    ? familyWords.slice(brandWords.length).join(' ') || text(card.brand)
    : familyWords.join(' ')
}

function listingKeyForCard(card: PublicVehicleCard): string {
  const brand = normalizedListingPart(card.brand)
  const family = normalizedListingPart(modelFamilyWithoutBrand(card))
  return [brand, family].filter(Boolean).join('--')
}

function uniqueDisplayValues(values: Array<string | undefined>): string[] {
  const byNormalizedValue = new Map<string, string>()
  for (const value of values) {
    const displayValue = text(value)
    const normalizedValue = normalizedListingPart(displayValue)
    if (displayValue && normalizedValue && !byNormalizedValue.has(normalizedValue)) {
      byNormalizedValue.set(normalizedValue, displayValue)
    }
  }
  return [...byNormalizedValue.values()].sort((left, right) =>
    left.localeCompare(right, 'es-MX', { sensitivity: 'base' }),
  )
}

function isSuppressedPublicVehicle(card: PublicVehicleCard): boolean {
  return [card.model, card.modelFamily, card.trim, card.title].some((value) =>
    normalizedListingPart(value).includes('no-usar'),
  )
}

/**
 * Collapse new physical inventory into one public listing per normalized brand
 * and model family. Used inventory remains one card per physical unit.
 *
 * Input order is preserved for both listing order and representative choice,
 * so Payload's requested sort determines which physical unit owns the public
 * slug. A grouped card intentionally omits representative-only details (trim,
 * price, colour, agency, and specs) that would misdescribe the whole family.
 */
export function groupPublicVehicleCards(cards: PublicVehicleCard[]): PublicVehicleCard[] {
  const groupedNew = new Map<string, PublicVehicleCard[]>()
  const output: Array<PublicVehicleCard | { groupKey: string }> = []

  for (const card of cards) {
    if (isSuppressedPublicVehicle(card)) continue

    if (card.condition === 'used') {
      output.push(card)
      continue
    }

    const groupKey = listingKeyForCard(card)
    const group = groupedNew.get(groupKey)
    if (group) {
      group.push(card)
    } else {
      groupedNew.set(groupKey, [card])
      output.push({ groupKey })
    }
  }

  return output.map((entry) => {
    if (!('groupKey' in entry)) return entry
    const group = groupedNew.get(entry.groupKey) || []
    const representative = group[0]
    const years = group
      .map((card) => card.year)
      .filter((year): year is number => year !== undefined && Number.isFinite(year))
    const variants = uniqueDisplayValues(group.map((card) => card.trim || card.model))
    const cities = uniqueDisplayValues(group.map((card) => card.city))
    const family = modelFamilyWithoutBrand(representative)

    return {
      id: representative.id,
      slug: representative.slug,
      title: [text(representative.brand), family].filter(Boolean).join(' '),
      listingKey: entry.groupKey,
      inventoryCount: group.length,
      yearRange: years.length ? { min: Math.min(...years), max: Math.max(...years) } : undefined,
      variantCount: variants.length,
      cities,
      condition: 'new',
      inventoryStatus: representative.inventoryStatus,
      brand: text(representative.brand),
      model: family,
      modelFamily: family || undefined,
      tags: [],
      image: representative.image,
    }
  })
}

/** Paginate already grouped cards so counts describe public listings, not units. */
export function paginatePublicVehicleCards(
  cards: PublicVehicleCard[],
  requestedPage: number,
  requestedLimit: number,
): PublicVehicleListResult {
  const page = Math.max(1, Number(requestedPage) || 1)
  const limit = Math.min(100, Math.max(1, Number(requestedLimit) || 24))
  const totalDocs = cards.length
  const totalPages = totalDocs === 0 ? 0 : Math.ceil(totalDocs / limit)
  const start = (page - 1) * limit

  return {
    docs: cards.slice(start, start + limit),
    totalDocs,
    totalPages,
    page,
    limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1 && totalPages > 0,
  }
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

const PUBLIC_VEHICLE_GROUP_SELECT = {
  id: true,
  slug: true,
  condition: true,
  inventoryStatus: true,
  brand: true,
  model: true,
  modelFamily: true,
  trim: true,
  year: true,
  city: true,
  dealership: true,
} as const

const PUBLIC_VEHICLE_CARD_SELECT = {
  id: true,
  slug: true,
  condition: true,
  inventoryStatus: true,
  brand: true,
  model: true,
  modelFamily: true,
  trim: true,
  year: true,
  price: true,
  mileage: true,
  city: true,
  dealership: true,
  exteriorColor: true,
  bodyType: true,
  segment: true,
  fuel: true,
  transmission: true,
  tags: true,
  badges: true,
  image: true,
  imageStatus: true,
} as const

async function attachDealershipSummaries(payload: Payload, vehicles: JsonRecord[]): Promise<JsonRecord[]> {
  const dealershipIDs = [
    ...new Set(
      vehicles
        .map((vehicle) => relationId(vehicle.dealership as RelationValue))
        .filter((id): id is string | number => id !== undefined)
        .map(String),
    ),
  ]
  if (dealershipIDs.length === 0) return vehicles

  const result = await payload.find({
    collection: 'dealerships',
    depth: 0,
    limit: dealershipIDs.length,
    overrideAccess: true,
    select: {
      id: true,
      brandName: true,
      displayName: true,
      city: true,
    },
    where: { id: { in: dealershipIDs } },
  })
  const byID = new Map(
    (result.docs as unknown as JsonRecord[]).map((dealership) => [String(dealership.id), dealership]),
  )

  return vehicles.map((vehicle) => {
    const dealershipID = relationId(vehicle.dealership as RelationValue)
    const dealership = dealershipID === undefined ? undefined : byID.get(String(dealershipID))
    return dealership ? { ...vehicle, dealership } : vehicle
  })
}

async function serializeHydratedPage(
  payload: Payload,
  pageCards: PublicVehicleCard[],
  hydratedVehicles: JsonRecord[],
): Promise<PublicVehicleCard[]> {
  const byID = new Map(hydratedVehicles.map((vehicle) => [String(vehicle.id), vehicle]))
  const pageVehicles = pageCards
    .map((card) => byID.get(card.id))
    .filter((vehicle): vehicle is JsonRecord => Boolean(vehicle))
  const approved = await approvedVehicleMediaMap(
    payload,
    pageVehicles.map((vehicle) => ({
      id: relationId(vehicle.id),
      image: vehicle.image as RelationValue,
    })),
  )

  return pageCards.map((card) => {
    const vehicle = byID.get(card.id)
    if (!vehicle) return card
    const hydratedCard = toPublicVehicleCard(vehicle, {
      approvedMediaIds: approved.get(String(relationId(vehicle.id))),
    })

    // Used listings still describe one physical unit, so retain their full
    // card. Grouped new listings borrow only the approved representative
    // image; all model/price/spec metadata remains aggregate-safe.
    return card.condition === 'used' ? hydratedCard : { ...card, image: hydratedCard.image }
  })
}

async function hydrateRepresentativeCards(
  payload: Payload,
  pageCards: PublicVehicleCard[],
): Promise<PublicVehicleCard[]> {
  const ids = [...new Set(pageCards.map((card) => card.id))]
  if (ids.length === 0) return pageCards

  const result = await payload.find({
    collection: 'vehicles',
    depth: 2,
    limit: ids.length,
    overrideAccess: true,
    select: PUBLIC_VEHICLE_CARD_SELECT,
    where: { id: { in: ids } },
  })

  return serializeHydratedPage(payload, pageCards, result.docs as unknown as JsonRecord[])
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
    depth: 0,
    overrideAccess: true,
    pagination: false,
    select: PUBLIC_VEHICLE_GROUP_SELECT,
    sort: sortToPayload(options.sort),
    where,
  })
  const vehicles = await attachDealershipSummaries(payload, result.docs as unknown as JsonRecord[])
  const cards = vehicles.map((doc) => toPublicVehicleCard(doc))
  const paginated = paginatePublicVehicleCards(groupPublicVehicleCards(cards), page, limit)

  return {
    ...paginated,
    docs: await hydrateRepresentativeCards(payload, paginated.docs),
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
    const cards = groupPublicVehicleCards(docs.map((vehicle) => toPublicVehicleCard(vehicle)))
    const paginated = paginatePublicVehicleCards(
      cards,
      options.page || 1,
      options.limit || numberValue(collection.limit) || 12,
    )

    return {
      collection: publicCollectionMeta(collection),
      ...paginated,
      docs: await serializeHydratedPage(payload, paginated.docs, docs),
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
