import type { GlobalConfig } from 'payload'

import { siteSectionBlocks } from '../blocks/SiteSections'

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'

export const SiteConfig: GlobalConfig = {
  slug: 'site-config',
  label: 'Configuración del sitio',
  access: {
    read: () => true,
  },
  admin: {
    group: false,
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
      label: 'Configuración general',
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
      label: 'Navegación',
      fields: [
        {
          name: 'mainLinks',
          type: 'array',
          fields: [
            {
              name: 'type',
              type: 'select',
              defaultValue: 'custom',
              options: [
                { label: 'Página', value: 'page' },
                { label: 'Colección', value: 'collection' },
                { label: 'Marca', value: 'brand' },
                { label: 'Filtro de inventario', value: 'inventory' },
                { label: 'URL personalizada', value: 'custom' },
              ],
            },
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
          name: 'footerLinks',
          type: 'array',
          label: 'Links del footer',
          fields: [
            { name: 'label', type: 'text', required: true },
            { name: 'href', type: 'text', required: true },
          ],
        },
        {
          name: 'legalLinks',
          type: 'array',
          label: 'Links legales',
          fields: [
            { name: 'label', type: 'text', required: true },
            { name: 'href', type: 'text', required: true },
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
      label: 'Plantillas dinámicas',
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
          label: 'Detalle de vehículo',
          fields: [
            { name: 'showGallery', type: 'checkbox', defaultValue: true },
            { name: 'showPurchaseCard', type: 'checkbox', defaultValue: true },
            { name: 'showQuickSpecs', type: 'checkbox', defaultValue: true },
            { name: 'showDescription', type: 'checkbox', defaultValue: true },
            { name: 'showFeatures', type: 'checkbox', defaultValue: true },
            { name: 'showSimilarVehicles', type: 'checkbox', defaultValue: true },
            { name: 'showMobileCta', type: 'checkbox', defaultValue: true },
            { name: 'ctaHeading', type: 'text', defaultValue: 'Aparta este vehículo' },
            { name: 'ctaBody', type: 'textarea' },
          ],
        },
      ],
    },
  ],
}
