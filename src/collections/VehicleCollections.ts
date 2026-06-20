import type { CollectionConfig } from 'payload'

import { canManageInventory } from '../access/roles'

function slugify(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const inventoryStatusOptions = [
  { label: 'Disponible', value: 'available' },
  { label: 'Apartado', value: 'reserved' },
  { label: 'Vendido', value: 'sold' },
]

const publishStatusOptions = [
  { label: 'Borrador', value: 'draft' },
  { label: 'En revision', value: 'needs_review' },
  { label: 'Publicado', value: 'published' },
  { label: 'Archivado', value: 'archived' },
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

const transmissionOptions = [
  { label: 'Automatica', value: 'automatic' },
  { label: 'Manual', value: 'manual' },
  { label: 'CVT', value: 'cvt' },
]

const fuelOptions = [
  { label: 'Gasolina', value: 'gasoline' },
  { label: 'Diesel', value: 'diesel' },
  { label: 'Hibrido', value: 'hybrid' },
  { label: 'Electrico', value: 'electric' },
]

export const VehicleCollections: CollectionConfig = {
  slug: 'vehicle-collections',
  access: {
    read: () => true,
    create: canManageInventory,
    update: canManageInventory,
    delete: canManageInventory,
  },
  admin: {
    group: false,
    useAsTitle: 'name',
    defaultColumns: ['name', 'collectionType', 'sort', 'limit', 'isVisible'],
    listSearchableFields: ['name', 'slug', 'description'],
  },
  labels: {
    singular: 'Colección de vehículos',
    plural: 'Colecciones de vehículos',
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Nombre' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'Slug',
      hooks: {
        beforeValidate: [({ data, value }) => slugify(value || data?.name)],
      },
    },
    { name: 'description', type: 'textarea', label: 'Descripcion' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagen' },
    {
      name: 'collectionType',
      type: 'select',
      required: true,
      defaultValue: 'smart',
      label: 'Tipo de coleccion',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Inteligente', value: 'smart' },
      ],
    },
    {
      name: 'manualVehicles',
      type: 'relationship',
      relationTo: 'vehicles',
      hasMany: true,
      label: 'Vehiculos manuales',
      admin: {
        condition: (_, siblingData) => siblingData?.collectionType === 'manual',
      },
    },
    {
      name: 'rules',
      type: 'group',
      label: 'Reglas inteligentes',
      admin: {
        condition: (_, siblingData) => siblingData?.collectionType !== 'manual',
      },
      fields: [
        {
          name: 'condition',
          type: 'select',
          label: 'Condicion',
          options: [
            { label: 'Nuevo', value: 'new' },
            { label: 'Seminuevo', value: 'used' },
          ],
        },
        { name: 'brand', type: 'text', label: 'Marca' },
        { name: 'city', type: 'text', label: 'Ciudad' },
        { name: 'dealership', type: 'relationship', relationTo: 'dealerships', label: 'Agencia' },
        { name: 'bodyType', type: 'select', options: bodyTypeOptions, label: 'Carroceria' },
        { name: 'segment', type: 'text', label: 'Segmento' },
        { name: 'vehicleType', type: 'text', label: 'Tipo de vehículo' },
        { name: 'fuel', type: 'select', options: fuelOptions, label: 'Combustible' },
        {
          name: 'transmission',
          type: 'select',
          options: transmissionOptions,
          label: 'Transmision',
        },
        {
          name: 'tags',
          type: 'relationship',
          relationTo: 'vehicle-tags',
          hasMany: true,
          label: 'Tags',
        },
        {
          name: 'inventoryStatus',
          type: 'select',
          options: inventoryStatusOptions,
          label: 'Estatus',
        },
        {
          name: 'publishStatus',
          type: 'select',
          options: publishStatusOptions,
          label: 'Publicacion',
        },
      ],
    },
    {
      name: 'sort',
      type: 'select',
      defaultValue: 'newest',
      label: 'Orden',
      options: [
        { label: 'Mas recientes', value: 'newest' },
        { label: 'Más vistos', value: 'mostViewed' },
        { label: 'Mas clics', value: 'mostClicked' },
        { label: 'Mas leads', value: 'mostLeads' },
        { label: 'Precio ascendente', value: 'priceAsc' },
        { label: 'Precio descendente', value: 'priceDesc' },
        { label: 'Menor kilometraje', value: 'mileageAsc' },
        { label: 'Anio descendente', value: 'yearDesc' },
      ],
    },
    { name: 'limit', type: 'number', defaultValue: 12, label: 'Limite' },
    { name: 'isVisible', type: 'checkbox', defaultValue: true, label: 'Visible en sitio' },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      fields: [
        { name: 'title', type: 'text', label: 'Titulo SEO' },
        { name: 'description', type: 'textarea', label: 'Descripcion SEO' },
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagen SEO' },
      ],
    },
  ],
}
