import type { CollectionConfig } from 'payload'

import { canManageMedia } from '../access/roles'

/**
 * Persistent cache for provider image searches. This prevents repeat API calls
 * for the same normalized vehicle identity across server restarts and lets the
 * image studio explain whether results came from local assets, cache, or the
 * provider.
 */
export const VehicleImageSearches: CollectionConfig = {
  slug: 'vehicle-image-searches',
  access: {
    read: canManageMedia,
    create: canManageMedia,
    update: canManageMedia,
    delete: canManageMedia,
  },
  admin: {
    hidden: true,
    group: 'Media Workshop',
    useAsTitle: 'matchKey',
    defaultColumns: ['matchKey', 'provider', 'fetchedAt', 'expiresAt'],
  },
  labels: {
    singular: 'Búsqueda de imagen de vehículo',
    plural: 'Búsquedas de imágenes de vehículos',
  },
  fields: [
    { name: 'provider', type: 'text', defaultValue: 'carsxe', required: true, label: 'Proveedor' },
    { name: 'matchKey', type: 'text', required: true, index: true, label: 'Clave de coincidencia' },
    { name: 'query', type: 'json', label: 'Consulta' },
    { name: 'candidates', type: 'json', label: 'Candidatas' },
    { name: 'fetchedAt', type: 'date', label: 'Consultado el' },
    { name: 'expiresAt', type: 'date', label: 'Expira el', index: true },
    { name: 'lastError', type: 'text', label: 'Último error' },
  ],
}
