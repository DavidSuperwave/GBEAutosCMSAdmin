import type { CollectionConfig } from 'payload'

import { canManageMedia } from '../access/roles'

/**
 * AI Workshop jobs. A job captures the vehicle context, input images, preset
 * and prompt used to generate or edit vehicle imagery, plus the outputs and
 * approval result. Generation itself is performed by the workshop generate
 * endpoint, which is stubbed behind AI_IMAGE_API_KEY until a provider is set.
 */
export const WorkshopJobs: CollectionConfig = {
  slug: 'workshop-jobs',
  access: {
    read: canManageMedia,
    create: canManageMedia,
    update: canManageMedia,
    delete: canManageMedia,
  },
  admin: {
    // Driven by the in-vehicle image studio + generate API; hidden from nav.
    hidden: true,
    group: 'Media Workshop',
    useAsTitle: 'title',
    defaultColumns: ['title', 'linkedVehicle', 'promptPreset', 'status', 'updatedAt'],
  },
  labels: {
    singular: 'Trabajo de taller',
    plural: 'Trabajos de taller',
  },
  fields: [
    { name: 'title', type: 'text', label: 'Título del trabajo' },
    {
      name: 'linkedVehicle',
      type: 'relationship',
      relationTo: 'vehicles',
      label: 'Vehículo',
    },
    {
      name: 'inputImages',
      type: 'array',
      label: 'Imágenes de entrada',
      fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }],
    },
    {
      name: 'promptPreset',
      type: 'select',
      label: 'Preset',
      defaultValue: 'vehicle_hero',
      options: [
        { label: 'Hero de listado', value: 'vehicle_hero' },
        { label: 'Fondo transparente', value: 'transparent_bg' },
        { label: 'Fondo de agencia limpio', value: 'clean_dealership_bg' },
        { label: 'Logo sobrepuesto', value: 'logo_overlay' },
        { label: 'Banner de homepage', value: 'homepage_banner' },
        { label: 'Anuncio para redes', value: 'social_ad' },
        { label: 'Promo banner', value: 'promo_banner' },
        { label: 'Portada de galería seminuevo', value: 'seminuevo_gallery_cover' },
        { label: 'Imagen representativa auto nuevo', value: 'new_car_representative' },
      ],
    },
    { name: 'prompt', type: 'textarea', label: 'Prompt' },
    {
      name: 'styleTemplate',
      type: 'relationship',
      relationTo: 'image-templates',
      label: 'Estilo / plantilla',
    },
    { name: 'styleName', type: 'text', label: 'Nombre del estilo' },
    { name: 'stylePrompt', type: 'textarea', label: 'Prompt del estilo' },
    {
      name: 'messages',
      type: 'array',
      label: 'Mensajes',
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          defaultValue: 'user',
          options: [
            { label: 'Usuario', value: 'user' },
            { label: 'Asistente', value: 'assistant' },
            { label: 'Sistema', value: 'system' },
          ],
        },
        { name: 'content', type: 'textarea', required: true, label: 'Contenido' },
        { name: 'createdAt', type: 'date', label: 'Creado el' },
      ],
    },
    {
      name: 'vehicleContext',
      type: 'group',
      label: 'Contexto del vehículo',
      admin: { description: 'Se completa automáticamente desde el vehículo enlazado.' },
      fields: [
        { name: 'brand', type: 'text', label: 'Marca' },
        { name: 'model', type: 'text', label: 'Modelo' },
        { name: 'year', type: 'number', label: 'Año' },
        { name: 'color', type: 'text', label: 'Color' },
      ],
    },
    {
      name: 'styleReferenceUrl',
      type: 'text',
      label: 'URL de referencia de estilo',
      admin: { readOnly: true },
    },
    {
      name: 'outputs',
      type: 'array',
      label: 'Resultados',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagen' },
        { name: 'url', type: 'text', label: 'URL temporal' },
        {
          name: 'selected',
          type: 'checkbox',
          label: 'Seleccionada',
        },
      ],
    },
    {
      name: 'approvedOutput',
      type: 'upload',
      relationTo: 'media',
      label: 'Resultado aprobado',
    },
    {
      name: 'saveDestination',
      type: 'select',
      label: 'Destino al guardar',
      options: [
        { label: 'Hero del vehículo', value: 'vehicle_hero' },
        { label: 'Galería del vehículo', value: 'vehicle_gallery' },
        { label: 'Sección de listado', value: 'vehicle_listing_section' },
        { label: 'Sección de homepage', value: 'homepage_section' },
        { label: 'Sección de landing', value: 'landing_section' },
        { label: 'Promo banner', value: 'promo_banner' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      label: 'Estado',
      defaultValue: 'draft',
      options: [
        { label: 'Borrador', value: 'draft' },
        { label: 'Generando', value: 'generating' },
        { label: 'Listo para revisión', value: 'ready_for_review' },
        { label: 'Aprobado', value: 'approved' },
        { label: 'Rechazado', value: 'rejected' },
        { label: 'Fallido', value: 'failed' },
      ],
    },
    { name: 'error', type: 'text', label: 'Error', admin: { readOnly: true } },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Creado por',
      admin: { readOnly: true },
    },
    { name: 'completedAt', type: 'date', label: 'Completado el', admin: { readOnly: true } },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req?.user?.id && !data.createdBy) {
          data.createdBy = req.user.id
        }
        if ((data.status === 'approved' || data.status === 'rejected') && !data.completedAt) {
          data.completedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
}
