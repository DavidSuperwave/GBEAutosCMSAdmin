import type { CollectionConfig } from 'payload'

import { canManageInventory } from '../access/roles'

/**
 * Import jobs power the Bulk Import Center. Each upload becomes a job that
 * records the file, the column mapping, validation results and the vehicles it
 * created so imports can be reviewed and rolled back.
 */
export const ImportJobs: CollectionConfig = {
  slug: 'import-jobs',
  access: {
    read: canManageInventory,
    create: canManageInventory,
    update: canManageInventory,
    delete: canManageInventory,
  },
  admin: {
    // Created by the import modal; surfaced on the dashboard. Hidden from nav.
    hidden: true,
    group: 'Inventario',
    useAsTitle: 'fileName',
    defaultColumns: ['fileName', 'status', 'rowCount', 'createdCount', 'createdAt'],
  },
  labels: {
    singular: 'Importación',
    plural: 'Importaciones',
  },
  fields: [
    { name: 'fileName', type: 'text', required: true, label: 'Archivo' },
    {
      name: 'fileType',
      type: 'select',
      label: 'Tipo de archivo',
      defaultValue: 'csv',
      options: [
        { label: 'CSV', value: 'csv' },
        { label: 'XLSX', value: 'xlsx' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      label: 'Estado',
      defaultValue: 'pending',
      options: [
        { label: 'Pendiente', value: 'pending' },
        { label: 'Validando', value: 'validating' },
        { label: 'Listo para importar', value: 'ready' },
        { label: 'Importando', value: 'importing' },
        { label: 'Completado', value: 'completed' },
        { label: 'Revertido', value: 'rolled_back' },
        { label: 'Fallido', value: 'failed' },
      ],
    },
    { name: 'rowCount', type: 'number', label: 'Filas procesadas', defaultValue: 0 },
    { name: 'createdCount', type: 'number', label: 'Creados', defaultValue: 0 },
    { name: 'updatedCount', type: 'number', label: 'Actualizados', defaultValue: 0 },
    { name: 'skippedCount', type: 'number', label: 'Omitidos (duplicados)', defaultValue: 0 },
    { name: 'reviewCount', type: 'number', label: 'Requieren revisión', defaultValue: 0 },
    { name: 'errorCount', type: 'number', label: 'Errores', defaultValue: 0 },
    {
      name: 'mapping',
      type: 'json',
      label: 'Mapeo de columnas',
      admin: { description: 'Mapa de columna de archivo -> campo del CMS.' },
    },
    {
      name: 'summary',
      type: 'textarea',
      label: 'Resumen',
    },
    {
      name: 'errors',
      type: 'array',
      label: 'Errores por fila',
      fields: [
        { name: 'row', type: 'number', label: 'Fila' },
        { name: 'message', type: 'text', label: 'Mensaje' },
      ],
    },
    {
      name: 'createdVehicleIds',
      type: 'json',
      label: 'IDs de vehículos creados',
      admin: { description: 'Usado para revisar o revertir esta importación.' },
    },
    {
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Importado por',
      admin: { readOnly: true },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req?.user?.id && !data.uploadedBy) {
          data.uploadedBy = req.user.id
        }
        return data
      },
    ],
  },
}
