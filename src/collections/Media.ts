import type { CollectionConfig } from 'payload'

import { canManageMedia } from '../access/roles'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: canManageMedia,
    update: canManageMedia,
    delete: canManageMedia,
  },
  admin: {
    group: false,
  },
  labels: {
    singular: 'Medio',
    plural: 'Medios',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: 'Texto alternativo',
    },
  ],
  upload: true,
}
