import { APIError, type CollectionConfig } from 'payload'

import { ANALYTICS_EVENT_TYPE_OPTIONS } from '../contracts/analytics'
import { isAdminAccess } from '../access/roles'
import {
  PUBLIC_ANALYTICS_RATE_LIMIT,
  clientKeyFromHeaders,
  isRateLimited,
  sanitizePublicAnalyticsInput,
} from '../services/publicIngestionGuard'

export const AnalyticsEvents: CollectionConfig = {
  slug: 'analytics-events',
  access: {
    create: () => true,
    read: ({ req }) => Boolean(req.user),
    // The event log is append-only for everyone but admins (F005 closure).
    update: isAdminAccess,
    delete: isAdminAccess,
  },
  hooks: {
    beforeValidate: [
      ({ data, req, operation }) => {
        if (operation !== 'create' || req.user || !data) return data
        if (
          isRateLimited(`analytics:${clientKeyFromHeaders(req.headers)}`, PUBLIC_ANALYTICS_RATE_LIMIT)
        ) {
          throw new APIError('Demasiadas solicitudes.', 429)
        }
        return sanitizePublicAnalyticsInput(data)
      },
    ],
  },
  admin: {
    // Raw event log (collected automatically, summarized on the Analítica
    // dashboard). Hidden from nav to keep the sidebar clean.
    hidden: true,
    group: 'Analitica',
    useAsTitle: 'pageTitle',
    defaultColumns: ['eventType', 'pagePath', 'vehicle', 'durationSeconds', 'createdAt'],
    listSearchableFields: ['pagePath', 'pageTitle', 'vehicleLabel', 'targetLabel'],
  },
  labels: {
    singular: 'Evento de analitica',
    plural: 'Eventos de analitica',
  },
  fields: [
    {
      name: 'eventType',
      type: 'select',
      required: true,
      label: 'Tipo de evento',
      options: [...ANALYTICS_EVENT_TYPE_OPTIONS],
    },
    { name: 'pagePath', type: 'text', required: true, label: 'Ruta de pagina' },
    { name: 'pageTitle', type: 'text', label: 'Titulo de pagina' },
    {
      name: 'vehicle',
      type: 'relationship',
      relationTo: 'vehicles',
      label: 'Vehiculo',
    },
    { name: 'vehicleLabel', type: 'text', label: 'Vehiculo mostrado' },
    { name: 'targetLabel', type: 'text', label: 'Elemento con clic' },
    { name: 'agency', type: 'relationship', relationTo: 'dealerships', label: 'Agencia' },
    { name: 'city', type: 'text', label: 'Ciudad' },
    { name: 'brand', type: 'text', label: 'Marca' },
    { name: 'condition', type: 'text', label: 'Condicion' },
    { name: 'collectionId', type: 'relationship', relationTo: 'vehicle-collections', label: 'Coleccion' },
    { name: 'leadId', type: 'relationship', relationTo: 'leads', label: 'Lead' },
    { name: 'sourceSection', type: 'text', label: 'Seccion de origen' },
    { name: 'durationSeconds', type: 'number', label: 'Tiempo en pagina (segundos)' },
    { name: 'sessionId', type: 'text', label: 'Sesion' },
    { name: 'visitorId', type: 'text', label: 'Visitante' },
    {
      name: 'deviceType',
      type: 'select',
      label: 'Dispositivo',
      options: [
        { label: 'Movil', value: 'mobile' },
        { label: 'Tablet', value: 'tablet' },
        { label: 'Escritorio', value: 'desktop' },
      ],
    },
    { name: 'referrer', type: 'text', label: 'Referencia' },
  ],
}
