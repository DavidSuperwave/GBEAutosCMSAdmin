import type { CollectionConfig } from 'payload'

import { siteSectionBlocks } from '../blocks/SiteSections'
import { canManageContent } from '../access/roles'

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'
const protectedSlugs = [
  'api',
  'cars',
  'seminuevos',
  'marcas',
  'contacts',
  'contact',
  'contacto',
  'admin',
]

function slugify(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: {
    read: () => true,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  admin: {
    group: false,
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'showInNavigation', 'updatedAt'],
    livePreview: {
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 390, height: 844 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
      url: ({ data }) => `${FRONTEND_URL}/${typeof data?.slug === 'string' ? data.slug : ''}`,
    },
    preview: (doc) => `${FRONTEND_URL}/${typeof doc?.slug === 'string' ? doc.slug : ''}`,
  },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Titulo' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'No uses rutas reservadas como cars, seminuevos, marcas o api.',
      },
      hooks: {
        beforeValidate: [
          ({ data, value }) => {
            const next = slugify(value || data?.title)
            return protectedSlugs.includes(next) ? `${next}-pagina` : next
          },
        ],
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      label: 'Estatus',
      options: [
        { label: 'Borrador', value: 'draft' },
        { label: 'Publicado', value: 'published' },
        { label: 'Archivado', value: 'archived' },
      ],
    },
    { name: 'isVisible', type: 'checkbox', defaultValue: false, label: 'Visible en sitio' },
    {
      name: 'showInNavigation',
      type: 'checkbox',
      defaultValue: false,
      label: 'Mostrar en navegacion',
    },
    { name: 'navLabel', type: 'text', label: 'Etiqueta de navegacion' },
    { name: 'navParent', type: 'text', label: 'Grupo padre de navegacion' },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'image', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      name: 'sections',
      type: 'blocks',
      blocks: siteSectionBlocks,
      required: true,
      label: 'Secciones',
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data.status === 'published') data.isVisible = true
        if (data.status === 'draft' || data.status === 'archived') data.isVisible = false
        return data
      },
    ],
  },
}
