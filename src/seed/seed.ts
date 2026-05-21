import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

import type { Vehicle } from '../payload-types'
import { dealerships, vehicles } from './seedData'

const payload = await getPayload({ config })

const seededDealerships = new Map<string, number>()

type DemoVehicleMeta = {
  agencyBrand: string
  agencyCity: string
  city: string
  condition: 'new' | 'used'
  mileage: number
  bodyType: 'sedan' | 'suv' | 'pickup' | 'coupe' | 'hatchback' | 'van' | 'other'
  transmission: 'automatic' | 'manual' | 'cvt'
  fuel: 'gasoline' | 'diesel' | 'hybrid' | 'electric'
  stockId: string
  badges: string[]
  landing: NonNullable<Vehicle['landing']>
}

const demoVehicleMeta: Record<string, DemoVehicleMeta> = {
  territory: {
    agencyBrand: 'ford',
    agencyCity: 'Culiacan',
    city: 'Culiacan',
    condition: 'new',
    mileage: 0,
    bodyType: 'suv',
    transmission: 'automatic',
    fuel: 'gasoline',
    stockId: 'DEMO-FOR-TERR-26',
    badges: ['Nuevo', 'SUV familiar', 'Garantia agencia'],
    landing: [
      {
        blockType: 'highlightList',
        heading: 'Lista para familias y carretera',
        body: 'Una SUV demo pensada para mostrar espacio, seguridad y tecnologia sin complicar la captura.',
        items: [
          { label: 'Entrega por agencia', description: 'La unidad se atiende desde Ford Culiacan.' },
          { label: 'Equipo clave', description: 'Pantalla amplia, asistencias y cabina comoda.' },
        ],
      },
    ],
  },
  mazda2: {
    agencyBrand: 'mazda',
    agencyCity: 'Mazatlan',
    city: 'Mazatlan',
    condition: 'new',
    mileage: 0,
    bodyType: 'sedan',
    transmission: 'automatic',
    fuel: 'gasoline',
    stockId: 'DEMO-MAZ-2-25',
    badges: ['Nuevo', 'Ahorro de gasolina', 'Ciudad'],
    landing: [
      {
        blockType: 'featureGrid',
        heading: 'Ideal para uso diario',
        items: [
          { feature: 'Camara de reversa' },
          { feature: 'Faros LED' },
          { feature: 'Manejo eficiente' },
        ],
      },
    ],
  },
  'p-22': {
    agencyBrand: 'dongfeng',
    agencyCity: 'Culiacan',
    city: 'Culiacan',
    condition: 'new',
    mileage: 0,
    bodyType: 'pickup',
    transmission: 'manual',
    fuel: 'diesel',
    stockId: 'DEMO-DFAC-P22-25',
    badges: ['Nuevo', 'Trabajo', 'Diesel'],
    landing: [
      {
        blockType: 'highlightList',
        heading: 'Pickup para trabajo',
        items: [
          { label: 'Capacidad', description: 'Configurada para clientes que buscan carga y resistencia.' },
          { label: 'Motor diesel', description: 'Enfocada en rendimiento para uso diario de negocio.' },
        ],
      },
    ],
  },
  'ram-700': {
    agencyBrand: 'stellantis',
    agencyCity: 'Ciudad Obregon',
    city: 'Ciudad Obregon',
    condition: 'new',
    mileage: 0,
    bodyType: 'pickup',
    transmission: 'manual',
    fuel: 'gasoline',
    stockId: 'DEMO-RAM-700-25',
    badges: ['Nuevo', 'Pickup', 'Trabajo'],
    landing: [],
  },
  'peugeot-2009': {
    agencyBrand: 'stellantis',
    agencyCity: 'Ciudad Obregon',
    city: 'Ciudad Obregon',
    condition: 'new',
    mileage: 0,
    bodyType: 'suv',
    transmission: 'automatic',
    fuel: 'gasoline',
    stockId: 'DEMO-PEU-2008-25',
    badges: ['Nuevo', 'Turbo', 'SUV'],
    landing: [],
  },
  'pulse-fiat': {
    agencyBrand: 'stellantis',
    agencyCity: 'Ciudad Obregon',
    city: 'Ciudad Obregon',
    condition: 'new',
    mileage: 0,
    bodyType: 'suv',
    transmission: 'cvt',
    fuel: 'gasoline',
    stockId: 'DEMO-FIAT-PULSE-25',
    badges: ['Nuevo', 'SUV urbana', 'Promo'],
    landing: [],
  },
  navigator: {
    agencyBrand: 'lincoln',
    agencyCity: 'Culiacan',
    city: 'Culiacan',
    condition: 'new',
    mileage: 0,
    bodyType: 'suv',
    transmission: 'automatic',
    fuel: 'gasoline',
    stockId: 'DEMO-LIN-NAV-25',
    badges: ['Nuevo', 'Lujo', 'Entrega agencia'],
    landing: [
      {
        blockType: 'cta',
        heading: 'Agenda una experiencia Lincoln',
        body: 'La agencia responsable atiende por WhatsApp para disponibilidad, prueba de manejo y opciones de compra.',
        buttonLabel: 'Consultar por WhatsApp',
      },
    ],
  },
  'x-70': {
    agencyBrand: 'jetour',
    agencyCity: 'Culiacan',
    city: 'Culiacan',
    condition: 'new',
    mileage: 0,
    bodyType: 'suv',
    transmission: 'automatic',
    fuel: 'gasoline',
    stockId: 'DEMO-JET-X70-25',
    badges: ['Nuevo', 'SUV', 'Garantia'],
    landing: [],
  },
  attitude: {
    agencyBrand: 'stellantis',
    agencyCity: 'Ciudad Obregon',
    city: 'Ciudad Obregon',
    condition: 'new',
    mileage: 0,
    bodyType: 'sedan',
    transmission: 'cvt',
    fuel: 'gasoline',
    stockId: 'DEMO-DOD-ATT-25',
    badges: ['Nuevo', 'Sedan', 'R/T'],
    landing: [],
  },
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function dealershipKey(brandName: string, city: string) {
  return `${normalize(brandName)}:${normalize(city)}`
}

for (const dealership of dealerships) {
  const existing = await payload.find({
    collection: 'dealerships',
    where: {
      and: [{ brandName: { equals: dealership.brandName } }, { city: { equals: dealership.city } }],
    },
    limit: 1,
  })

  const data = {
    ...dealership,
    isActive: true,
  }

  const doc = existing.docs[0]
    ? await payload.update({
        collection: 'dealerships',
        id: existing.docs[0].id,
        data,
      })
    : await payload.create({
        collection: 'dealerships',
        data,
      })

  seededDealerships.set(dealershipKey(dealership.brandName, dealership.city), Number(doc.id))
}

const defaultDealership = Array.from(seededDealerships.values())[0]

if (!defaultDealership) {
  throw new Error('Seed requires at least one dealership before creating vehicles.')
}

for (const vehicle of vehicles) {
  const demoMeta = demoVehicleMeta[vehicle.slug]
  const matchedDealership = demoMeta
    ? seededDealerships.get(dealershipKey(demoMeta.agencyBrand, demoMeta.agencyCity))
    : undefined
  const dealership = matchedDealership ?? defaultDealership

  const existing = await payload.find({
    collection: 'vehicles',
    where: { slug: { equals: vehicle.slug } },
    limit: 1,
  })

  const data = {
    ...vehicle,
    city: demoMeta?.city,
    condition: demoMeta?.condition ?? ('new' as const),
    dealership,
    inventoryStatus: 'available' as const,
    mileage: demoMeta?.mileage,
    bodyType: demoMeta?.bodyType,
    transmission: demoMeta?.transmission,
    fuel: demoMeta?.fuel,
    stockId: demoMeta?.stockId,
    badges: demoMeta?.badges.map((label) => ({ label })),
    landing: demoMeta?.landing,
    features: vehicle.features.map((feature) => ({ feature })),
  }

  if (existing.docs[0]) {
    await payload.update({
      collection: 'vehicles',
      id: existing.docs[0].id,
      data,
      draft: false,
    })
  } else {
    await payload.create({
      collection: 'vehicles',
      data,
      draft: false,
    })
  }
}

await payload.updateGlobal({
  slug: 'site-config',
  data: {
    general: {
      siteName: 'GB Automotriz',
      companyName: 'GB Automotriz S.A. de C.V.',
      slogan: 'Grupo Lider Automotriz en el Noroeste',
      phone: '+526681030004',
      whatsapp: '+526681030004',
      email: 'contacto@gbautomotriz.mx',
      address: 'Culiacan, Sinaloa, Mexico',
      socialLinks: {
        facebook: '#',
        instagram: '#',
        whatsappUrl: 'https://wa.me/526681030004',
      },
    },
    navigation: {
      mainLinks: [
        { label: 'Inicio', href: '/' },
        { label: 'Marcas', href: '/marcas' },
        { label: 'Seminuevos', href: '/seminuevos' },
        { label: 'Servicio', href: '/our-services' },
        { label: 'Nosotros', href: '/about-us' },
      ],
      cta: { label: 'Contactanos', href: '/contacts' },
    },
    home: {
      sections: [
        {
          blockType: 'hero',
          heading: 'Fuerza automotriz que acelera el futuro',
          body: 'Grupo Lider Automotriz en el Noroeste. Mas de 90 anos de experiencia.',
          primaryLink: { label: 'Ver seminuevos', href: '/seminuevos' },
          secondaryLink: { label: 'Contactanos', href: '/contacts' },
        },
        { blockType: 'featuredVehicles', heading: 'Vehiculos disponibles', limit: 6 },
        { blockType: 'brands', heading: 'Las mejores marcas, en un solo lugar' },
      ],
    },
  },
})

console.log(`Seeded ${vehicles.length} vehicles and ${dealerships.length} dealerships.`)
process.exit(0)
