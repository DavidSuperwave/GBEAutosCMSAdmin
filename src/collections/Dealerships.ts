import type { CollectionConfig } from 'payload'

export const Dealerships: CollectionConfig = {
  slug: 'dealerships',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'city', 'phone', 'isActive'],
    listSearchableFields: ['brandName', 'displayName', 'city'],
  },
  fields: [
    { name: 'brandName', type: 'text', required: true },
    { name: 'displayName', type: 'text', required: true },
    { name: 'city', type: 'text', required: true },
    { name: 'phone', type: 'text' },
    { name: 'whatsapp', type: 'text' },
    {
      name: 'coordinates',
      type: 'group',
      fields: [
        { name: 'lat', type: 'number' },
        { name: 'lng', type: 'number' },
      ],
    },
    { name: 'isActive', type: 'checkbox', defaultValue: true },
  ],
}
