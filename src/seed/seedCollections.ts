import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

const payload = await getPayload({ config })

type TagSeed = {
  name: string
  slug: string
  label?: string
  type?: 'manual' | 'automatic' | 'system'
  color?: string
}

type CollectionSeed = {
  name: string
  slug: string
  description: string
  collectionType: 'manual' | 'smart'
  sort: 'newest' | 'mostViewed' | 'mostClicked' | 'mostLeads' | 'priceAsc' | 'priceDesc' | 'mileageAsc' | 'yearDesc'
  limit: number
  rules?: Record<string, unknown>
  manualVehicles?: number[]
}

const tags: TagSeed[] = [
  { name: 'Nuevo', slug: 'nuevo', label: 'Nuevo', type: 'system', color: '#0f766e' },
  { name: 'Seminuevo', slug: 'seminuevo', label: 'Seminuevo', type: 'system', color: '#2563eb' },
  { name: 'Recien agregado', slug: 'recien-agregado', label: 'Recien agregado', type: 'automatic', color: '#7c3aed' },
  { name: 'Mas visto', slug: 'mas-visto', label: 'Mas visto', type: 'automatic', color: '#ea580c' },
  { name: 'Bajo kilometraje', slug: 'bajo-kilometraje', label: 'Bajo kilometraje', type: 'automatic', color: '#16a34a' },
  { name: 'Promocion', slug: 'promocion', label: 'Promocion', type: 'manual', color: '#dc2626' },
  { name: 'SUV', slug: 'suv', label: 'SUV', type: 'automatic', color: '#334155' },
  { name: 'Mazda', slug: 'mazda', label: 'Mazda', type: 'automatic', color: '#111827' },
]

async function upsertTag(tag: TagSeed) {
  const existing = await payload.find({
    collection: 'vehicle-tags',
    depth: 0,
    limit: 1,
    where: { slug: { equals: tag.slug } },
  })

  const data = { ...tag, isVisible: true }
  if (existing.docs[0]) {
    await payload.update({ collection: 'vehicle-tags', id: existing.docs[0].id, data })
    return existing.docs[0].id
  }

  const created = await payload.create({ collection: 'vehicle-tags', data })
  return created.id
}

async function upsertCollection(collection: CollectionSeed) {
  const existing = await payload.find({
    collection: 'vehicle-collections',
    depth: 0,
    limit: 1,
    where: { slug: { equals: collection.slug } },
  })

  const data = {
    name: collection.name,
    slug: collection.slug,
    description: collection.description,
    collectionType: collection.collectionType,
    sort: collection.sort,
    limit: collection.limit,
    isVisible: true,
    rules: collection.rules || {},
    manualVehicles: collection.manualVehicles || [],
    seo: {
      title: collection.name,
      description: collection.description,
    },
  }

  if (existing.docs[0]) {
    await payload.update({ collection: 'vehicle-collections', id: existing.docs[0].id, data })
    return existing.docs[0].id
  }

  const created = await payload.create({ collection: 'vehicle-collections', data })
  return created.id
}

for (const tag of tags) {
  await upsertTag(tag)
}

const publishedVehicles = await payload.find({
  collection: 'vehicles',
  depth: 0,
  limit: 12,
  sort: '-createdAt',
  where: {
    and: [
      { publishStatus: { equals: 'published' } },
      { inventoryStatus: { not_equals: 'sold' } },
    ],
  },
})

const collections: CollectionSeed[] = [
  {
    name: 'Seminuevos destacados',
    slug: 'seminuevos',
    description: 'Autos seminuevos publicados y disponibles.',
    collectionType: 'smart',
    sort: 'newest',
    limit: 12,
    rules: { condition: 'used', publishStatus: 'published', inventoryStatus: 'available' },
  },
  {
    name: 'Autos nuevos',
    slug: 'nuevos',
    description: 'Unidades nuevas disponibles para estrenar.',
    collectionType: 'smart',
    sort: 'newest',
    limit: 12,
    rules: { condition: 'new', publishStatus: 'published', inventoryStatus: 'available' },
  },
  {
    name: 'Recien agregados',
    slug: 'recien-agregados',
    description: 'Lo ultimo publicado en el inventario.',
    collectionType: 'smart',
    sort: 'newest',
    limit: 12,
    rules: { publishStatus: 'published', inventoryStatus: 'available' },
  },
  {
    name: 'Mas vistos',
    slug: 'mas-vistos',
    description: 'Vehiculos con mayor demanda reciente.',
    collectionType: 'smart',
    sort: 'mostViewed',
    limit: 12,
    rules: { publishStatus: 'published', inventoryStatus: 'available' },
  },
  {
    name: 'SUV disponibles',
    slug: 'suvs',
    description: 'SUVs listas para consulta por ciudad o agencia.',
    collectionType: 'smart',
    sort: 'newest',
    limit: 12,
    rules: { bodyType: 'suv', publishStatus: 'published', inventoryStatus: 'available' },
  },
  {
    name: 'Mazda disponibles',
    slug: 'mazda',
    description: 'Inventario Mazda disponible.',
    collectionType: 'smart',
    sort: 'newest',
    limit: 12,
    rules: { brand: 'Mazda', publishStatus: 'published', inventoryStatus: 'available' },
  },
  {
    name: 'Inventario Culiacan',
    slug: 'culiacan',
    description: 'Vehiculos disponibles en Culiacan.',
    collectionType: 'smart',
    sort: 'newest',
    limit: 12,
    rules: { city: 'Culiacan', publishStatus: 'published', inventoryStatus: 'available' },
  },
  {
    name: 'Destacados editoriales',
    slug: 'destacados',
    description: 'Seleccion manual para homepage, paginas y campanas.',
    collectionType: 'manual',
    sort: 'newest',
    limit: 8,
    manualVehicles: publishedVehicles.docs
      .slice(0, 8)
      .map((vehicle) => vehicle.id)
      .filter((id): id is number => typeof id === 'number'),
  },
]

for (const collection of collections) {
  await upsertCollection(collection)
}

console.log(`Seeded ${tags.length} tags and ${collections.length} vehicle collections.`)
process.exit(0)
