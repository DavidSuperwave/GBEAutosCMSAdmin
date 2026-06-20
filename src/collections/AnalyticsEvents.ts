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
      options: [
        { label: 'Vista de pagina', value: 'page_view' },
        { label: 'Vista de vehículo', value: 'vehicle_view' },
        { label: 'Clic en vehículo', value: 'vehicle_click' },
        { label: 'Formulario WhatsApp abierto', value: 'whatsapp_form_open' },
        { label: 'Formulario WhatsApp enviado', value: 'whatsapp_form_submit' },
        { label: 'WhatsApp abierto', value: 'whatsapp_open' },
        { label: 'Vista de coleccion', value: 'collection_view' },
        { label: 'Filtro usado', value: 'filter_used' },
        { label: 'Clic en llamada a la acción', value: 'cta_click' },
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
