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
  labels: {
    singular: 'Agencia',
    plural: 'Agencias',
  },
  fields: [
    { name: 'brandName', type: 'text', required: true, label: 'Marca' },
    { name: 'displayName', type: 'text', required: true, label: 'Nombre visible' },
    { name: 'city', type: 'text', required: true, label: 'Ciudad' },
    { name: 'phone', type: 'text', label: 'Telefono' },
    { name: 'whatsapp', type: 'text', label: 'WhatsApp' },
    {
      name: 'coordinates',
      type: 'group',
      label: 'Coordenadas',
      fields: [
        { name: 'lat', type: 'number', label: 'Latitud' },
        { name: 'lng', type: 'number', label: 'Longitud' },
      ],
    },
    { name: 'isActive', type: 'checkbox', defaultValue: true, label: 'Activa' },
  ],
}
