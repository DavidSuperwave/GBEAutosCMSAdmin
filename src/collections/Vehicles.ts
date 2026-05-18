import type { CollectionConfig } from 'payload'

export const Vehicles: CollectionConfig = {
  slug: 'vehicles',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'model',
    defaultColumns: ['brand', 'model', 'year', 'price', 'status'],
    listSearchableFields: ['slug', 'brand', 'model'],
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'brand', type: 'text', required: true },
    { name: 'model', type: 'text', required: true },
    { name: 'year', type: 'number', required: true },
    { name: 'price', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'available',
      options: [
        { label: 'Available', value: 'available' },
        { label: 'Reserved', value: 'reserved' },
        { label: 'Sold', value: 'sold' },
      ],
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    { name: 'description', type: 'textarea' },
    {
      name: 'features',
      type: 'array',
      fields: [{ name: 'feature', type: 'text', required: true }],
    },
    {
      name: 'specs',
      type: 'group',
      fields: [
        { name: 'motor', type: 'text' },
        { name: 'potencia', type: 'text' },
        { name: 'transmision', type: 'text' },
        { name: 'combustible', type: 'text' },
        { name: 'traccion', type: 'text' },
      ],
    },
  ],
}
