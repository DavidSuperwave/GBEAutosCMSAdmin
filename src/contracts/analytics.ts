/**
 * Analytics event contract (F038).
 *
 * Single source of truth for the analytics event taxonomy. The
 * AnalyticsEvents collection derives its select options from this list, and
 * the Storefront's AnalyticsTracker emits these exact values. The CI drift
 * check fails when a consumed event type disappears from this file.
 */

export const ANALYTICS_EVENT_TYPE_OPTIONS = [
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
] as const

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPE_OPTIONS)[number]['value']

export const ANALYTICS_EVENT_TYPES = ANALYTICS_EVENT_TYPE_OPTIONS.map(
  (option) => option.value,
) as AnalyticsEventType[]
