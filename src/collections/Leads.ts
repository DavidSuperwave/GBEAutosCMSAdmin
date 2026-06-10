import type { CollectionConfig } from 'payload'

import { canManageLeads, isAdminAccess } from '../access/roles'

export const Leads: CollectionConfig = {
  slug: 'leads',
  access: {
    create: () => true,
    read: canManageLeads,
    update: canManageLeads,
    delete: isAdminAccess,
  },
  admin: {
    group: 'Leads',
    useAsTitle: 'firstName',
    defaultColumns: ['firstName', 'lastName', 'phone', 'source', 'stage', 'createdAt'],
  },
  labels: {
    singular: 'Prospecto',
    plural: 'Prospectos',
  },
  fields: [
    { name: 'firstName', type: 'text', required: true, label: 'Nombre' },
    { name: 'lastName', type: 'text', label: 'Apellido' },
    { name: 'email', type: 'email', label: 'Correo electronico' },
    { name: 'phone', type: 'text', required: true, label: 'Telefono' },
    {
      name: 'source',
      type: 'select',
      label: 'Origen',
      defaultValue: 'website_form',
      options: [
        { label: 'Formulario web', value: 'website_form' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Telefono', value: 'phone' },
        { label: 'Visita en agencia', value: 'walk_in' },
      ],
    },
    { name: 'vehicle', type: 'relationship', relationTo: 'vehicles', label: 'Vehiculo' },
    { name: 'message', type: 'textarea', label: 'Mensaje' },
    {
      name: 'stage',
      type: 'select',
      label: 'Etapa',
      defaultValue: 'new',
      options: [
        { label: 'Nuevo', value: 'new' },
        { label: 'Contactado', value: 'contacted' },
        { label: 'En proceso', value: 'in_progress' },
        { label: 'Venta ganada', value: 'closed_won' },
        { label: 'Venta perdida', value: 'closed_lost' },
      ],
    },
    { name: 'notes', type: 'textarea', label: 'Notas' },
  ],
}
