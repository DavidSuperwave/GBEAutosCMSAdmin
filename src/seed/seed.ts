import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

import { dealerships, vehicles } from './seedData'

const payload = await getPayload({ config })

for (const vehicle of vehicles) {
  const existing = await payload.find({
    collection: 'vehicles',
    where: { slug: { equals: vehicle.slug } },
    limit: 1,
  })

  const data = {
    ...vehicle,
    status: 'available' as const,
    features: vehicle.features.map((feature) => ({ feature })),
  }

  if (existing.docs[0]) {
    await payload.update({
      collection: 'vehicles',
      id: existing.docs[0].id,
      data,
    })
  } else {
    await payload.create({
      collection: 'vehicles',
      data,
    })
  }
}

for (const dealership of dealerships) {
  const existing = await payload.find({
    collection: 'dealerships',
    where: {
      and: [
        { brandName: { equals: dealership.brandName } },
        { city: { equals: dealership.city } },
      ],
    },
    limit: 1,
  })

  const data = {
    ...dealership,
    isActive: true,
  }

  if (existing.docs[0]) {
    await payload.update({
      collection: 'dealerships',
      id: existing.docs[0].id,
      data,
    })
  } else {
    await payload.create({
      collection: 'dealerships',
      data,
    })
  }
}

await payload.updateGlobal({
  slug: 'home',
  data: {
    hero: {
      title: 'El auto de tus sueños te espera',
      subtitle:
        'Grupo Líder Automotriz en el Noroeste. Encuentra las mejores marcas y modelos con financiamiento accesible.',
      ctaLabel: 'Ver Unidades',
      ctaHref: '#unidades',
      secondaryCtaLabel: 'Cotizar',
      secondaryCtaHref: '/contacts',
    },
    stats: [
      { value: '80+', label: 'Clientes Satisfechos' },
      { value: '8', label: 'Marcas Disponibles' },
      { value: '60', label: 'Meses de plazo' },
    ],
    financing: {
      heading: 'Financiamiento Flexible',
      body: 'Contamos con plazos de 12, 24, 48 y 60 meses para que puedas estrenar tu nueva unidad.',
      ctaLabel: 'Solicitar información',
      ctaHref: '/contacts',
    },
    testimonial: {
      heading: '¿Qué dicen nuestros clientes?',
      quote:
        'Excelencia automotriz en todos los aspectos. El proceso fue rápido, sencillo y me llevo el auto que siempre quise.',
      author: 'Cliente GB Automotriz',
    },
    brands: [
      { name: 'Mazda' },
      { name: 'Ram' },
      { name: 'Fiat' },
      { name: 'Peugeot' },
      { name: 'Lincoln' },
      { name: 'Ford' },
      { name: 'DFAC' },
      { name: 'Dodge' },
    ],
  },
})

await payload.updateGlobal({
  slug: 'site-config',
  data: {
    siteName: 'GB Automotriz',
    companyName: 'GB Automotriz S.A. de C.V.',
    slogan: 'Grupo Líder Automotriz en el Noroeste',
    phone: '+526681030004',
    whatsapp: '+526681030004',
    email: 'contacto@gbautomotriz.mx',
    address: 'Culiacán, Sinaloa, México',
    socialLinks: {
      facebook: '#',
      instagram: '#',
      whatsappUrl: 'https://wa.me/526681030004',
    },
  },
})

console.log(`Seeded ${vehicles.length} vehicles and ${dealerships.length} dealerships.`)
process.exit(0)
