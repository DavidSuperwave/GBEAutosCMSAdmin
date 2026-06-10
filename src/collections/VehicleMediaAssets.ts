import type { CollectionConfig } from 'payload'

import { canManageMedia } from '../access/roles'

/**
 * Vehicle media assets give images a lifecycle (source, approval, match
 * confidence, usage) instead of being bare uploads. They link a media file to a
 * vehicle and track where each image came from and whether it is approved.
 */
export const VehicleMediaAssets: CollectionConfig = {
  slug: 'vehicle-media-assets',
  access: {
    read: () => true,
    create: canManageMedia,
    update: canManageMedia,
    delete: canManageMedia,
  },
  admin: {
    // Managed from the in-vehicle image studio; hidden from the main nav.
    hidden: true,
    group: 'Media Workshop',
    useAsTitle: 'title',
    defaultColumns: ['title', 'vehicle', 'sourceType', 'approvalStatus', 'usage', 'updatedAt'],
  },
  labels: {
    singular: 'Imagen de vehículo',
    plural: 'Imágenes de vehículos',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      admin: { description: 'Etiqueta interna para identificar la imagen.' },
    },
    { name: 'vehicle', type: 'relationship', relationTo: 'vehicles', label: 'Vehículo' },
    { name: 'media', type: 'upload', relationTo: 'media', required: true, label: 'Imagen' },
    {
      name: 'sourceType',
      type: 'select',
      label: 'Origen',
      defaultValue: 'uploaded',
      options: [
        { label: 'Subida', value: 'uploaded' },
        { label: 'Foto de agencia', value: 'dealer_photo' },
        { label: 'Candidata de API', value: 'api_candidate' },
        { label: 'Generada con IA', value: 'ai_generated' },
        { label: 'Editada con IA', value: 'ai_edited' },
        { label: 'Representativa', value: 'representative' },
      ],
    },
    { name: 'sourceUrl', type: 'text', label: 'URL de origen' },
    { name: 'sourceProvider', type: 'text', label: 'Proveedor de origen' },
    {
      name: 'matchKey',
      type: 'text',
      label: 'Clave de coincidencia',
      index: true,
      admin: { readOnly: true, description: 'brand + model + year + trim + exteriorColor normalizados.' },
    },
    { name: 'make', type: 'text', label: 'Marca normalizada', admin: { readOnly: true } },
    { name: 'model', type: 'text', label: 'Modelo normalizado', admin: { readOnly: true } },
    { name: 'year', type: 'number', label: 'Año', admin: { readOnly: true } },
    { name: 'trim', type: 'text', label: 'Trim', admin: { readOnly: true } },
    { name: 'exteriorColor', type: 'text', label: 'Color exterior', admin: { readOnly: true } },
    {
      name: 'approvalStatus',
      type: 'select',
      label: 'Aprobación',
      defaultValue: 'draft',
      options: [
        { label: 'Borrador', value: 'draft' },
        { label: 'En revisión', value: 'needs_review' },
        { label: 'Aprobada', value: 'approved' },
        { label: 'Rechazada', value: 'rejected' },
      ],
    },
    {
      name: 'matchConfidence',
      type: 'select',
      label: 'Confianza de coincidencia',
      defaultValue: 'unknown',
      options: [
        { label: 'Vehículo exacto', value: 'exact_vehicle' },
        { label: 'Mismo trim y color', value: 'same_trim_color' },
        { label: 'Mismo modelo y color', value: 'same_model_color' },
        { label: 'Mismo modelo', value: 'same_model' },
        { label: 'Representativa', value: 'representative' },
        { label: 'Generada', value: 'generated' },
        { label: 'Desconocida', value: 'unknown' },
      ],
    },
    { name: 'exteriorColorMatched', type: 'checkbox', label: 'Color exterior coincide' },
    {
      name: 'rightsStatus',
      type: 'select',
      label: 'Derechos de uso',
      defaultValue: 'unknown',
      options: [
        { label: 'Propios', value: 'owned' },
        { label: 'Con licencia', value: 'licensed' },
        { label: 'Desconocidos', value: 'unknown' },
      ],
    },
    {
      name: 'usage',
      type: 'select',
      label: 'Uso',
      options: [
        { label: 'Hero de vehículo', value: 'vehicle_hero' },
        { label: 'Galería de vehículo', value: 'vehicle_gallery' },
        { label: 'Homepage', value: 'homepage' },
        { label: 'Landing page', value: 'landing_page' },
        { label: 'Promo banner', value: 'promo_banner' },
        { label: 'Anuncio social', value: 'social_ad' },
      ],
    },
    { name: 'notes', type: 'textarea', label: 'Notas' },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Creado por',
      admin: { readOnly: true },
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Aprobado por',
      admin: { readOnly: true },
    },
    { name: 'approvedAt', type: 'date', label: 'Aprobado el', admin: { readOnly: true } },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation, originalDoc, req }) => {
        if (operation === 'create' && req?.user?.id && !data.createdBy) {
          data.createdBy = req.user.id
        }
        if (data.approvalStatus === 'approved' && originalDoc?.approvalStatus !== 'approved') {
          data.approvedAt = new Date().toISOString()
          if (req?.user?.id) data.approvedBy = req.user.id
        }
        return data
      },
    ],
  },
}
