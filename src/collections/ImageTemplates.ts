import type { CollectionConfig } from 'payload'

import { canManageMedia } from '../access/roles'

/**
 * Reusable AI image templates. A template captures a preset + prompt (and an
 * optional reference image) so the same look can be reused across vehicles from
 * the in-vehicle image studio. Saving a template from the studio writes here;
 * picking one pre-fills the generation wizard.
 */
export const ImageTemplates: CollectionConfig = {
  slug: 'image-templates',
  access: {
    read: canManageMedia,
    create: canManageMedia,
    update: canManageMedia,
    delete: canManageMedia,
  },
  admin: {
    // Created/used from the in-vehicle image studio; hidden from nav.
    hidden: true,
    group: 'Media Workshop',
    useAsTitle: 'name',
    defaultColumns: ['name', 'preset', 'updatedAt'],
  },
  labels: {
    singular: 'Plantilla de imagen',
    plural: 'Plantillas de imagen',
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Nombre' },
    {
      name: 'preset',
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
      name: 'referenceImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Imagen de referencia / plantilla',
    },
    { name: 'description', type: 'text', label: 'Descripción' },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Creado por',
      admin: { readOnly: true },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req?.user?.id && !data.createdBy) {
          data.createdBy = req.user.id
        }
        return data
      },
    ],
  },
}
