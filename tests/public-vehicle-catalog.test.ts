import assert from 'node:assert/strict'
import test from 'node:test'
import type { Payload } from 'payload'

import type { PublicVehicleCard } from '../src/contracts/publicCatalog'
import {
  findPublicVehicles,
  groupPublicVehicleCards,
  paginatePublicVehicleCards,
  resolveVehicleCollection,
} from '../src/services/publicVehicleCatalog'

function vehicle(overrides: Partial<PublicVehicleCard> = {}): PublicVehicleCard {
  return {
    id: 'vehicle-1',
    slug: 'vehicle-1',
    title: '2026 Mazda 3',
    condition: 'new',
    inventoryStatus: 'available',
    brand: 'Mazda',
    model: 'M3S I AM',
    modelFamily: 'MAZDA 3',
    tags: [],
    ...overrides,
  }
}

test('new physical vehicles collapse into one aggregate-safe model-family listing', () => {
  const grouped = groupPublicVehicleCards([
    vehicle({
      id: '3',
      slug: 'mazda-3-c',
      model: 'M3S I AM',
      year: 2024,
      city: 'Mazatlán',
    }),
    vehicle({
      id: '2',
      slug: 'mazda-3-b',
      model: 'M3S ISP AM',
      year: 2026,
      city: 'Culiacán',
      image: { url: '/approved-b.jpg' },
    }),
    vehicle({
      id: '1',
      slug: 'mazda-3-a',
      model: 'M3S SG XAM',
      year: 2025,
      city: 'Mazatlán',
      image: { url: '/approved-a.jpg' },
    }),
  ])

  assert.equal(grouped.length, 1)
  assert.deepEqual(grouped[0], {
    id: '3',
    slug: 'mazda-3-c',
    title: 'Mazda 3',
    listingKey: 'mazda--3',
    inventoryCount: 3,
    yearRange: { min: 2024, max: 2026 },
    variantCount: 3,
    cities: ['Culiacán', 'Mazatlán'],
    condition: 'new',
    inventoryStatus: 'available',
    brand: 'Mazda',
    model: '3',
    modelFamily: '3',
    tags: [],
    image: undefined,
  })
})

test('requested sort order chooses the grouped representative without leaking its sort metadata', () => {
  const lowPriceFirst = groupPublicVehicleCards([
    vehicle({ id: 'low', slug: 'low-price', priceLabel: '$300,000', year: 2024 }),
    vehicle({ id: 'high', slug: 'high-price', priceLabel: '$500,000', year: 2026 }),
  ])[0]
  const highPriceFirst = groupPublicVehicleCards([
    vehicle({ id: 'high', slug: 'high-price', priceLabel: '$500,000', year: 2026 }),
    vehicle({ id: 'low', slug: 'low-price', priceLabel: '$300,000', year: 2024 }),
  ])[0]
  const newestYearFirst = groupPublicVehicleCards([
    vehicle({ id: 'newest', slug: 'newest-year', year: 2026 }),
    vehicle({ id: 'oldest', slug: 'oldest-year', year: 2024 }),
  ])[0]

  assert.equal(lowPriceFirst?.id, 'low')
  assert.equal(highPriceFirst?.id, 'high')
  assert.equal(newestYearFirst?.id, 'newest')
  assert.equal(lowPriceFirst?.priceLabel, undefined)
  assert.equal(highPriceFirst?.year, undefined)
  assert.deepEqual(newestYearFirst?.yearRange, { min: 2024, max: 2026 })
})

test('NO USAR source rows are excluded from grouped counts and variants', () => {
  const grouped = groupPublicVehicleCards([
    vehicle({ id: '1', slug: 'valid-a', model: 'M3S I AM' }),
    vehicle({ id: '2', slug: 'valid-b', model: 'M3S ISP AM' }),
    vehicle({ id: '3', slug: 'no-usar-a', model: 'M3S NO USAR' }),
    vehicle({ id: '4', slug: 'no-usar-b', trim: 'NO USAR' }),
  ])

  assert.equal(grouped.length, 1)
  assert.equal(grouped[0]?.inventoryCount, 2)
  assert.equal(grouped[0]?.variantCount, 2)
})

test('model-family grouping is case, whitespace, and accent insensitive', () => {
  const grouped = groupPublicVehicleCards([
    vehicle({ id: '1', slug: 'first', brand: 'Peugeot', modelFamily: 'Rifter' }),
    vehicle({
      id: '2',
      slug: 'second',
      brand: ' PEUGEOT ',
      modelFamily: '  RÍFTER  ',
    }),
  ])

  assert.equal(grouped.length, 1)
  assert.equal(grouped[0]?.listingKey, 'peugeot--rifter')
  assert.equal(grouped[0]?.inventoryCount, 2)
})

test('used vehicles remain one public card per physical unit', () => {
  const used = [
    vehicle({ id: '1', slug: 'used-1', condition: 'used' }),
    vehicle({ id: '2', slug: 'used-2', condition: 'used' }),
    vehicle({ id: '3', slug: 'used-3', condition: 'used' }),
  ]

  assert.deepEqual(groupPublicVehicleCards(used), used)
})

test('pagination metadata is calculated after new vehicles are grouped', () => {
  const cards = groupPublicVehicleCards([
    vehicle({ id: '1', slug: 'mazda-a', brand: 'Mazda', modelFamily: 'MAZDA 3' }),
    vehicle({ id: '2', slug: 'mazda-b', brand: 'Mazda', modelFamily: 'MAZDA 3' }),
    vehicle({ id: '3', slug: 'ford-a', brand: 'Ford', modelFamily: 'Explorer' }),
    vehicle({ id: '4', slug: 'used-a', condition: 'used' }),
    vehicle({ id: '5', slug: 'used-b', condition: 'used' }),
  ])

  const result = paginatePublicVehicleCards(cards, 2, 2)

  assert.deepEqual(result.docs.map((card) => card.slug), ['used-a', 'used-b'])
  assert.deepEqual(
    {
      totalDocs: result.totalDocs,
      totalPages: result.totalPages,
      page: result.page,
      limit: result.limit,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    },
    {
      totalDocs: 4,
      totalPages: 2,
      page: 2,
      limit: 2,
      hasNextPage: false,
      hasPrevPage: true,
    },
  )
})

test('price and year sorts keep Payload order when selecting a grouped representative', async () => {
  const cases = [
    { sort: 'priceAsc', payloadSort: 'price', firstID: 1 },
    { sort: 'priceDesc', payloadSort: '-price', firstID: 2 },
    { sort: 'yearDesc', payloadSort: '-year', firstID: 2 },
  ] as const

  for (const scenario of cases) {
    const orderedDocs = [
      {
        id: scenario.firstID,
        slug: `mazda-${scenario.firstID}`,
        condition: 'new',
        inventoryStatus: 'available',
        brand: 'Mazda',
        model: scenario.firstID === 1 ? 'M3S I AM' : 'M3S ISP AM',
        modelFamily: 'MAZDA 3',
        year: scenario.firstID === 1 ? 2024 : 2026,
        price: scenario.firstID === 1 ? '$300,000' : '$500,000',
      },
      {
        id: scenario.firstID === 1 ? 2 : 1,
        slug: `mazda-${scenario.firstID === 1 ? 2 : 1}`,
        condition: 'new',
        inventoryStatus: 'available',
        brand: 'Mazda',
        model: scenario.firstID === 1 ? 'M3S ISP AM' : 'M3S I AM',
        modelFamily: 'MAZDA 3',
        year: scenario.firstID === 1 ? 2026 : 2024,
        price: scenario.firstID === 1 ? '$500,000' : '$300,000',
      },
    ]
    const calls: Record<string, unknown>[] = []
    const payload = {
      find: async (options: Record<string, unknown>) => {
        calls.push(options)
        return options.depth === 0 ? { docs: orderedDocs } : { docs: [orderedDocs[0]] }
      },
    } as unknown as Payload

    const result = await findPublicVehicles(payload, { sort: scenario.sort })

    assert.equal(calls[0]?.sort, scenario.payloadSort)
    assert.equal(result.docs[0]?.id, String(scenario.firstID))
    assert.equal(result.docs[0]?.priceLabel, undefined)
    assert.equal(result.docs[0]?.year, undefined)
  }
})

test('public catalog fetches the filtered set before paginating grouped listings', async () => {
  const findCalls: Record<string, unknown>[] = []
  const payload = {
    find: async (options: Record<string, unknown>) => {
      findCalls.push(options)
      if (findCalls.length === 2) {
        return {
          docs: [
            {
              id: 3,
              slug: 'ford-a',
              condition: 'new',
              inventoryStatus: 'available',
              brand: 'Ford',
              model: 'Explorer XLT',
              modelFamily: 'Explorer',
              price: '$900,000',
              year: 2026,
              exteriorColor: 'Azul',
            },
          ],
        }
      }
      return {
        docs: [
          {
            id: 1,
            slug: 'mazda-a',
            condition: 'new',
            inventoryStatus: 'available',
            brand: 'Mazda',
            model: 'M3S I AM',
            modelFamily: 'MAZDA 3',
          },
          {
            id: 2,
            slug: 'mazda-b',
            condition: 'new',
            inventoryStatus: 'available',
            brand: 'Mazda',
            model: 'M3S ISP AM',
            modelFamily: 'MAZDA 3',
          },
          {
            id: 3,
            slug: 'ford-a',
            condition: 'new',
            inventoryStatus: 'available',
            brand: 'Ford',
            model: 'Explorer XLT',
            modelFamily: 'Explorer',
          },
        ],
        totalDocs: 3,
        totalPages: 3,
        page: 2,
        limit: 1,
        hasNextPage: true,
        hasPrevPage: true,
      }
    },
  } as unknown as Payload

  const result = await findPublicVehicles(payload, { page: 2, limit: 1, condition: 'new' })

  assert.equal(findCalls.length, 2)
  assert.equal(findCalls[0]?.pagination, false)
  assert.equal(findCalls[0]?.depth, 0)
  assert.equal(findCalls[0]?.sort, '-createdAt')
  assert.deepEqual(findCalls[0]?.select, {
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
  })
  assert.equal(findCalls[1]?.depth, 2)
  assert.equal(findCalls[1]?.limit, 1)
  assert.deepEqual(result.docs.map((card) => card.title), ['Ford Explorer'])
  assert.equal(result.docs[0]?.id, '3')
  assert.equal(result.docs[0]?.priceLabel, undefined)
  assert.equal(result.docs[0]?.exteriorColor, undefined)
  assert.equal(result.totalDocs, 2)
  assert.equal(result.totalPages, 2)
  assert.equal(result.page, 2)
})

test('manual public collections group new units before pagination', async () => {
  const payload = {
    find: async (options: Record<string, unknown>) => {
      assert.equal(options.collection, 'vehicle-collections')
      return {
        docs: [
          {
            id: 99,
            name: 'Destacados',
            slug: 'destacados',
            isVisible: true,
            collectionType: 'manual',
            limit: 12,
            manualVehicles: [
              {
                id: 1,
                slug: 'mazda-a',
                publishStatus: 'published',
                condition: 'new',
                inventoryStatus: 'available',
                brand: 'Mazda',
                model: 'M3S I AM',
                modelFamily: 'MAZDA 3',
              },
              {
                id: 2,
                slug: 'mazda-b',
                publishStatus: 'published',
                condition: 'new',
                inventoryStatus: 'available',
                brand: 'Mazda',
                model: 'M3S ISP AM',
                modelFamily: 'MAZDA 3',
              },
              {
                id: 3,
                slug: 'discarded',
                publishStatus: 'published',
                condition: 'new',
                inventoryStatus: 'available',
                brand: 'Mazda',
                model: 'NO USAR',
                modelFamily: 'MAZDA 3',
              },
            ],
          },
        ],
      }
    },
  } as unknown as Payload

  const result = await resolveVehicleCollection(payload, 'destacados', { page: 1, limit: 1 })

  assert.ok(result)
  assert.equal(result.totalDocs, 1)
  assert.equal(result.docs.length, 1)
  assert.equal(result.docs[0]?.inventoryCount, 2)
  assert.equal(result.docs[0]?.variantCount, 2)
  assert.equal(result.docs[0]?.model, '3')
})
