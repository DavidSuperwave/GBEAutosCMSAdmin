import type { CollectionConfig } from 'payload'

export const AnalyticsEvents: CollectionConfig = {
  slug: 'analytics-events',
  access: {
    create: () => true,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  admin: {
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
      options: [
        { label: 'Vista de pagina', value: 'page_view' },
        { label: 'Vista de vehiculo', value: 'vehicle_view' },
        { label: 'Clic en vehiculo', value: 'vehicle_click' },
        { label: 'Clic en llamada a la accion', value: 'cta_click' },
        { label: 'Tiempo en pagina', value: 'page_duration' },
      ],
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
