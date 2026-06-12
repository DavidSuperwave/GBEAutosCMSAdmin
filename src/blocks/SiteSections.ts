import type { Block } from 'payload'

const linkFields = [
  { name: 'label', type: 'text' as const, required: true },
  { name: 'href', type: 'text' as const, required: true },
]

const bodyTypeOptions = [
  { label: 'Sedan', value: 'sedan' },
  { label: 'SUV', value: 'suv' },
  { label: 'Pickup', value: 'pickup' },
  { label: 'Coupe', value: 'coupe' },
  { label: 'Hatchback', value: 'hatchback' },
  { label: 'Van', value: 'van' },
  { label: 'Otro', value: 'other' },
]

export const HeroSection: Block = {
  slug: 'hero',
  labels: { singular: 'Hero', plural: 'Heroes' },
  fields: [
    { name: 'eyebrow', type: 'text', label: 'Etiqueta' },
    { name: 'heading', type: 'text', required: true, label: 'Titulo' },
    { name: 'body', type: 'textarea', label: 'Texto' },
    { name: 'media', type: 'upload', relationTo: 'media', label: 'Imagen' },
    { name: 'videoUrl', type: 'text', label: 'Video URL' },
    { name: 'primaryLink', type: 'group', fields: linkFields, label: 'Boton principal' },
    { name: 'secondaryLink', type: 'group', fields: linkFields, label: 'Boton secundario' },
  ],
}

export const PromoStripSection: Block = {
  slug: 'promoStrip',
  labels: { singular: 'Promo banner', plural: 'Promo banners' },
  fields: [
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'alt', type: 'text' },
        { name: 'href', type: 'text' },
      ],
    },
  ],
}

export const FeaturedVehiclesSection: Block = {
  slug: 'featuredVehicles',
  labels: { singular: 'Vehiculos destacados', plural: 'Vehiculos destacados' },
  fields: [
    { name: 'eyebrow', type: 'text', defaultValue: 'Seminuevos' },
    { name: 'heading', type: 'text', defaultValue: 'Vehiculos destacados' },
    { name: 'body', type: 'textarea' },
    { name: 'limit', type: 'number', defaultValue: 6 },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'latestUsed',
      options: [
        { label: 'Ultimos seminuevos', value: 'latestUsed' },
        { label: 'Seleccion manual', value: 'manual' },
        { label: 'Filtrar por ciudad', value: 'city' },
        { label: 'Filtrar por marca', value: 'brand' },
        { label: 'Filtrar por carroceria', value: 'bodyType' },
      ],
    },
    {
      name: 'city',
      type: 'text',
      label: 'Ciudad',
      admin: { condition: (_, siblingData) => siblingData?.source === 'city' },
    },
    {
      name: 'brand',
      type: 'text',
      label: 'Marca',
      admin: { condition: (_, siblingData) => siblingData?.source === 'brand' },
    },
    {
      name: 'bodyType',
      type: 'select',
      label: 'Carroceria',
      options: bodyTypeOptions,
      admin: { condition: (_, siblingData) => siblingData?.source === 'bodyType' },
    },
    {
      name: 'display',
      type: 'group',
      label: 'Datos visibles',
      fields: [
        { name: 'showPrice', type: 'checkbox', defaultValue: true, label: 'Precio' },
        { name: 'showMileage', type: 'checkbox', defaultValue: true, label: 'Kilometraje' },
        { name: 'showCity', type: 'checkbox', defaultValue: true, label: 'Ciudad' },
        { name: 'showSpecs', type: 'checkbox', defaultValue: true, label: 'Specs rapidas' },
      ],
    },
    {
      name: 'vehicles',
      type: 'relationship',
      relationTo: 'vehicles',
      hasMany: true,
      admin: {
        condition: (_, siblingData) => siblingData?.source === 'manual',
      },
    },
  ],
}

export const InventoryCollectionSection: Block = {
  slug: 'inventoryCollection',
  labels: { singular: 'Coleccion de inventario', plural: 'Colecciones de inventario' },
  fields: [
    {
      name: 'collection',
      type: 'relationship',
      relationTo: 'vehicle-collections',
      required: true,
      label: 'Coleccion',
    },
    { name: 'heading', type: 'text', label: 'Titulo' },
    { name: 'body', type: 'textarea', label: 'Texto' },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'grid',
      label: 'Diseno',
      options: [
        { label: 'Cuadricula', value: 'grid' },
        { label: 'Carrusel', value: 'carousel' },
        { label: 'Destacado dividido', value: 'featuredSplit' },
      ],
    },
    { name: 'limit', type: 'number', defaultValue: 8, label: 'Limite' },
    {
      name: 'display',
      type: 'group',
      label: 'Datos visibles',
      fields: [
        { name: 'showPrice', type: 'checkbox', defaultValue: true, label: 'Precio' },
        { name: 'showMileage', type: 'checkbox', defaultValue: true, label: 'Kilometraje' },
        { name: 'showCity', type: 'checkbox', defaultValue: true, label: 'Ciudad' },
        { name: 'showTags', type: 'checkbox', defaultValue: true, label: 'Tags' },
      ],
    },
    { name: 'ctaLabel', type: 'text', label: 'Texto de CTA' },
    { name: 'ctaHref', type: 'text', label: 'URL de CTA' },
  ],
}

export const InventorySearchSection: Block = {
  slug: 'inventorySearch',
  labels: { singular: 'Busqueda de inventario', plural: 'Busquedas de inventario' },
  fields: [
    { name: 'eyebrow', type: 'text', defaultValue: 'Inventario' },
    { name: 'heading', type: 'text', defaultValue: 'Encuentra tu seminuevo' },
    { name: 'body', type: 'textarea' },
    { name: 'media', type: 'upload', relationTo: 'media', label: 'Imagen' },
    { name: 'limit', type: 'number', defaultValue: 6, label: 'Maximo de resultados' },
    { name: 'city', type: 'text', label: 'Ciudad inicial' },
    { name: 'brand', type: 'text', label: 'Marca inicial' },
    {
      name: 'bodyType',
      type: 'select',
      label: 'Carroceria inicial',
      options: [{ label: 'Todas', value: '' }, ...bodyTypeOptions],
    },
  ],
}

export const CityInventorySection: Block = {
  slug: 'cityInventory',
  labels: { singular: 'Inventario por ciudad', plural: 'Inventario por ciudad' },
  fields: [
    { name: 'eyebrow', type: 'text', defaultValue: 'Inventario por ciudad', label: 'Etiqueta' },
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'Encuentra seminuevos cerca de ti',
      label: 'Titulo',
    },
    { name: 'body', type: 'textarea', label: 'Texto' },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'cards',
      label: 'Diseno',
      options: [
        { label: 'Tarjetas', value: 'cards' },
        { label: 'Lista compacta', value: 'compact' },
        { label: 'Mapa editorial', value: 'map' },
      ],
    },
    { name: 'limit', type: 'number', defaultValue: 6, label: 'Limite por ciudad' },
    {
      name: 'cities',
      type: 'array',
      label: 'Ciudades',
      labels: { singular: 'Ciudad', plural: 'Ciudades' },
      fields: [
        { name: 'city', type: 'text', label: 'Ciudad' },
        { name: 'label', type: 'text', label: 'Texto visible' },
        { name: 'href', type: 'text', label: 'URL' },
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagen' },
      ],
    },
    { name: 'ctaLabel', type: 'text', label: 'Texto de CTA' },
    { name: 'ctaHref', type: 'text', label: 'URL de CTA' },
  ],
}

export const PromoBannerSection: Block = {
  slug: 'promoBanner',
  labels: { singular: 'Promo banner', plural: 'Promo banners' },
  fields: [
    { name: 'eyebrow', type: 'text', defaultValue: 'Promocion', label: 'Etiqueta' },
    { name: 'heading', type: 'text', defaultValue: 'Promocion especial', label: 'Titulo' },
    { name: 'body', type: 'textarea', label: 'Texto' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagen de campana' },
    { name: 'mobileImage', type: 'upload', relationTo: 'media', label: 'Imagen movil' },
    { name: 'imageAlt', type: 'text', label: 'Texto alternativo' },
    {
      name: 'variant',
      type: 'select',
      defaultValue: 'image',
      label: 'Variante',
      options: [
        { label: 'Imagen completa', value: 'image' },
        { label: 'Texto + imagen', value: 'split' },
        { label: 'Compacto', value: 'compact' },
      ],
    },
    {
      name: 'theme',
      type: 'select',
      defaultValue: 'brand',
      label: 'Tema',
      options: [
        { label: 'Marca', value: 'brand' },
        { label: 'Claro', value: 'light' },
        { label: 'Oscuro', value: 'dark' },
      ],
    },
    { name: 'href', type: 'text', label: 'URL de banner' },
    { name: 'ctaLabel', type: 'text', label: 'Texto de CTA' },
    { name: 'ctaHref', type: 'text', label: 'URL de CTA' },
  ],
}

export const TrustStepsSection: Block = {
  slug: 'trustSteps',
  labels: { singular: 'Pasos de confianza', plural: 'Pasos de confianza' },
  fields: [
    { name: 'eyebrow', type: 'text', defaultValue: 'Compra con confianza', label: 'Etiqueta' },
    { name: 'heading', type: 'text', defaultValue: 'Te acompanamos en cada paso', label: 'Titulo' },
    { name: 'body', type: 'textarea', label: 'Texto' },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'steps',
      label: 'Diseno',
      options: [
        { label: 'Pasos', value: 'steps' },
        { label: 'Tarjetas', value: 'cards' },
      ],
    },
    {
      name: 'steps',
      type: 'array',
      label: 'Pasos',
      labels: { singular: 'Paso', plural: 'Pasos' },
      fields: [
        {
          name: 'icon',
          type: 'select',
          defaultValue: 'search',
          label: 'Icono',
          options: [
            { label: 'Busqueda', value: 'search' },
            { label: 'Revision', value: 'inspection' },
            { label: 'Financiamiento', value: 'financing' },
            { label: 'Entrega', value: 'delivery' },
            { label: 'Garantia', value: 'shield' },
          ],
        },
        { name: 'label', type: 'text', label: 'Titulo' },
        { name: 'description', type: 'textarea', label: 'Descripcion' },
      ],
    },
  ],
}

export const TestimonialsSection: Block = {
  slug: 'testimonials',
  labels: { singular: 'Testimonios', plural: 'Testimonios' },
  fields: [
    { name: 'eyebrow', type: 'text', defaultValue: 'Clientes felices', label: 'Etiqueta' },
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'Historias de nuestros clientes',
      label: 'Titulo',
    },
    { name: 'body', type: 'textarea', label: 'Texto' },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'carousel',
      label: 'Diseno',
      options: [
        { label: 'Carrusel', value: 'carousel' },
        { label: 'Cuadricula', value: 'grid' },
      ],
    },
    {
      name: 'items',
      type: 'array',
      label: 'Testimonios',
      labels: { singular: 'Testimonio', plural: 'Testimonios' },
      fields: [
        { name: 'quote', type: 'textarea', label: 'Cita' },
        { name: 'author', type: 'text', label: 'Autor' },
        { name: 'role', type: 'text', label: 'Detalle' },
        { name: 'city', type: 'text', label: 'Ciudad' },
        { name: 'rating', type: 'number', defaultValue: 5, label: 'Calificacion' },
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Foto' },
      ],
    },
    { name: 'ctaLabel', type: 'text', label: 'Texto de CTA' },
    { name: 'ctaHref', type: 'text', label: 'URL de CTA' },
  ],
}

export const VideoTipsSection: Block = {
  slug: 'videoTips',
  labels: { singular: 'Video tips', plural: 'Video tips' },
  fields: [
    { name: 'eyebrow', type: 'text', defaultValue: 'Guias en video', label: 'Etiqueta' },
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'Tips para elegir tu proximo auto',
      label: 'Titulo',
    },
    { name: 'body', type: 'textarea', label: 'Texto' },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'featured',
      label: 'Diseno',
      options: [
        { label: 'Destacado + lista', value: 'featured' },
        { label: 'Cuadricula', value: 'grid' },
      ],
    },
    {
      name: 'videos',
      type: 'array',
      label: 'Videos',
      labels: { singular: 'Video', plural: 'Videos' },
      fields: [
        { name: 'title', type: 'text', label: 'Titulo' },
        { name: 'description', type: 'textarea', label: 'Descripcion' },
        { name: 'videoUrl', type: 'text', label: 'Video URL' },
        { name: 'thumbnail', type: 'upload', relationTo: 'media', label: 'Miniatura' },
        { name: 'duration', type: 'text', label: 'Duracion' },
      ],
    },
    { name: 'ctaLabel', type: 'text', label: 'Texto de CTA' },
    { name: 'ctaHref', type: 'text', label: 'URL de CTA' },
  ],
}

export const BrandsSection: Block = {
  slug: 'brands',
  labels: { singular: 'Marcas', plural: 'Marcas' },
  fields: [
    { name: 'eyebrow', type: 'text', defaultValue: 'Marcas' },
    { name: 'heading', type: 'text', defaultValue: 'Las mejores marcas, en un solo lugar' },
    { name: 'body', type: 'textarea' },
  ],
}

export const AgenciesSection: Block = {
  slug: 'agencies',
  labels: { singular: 'Agencias', plural: 'Agencias' },
  fields: [
    { name: 'eyebrow', type: 'text', defaultValue: 'Encuentranos' },
    { name: 'heading', type: 'text', defaultValue: 'Nuestras agencias' },
    { name: 'body', type: 'textarea' },
    { name: 'showMap', type: 'checkbox', defaultValue: true },
  ],
}

export const MediaTextSection: Block = {
  slug: 'mediaText',
  labels: { singular: 'Imagen y texto', plural: 'Imagen y texto' },
  fields: [
    { name: 'eyebrow', type: 'text' },
    { name: 'heading', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'media', type: 'upload', relationTo: 'media' },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'mediaLeft',
      options: [
        { label: 'Imagen izquierda', value: 'mediaLeft' },
        { label: 'Imagen derecha', value: 'mediaRight' },
      ],
    },
    { name: 'link', type: 'group', fields: linkFields },
  ],
}

export const CtaSection: Block = {
  slug: 'cta',
  labels: { singular: 'CTA', plural: 'CTAs' },
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'primaryLink', type: 'group', fields: linkFields },
    { name: 'secondaryLink', type: 'group', fields: linkFields },
  ],
}

export const siteSectionBlocks = [
  HeroSection,
  PromoStripSection,
  FeaturedVehiclesSection,
  InventoryCollectionSection,
  InventorySearchSection,
  CityInventorySection,
  PromoBannerSection,
  TrustStepsSection,
  TestimonialsSection,
  VideoTipsSection,
  BrandsSection,
  AgenciesSection,
  MediaTextSection,
  CtaSection,
]
