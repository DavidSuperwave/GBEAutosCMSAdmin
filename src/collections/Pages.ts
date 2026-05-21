import type { CollectionConfig } from 'payload'

import { siteSectionBlocks } from '../blocks/SiteSections'

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'
const protectedSlugs = ['api', 'cars', 'seminuevos', 'marcas', 'contacts', 'contact', 'contacto', 'admin']

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
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'isVisible', 'updatedAt'],
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
    { name: 'isVisible', type: 'checkbox', defaultValue: true, label: 'Visible en sitio' },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'image', type: 'upload', relationTo: 'media' },
      ],
    },
    { name: 'sections', type: 'blocks', blocks: siteSectionBlocks, required: true, label: 'Secciones' },
  ],
}
