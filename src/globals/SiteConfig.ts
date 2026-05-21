import type { GlobalConfig } from 'payload'

import { siteSectionBlocks } from '../blocks/SiteSections'

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'

export const SiteConfig: GlobalConfig = {
  slug: 'site-config',
  label: 'Site Builder',
  access: {
    read: () => true,
  },
  admin: {
    livePreview: {
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 390, height: 844 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
      url: () => FRONTEND_URL,
    },
    preview: () => FRONTEND_URL,
  },
  fields: [
    {
      name: 'general',
      type: 'group',
      label: 'Configuracion general',
      fields: [
        { name: 'siteName', type: 'text', defaultValue: 'GB Automotriz' },
        { name: 'companyName', type: 'text' },
        { name: 'slogan', type: 'text' },
        { name: 'logo', type: 'upload', relationTo: 'media' },
        { name: 'phone', type: 'text' },
        { name: 'whatsapp', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'address', type: 'text' },
        {
          name: 'socialLinks',
          type: 'group',
          fields: [
            { name: 'facebook', type: 'text' },
            { name: 'instagram', type: 'text' },
            { name: 'whatsappUrl', type: 'text' },
          ],
        },
      ],
    },
    {
      name: 'navigation',
      type: 'group',
      label: 'Navegacion',
      fields: [
        {
          name: 'mainLinks',
          type: 'array',
          fields: [
            { name: 'label', type: 'text', required: true },
            { name: 'href', type: 'text', required: true },
            {
              name: 'children',
              type: 'array',
              fields: [
                { name: 'label', type: 'text', required: true },
                { name: 'href', type: 'text', required: true },
              ],
            },
          ],
        },
        {
          name: 'cta',
          type: 'group',
          fields: [
            { name: 'label', type: 'text' },
            { name: 'href', type: 'text' },
          ],
        },
      ],
    },
    {
      name: 'home',
      type: 'group',
      label: 'Homepage',
      fields: [
        {
          name: 'sections',
          type: 'blocks',
          blocks: siteSectionBlocks,
          label: 'Secciones',
        },
      ],
    },
    {
      name: 'templates',
      type: 'group',
      label: 'Plantillas dinamicas',
      fields: [
        {
          name: 'seminuevos',
          type: 'group',
          label: 'Seminuevos',
          fields: [
            { name: 'title', type: 'text', defaultValue: 'Autos seminuevos' },
            { name: 'intro', type: 'textarea' },
            { name: 'heroImage', type: 'upload', relationTo: 'media' },
            { name: 'showLocationPrompt', type: 'checkbox', defaultValue: true },
          ],
        },
        {
          name: 'vehicleDetail',
          type: 'group',
          label: 'Detalle de vehiculo',
          fields: [
            { name: 'showSimilarVehicles', type: 'checkbox', defaultValue: true },
            { name: 'ctaHeading', type: 'text', defaultValue: 'Aparta este vehiculo' },
            { name: 'ctaBody', type: 'textarea' },
          ],
        },
      ],
    },
  ],
}
