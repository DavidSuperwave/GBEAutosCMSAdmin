import type { Block } from 'payload'

const linkFields = [
  { name: 'label', type: 'text' as const, required: true },
  { name: 'href', type: 'text' as const, required: true },
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
      options: [
        { label: 'Sedan', value: 'sedan' },
        { label: 'SUV', value: 'suv' },
        { label: 'Pickup', value: 'pickup' },
        { label: 'Coupe', value: 'coupe' },
        { label: 'Hatchback', value: 'hatchback' },
        { label: 'Van', value: 'van' },
        { label: 'Otro', value: 'other' },
      ],
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
      options: [
        { label: 'Todas', value: '' },
        { label: 'Sedan', value: 'sedan' },
        { label: 'SUV', value: 'suv' },
        { label: 'Pickup', value: 'pickup' },
        { label: 'Coupe', value: 'coupe' },
        { label: 'Hatchback', value: 'hatchback' },
        { label: 'Van', value: 'van' },
        { label: 'Otro', value: 'other' },
      ],
    },
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
  InventorySearchSection,
  BrandsSection,
  AgenciesSection,
  MediaTextSection,
  CtaSection,
]
