/**
 * Bounded public ingestion + reference contracts (F005/F006).
 *
 * These are the shapes the Storefront uses once it migrates off the raw
 * Payload collection endpoints (`/api/dealerships`, `/api/leads`,
 * `/api/analytics-events`) onto the narrow `/api/public/*` surface.
 */

import type { AnalyticsEventType } from './analytics'

/** Safe public projection of a dealership: routing/contact data only.
 * Internal fields (source aliases, sales rep, internal notes, coordinates)
 * never appear. */
export type PublicDealership = {
  id: number | string
  brandName: string
  displayName: string
  city: string
  state: string | null
  address: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  hours: string | null
  websiteUrl: string | null
  mapUrl: string | null
  defaultForCity: boolean
}

export type PublicDealershipList = {
  docs: PublicDealership[]
}

/** Fields a visitor may submit when creating a lead. Server assigns
 * everything else (timestamps, workflow state beyond the entry stage). */
export type PublicLeadSubmission = {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  city?: string
  agency?: number | string
  vehicle?: number | string
  vehicleLabel?: string
  whatsappNumber?: string
  whatsappOpenedAt?: string
  sourcePage?: string
  sourceSection?: string
  leadSource?: string
  source?: string
  message?: string
  /** Entry stages only; anything else is ignored server-side. */
  stage?: 'new' | 'whatsapp_opened'
}

export type PublicLeadResult = {
  ok: boolean
  leadId?: number | string
  /** True when an identical submission landed within the replay window and
   * the original lead was reused (replay = no-op). */
  duplicate?: boolean
  error?: string
}

export type PublicAnalyticsSubmission = {
  eventType: AnalyticsEventType
  pagePath: string
  pageTitle?: string
  vehicle?: number | string
  vehicleLabel?: string
  targetLabel?: string
  agency?: number | string
  city?: string
  brand?: string
  condition?: string
  collectionId?: number | string
  leadId?: number | string
  sourceSection?: string
  durationSeconds?: number
  sessionId?: string
  visitorId?: string
  deviceType?: 'mobile' | 'tablet' | 'desktop'
  referrer?: string
}
