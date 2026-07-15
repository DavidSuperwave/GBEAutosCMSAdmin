import { APIError, type CollectionConfig, type FieldAccess } from 'payload'

import { canManageLeads, hasRole, isAdminAccess } from '../access/roles'
import {
  PUBLIC_LEAD_RATE_LIMIT,
  clientKeyFromHeaders,
  isRateLimited,
  sanitizePublicLeadInput,
} from '../services/publicIngestionGuard'

/** Management fields only sales-capable staff may set; public submissions
 * cannot inject workflow state. */
const salesFieldAccess: FieldAccess = ({ req }) => hasRole(req.user, 'admin', 'sales')

export const Leads: CollectionConfig = {
  slug: 'leads',
  access: {
    create: () => true,
    read: canManageLeads,
    update: canManageLeads,
    delete: isAdminAccess,
  },
  hooks: {
    beforeValidate: [
      ({ data, req, operation }) => {
        if (operation !== 'create' || req.user || !data) return data
        if (isRateLimited(`leads:${clientKeyFromHeaders(req.headers)}`, PUBLIC_LEAD_RATE_LIMIT)) {
          throw new APIError('Demasiadas solicitudes. Intenta de nuevo más tarde.', 429)
        }
        return sanitizePublicLeadInput(data)
      },
    ],
  },
  admin: {
    group: false,
    useAsTitle: 'firstName',
    defaultColumns: [
      'firstName',
      'city',
      'agency',
      'vehicleLabel',
      'leadSource',
      'stage',
      'createdAt',
    ],
    listSearchableFields: [
      'firstName',
      'lastName',
      'email',
      'phone',
      'city',
      'vehicleLabel',
      'sourcePage',
    ],
  },
  labels: {
    singular: 'Lead',
    plural: 'Leads',
  },
  fields: [
    { name: 'firstName', type: 'text', required: true, label: 'Nombre' },
    { name: 'lastName', type: 'text', label: 'Apellido' },
    { name: 'email', type: 'email', label: 'Correo electronico' },
    { name: 'phone', type: 'text', label: 'Telefono' },
    { name: 'city', type: 'text', label: 'Ciudad / ubicación' },
    { name: 'agency', type: 'relationship', relationTo: 'dealerships', label: 'Agencia enrutada' },
    { name: 'vehicleLabel', type: 'text', label: 'Vehiculo mostrado' },
    { name: 'whatsappNumber', type: 'text', label: 'WhatsApp enrutado' },
    { name: 'whatsappOpenedAt', type: 'date', label: 'WhatsApp abierto el' },
    { name: 'sourcePage', type: 'text', label: 'Página de origen' },
    { name: 'sourceSection', type: 'text', label: 'Seccion de origen' },
    {
      name: 'leadSource',
      type: 'select',
      label: 'Fuente del lead',
      defaultValue: 'whatsapp_vehicle_form',
      options: [
        { label: 'Formulario WhatsApp vehículo', value: 'whatsapp_vehicle_form' },
        { label: 'Formulario de contacto', value: 'contact_form' },
        { label: 'Clic telefonico', value: 'phone_click' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      label: 'Origen',
      defaultValue: 'website_form',
      options: [
        { label: 'Formulario web', value: 'website_form' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Formulario WhatsApp vehículo', value: 'whatsapp_vehicle_form' },
        { label: 'Formulario de contacto', value: 'contact_form' },
        { label: 'Clic telefonico', value: 'phone_click' },
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
      // Creation stays open because the Storefront submits
      // stage: 'whatsapp_opened'; the ingestion guard limits anonymous
      // submissions to entry stages. Advancing a lead is sales-only.
      access: { update: salesFieldAccess },
      options: [
        { label: 'Nuevo', value: 'new' },
        { label: 'WhatsApp abierto', value: 'whatsapp_opened' },
        { label: 'Contactado', value: 'contacted' },
        { label: 'Cita agendada', value: 'appointment_set' },
        { label: 'En proceso', value: 'in_progress' },
        { label: 'Venta ganada', value: 'closed_won' },
        { label: 'Venta perdida', value: 'closed_lost' },
      ],
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'users',
      label: 'Asignado a',
      access: { create: salesFieldAccess, update: salesFieldAccess },
    },
    {
      name: 'contactedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Contactado por',
      access: { create: salesFieldAccess, update: salesFieldAccess },
    },
    {
      name: 'contactedAt',
      type: 'date',
      label: 'Contactado el',
      access: { create: salesFieldAccess, update: salesFieldAccess },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notas',
      access: { create: salesFieldAccess, update: salesFieldAccess },
    },
  ],
}
