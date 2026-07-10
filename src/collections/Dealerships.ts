import type { CollectionConfig, FieldAccess } from 'payload'

import { isAdminAccess, rolesAccess } from '../access/roles'

/** Internal-only fields: hidden from the anonymous storefront reads. The
 * Storefront consumption contract (contracts/storefront-consumption.json)
 * confirms it never reads these. */
const staffOnlyRead: FieldAccess = ({ req }) => Boolean(req.user)

const canEditDealerships = rolesAccess('content_editor', 'inventory_manager')

export const Dealerships: CollectionConfig = {
  slug: 'dealerships',
  access: {
    read: () => true,
    create: canEditDealerships,
    update: canEditDealerships,
    delete: isAdminAccess,
  },
  admin: {
    group: false,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'brandName', 'city', 'whatsapp', 'defaultForCity', 'isActive'],
    listSearchableFields: ['brandName', 'displayName', 'city', 'state'],
  },
  labels: {
    singular: 'Agencia',
    plural: 'Agencias',
  },
  fields: [
    {
      name: 'brandName',
      type: 'text',
      required: true,
      label: 'Grupo / marca',
      admin: {
        description:
          'Usa el grupo comercial para enrutar WhatsApp: ford, mazda, lincoln, stellantis, dongfeng o jetour.',
      },
    },
    { name: 'displayName', type: 'text', required: true, label: 'Nombre visible' },
    { name: 'city', type: 'text', required: true, label: 'Ciudad' },
    { name: 'state', type: 'text', label: 'Estado' },
    { name: 'address', type: 'textarea', label: 'Direccion' },
    { name: 'phone', type: 'text', label: 'Telefono' },
    { name: 'whatsapp', type: 'text', label: 'WhatsApp' },
    { name: 'email', type: 'email', label: 'Correo de ventas' },
    { name: 'hours', type: 'textarea', label: 'Horario' },
    {
      name: 'coordinates',
      type: 'group',
      label: 'Coordenadas',
      fields: [
        { name: 'lat', type: 'number', label: 'Latitud' },
        { name: 'lng', type: 'number', label: 'Longitud' },
      ],
    },
    {
      name: 'defaultForCity',
      type: 'checkbox',
      defaultValue: false,
      label: 'Agencia predeterminada de la ciudad',
      admin: {
        description: 'Se usa si no hay una agencia exacta para la marca seleccionada.',
      },
    },
    {
      name: 'salesRepName',
      type: 'text',
      label: 'Asesor principal',
      access: { read: staffOnlyRead },
    },
    {
      name: 'internalNotes',
      type: 'textarea',
      label: 'Notas internas',
      access: { read: staffOnlyRead },
      admin: {
        position: 'sidebar',
      },
    },
    { name: 'isActive', type: 'checkbox', defaultValue: true, label: 'Activa' },
  ],
}
