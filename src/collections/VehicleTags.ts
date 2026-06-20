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

export const VehicleTags: CollectionConfig = {
  slug: 'vehicle-tags',
  access: {
    read: () => true,
    create: canManageInventory,
    update: canManageInventory,
    delete: canManageInventory,
  },
  admin: {
    group: false,
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'isVisible', 'sortOrder'],
    listSearchableFields: ['name', 'slug', 'label', 'description'],
  },
  labels: {
    singular: 'Tag de vehículo',
    plural: 'Tags de vehículos',
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
    { name: 'label', type: 'text', label: 'Etiqueta publica' },
    { name: 'description', type: 'textarea', label: 'Descripcion' },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'manual',
      label: 'Tipo',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Automatica', value: 'automatic' },
        { label: 'Sistema', value: 'system' },
      ],
    },
    { name: 'color', type: 'text', label: 'Color' },
    { name: 'isVisible', type: 'checkbox', defaultValue: true, label: 'Visible en sitio' },
    { name: 'sortOrder', type: 'number', label: 'Orden' },
  ],
}
