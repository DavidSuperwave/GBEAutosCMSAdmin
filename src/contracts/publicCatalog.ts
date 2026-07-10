/**
 * Public vehicle catalog contract (F038).
 *
 * Single source of truth for the DTO shapes and option values served by the
 * /api/public/* routes and consumed by the Storefront (GBEautos). The
 * Storefront mirrors these types in lib/vehicles.ts; the CI drift check
 * (scripts/check-storefront-contract.mjs) fails when a consumed member
 * disappears from this file. Contract changes must land Storefront-first or
 * in lockstep — see docs/product/baselines/F020_STOREFRONT_BASELINE_CAPTURE.md.
 */

export type PublicVehicleCard = {
  id: string
  slug: string
  title: string
  condition: 'new' | 'used'
  inventoryStatus: 'available' | 'reserved' | 'sold'
  brand: string
  model: string
  modelFamily?: string
  trim?: string
  year?: number
  priceLabel?: string
  mileage?: number
  city?: string
  agencyName?: string
  exteriorColor?: string
  bodyType?: string
  segment?: string
  fuel?: string
  transmission?: string
  tags: string[]
  image?: { url: string; alt?: string }
  stats?: {
    views?: number
    leads?: number
  }
}

export type PublicVehicleDetail = PublicVehicleCard & {
  description?: string
  features: string[]
  gallery: Array<{ url: string; alt?: string }>
  landing: PublicLandingBlock[]
  specs?: Record<string, unknown>
  templateOverrides?: Record<string, unknown>
}

export type PublicLandingBlock =
  | {
      blockType: 'imageText'
      eyebrow?: string
      heading: string
      body?: string
      image?: { url: string; alt?: string }
      imagePosition?: 'left' | 'right'
    }
  | {
      blockType: 'gallery'
      heading?: string
      images: Array<{ image: { url: string; alt?: string }; alt?: string }>
    }
  | {
      blockType: 'highlightList'
      heading: string
      body?: string
      items: Array<{ label: string; description?: string }>
    }
  | {
      blockType: 'featureGrid'
      heading: string
      items: string[]
    }
  | {
      blockType: 'cta'
      heading: string
      body?: string
      buttonLabel?: string
    }

export const VEHICLE_LANDING_BLOCK_TYPES = [
  'imageText',
  'gallery',
  'highlightList',
  'featureGrid',
  'cta',
] as const

export type VehicleLandingBlockType = (typeof VEHICLE_LANDING_BLOCK_TYPES)[number]

export type PublicVehicleListOptions = {
  page?: number
  limit?: number
  sort?: string
  keyword?: string
  brand?: string
  model?: string
  modelFamily?: string
  city?: string
  agency?: string
  yearMin?: number
  yearMax?: number
  mileageMin?: number
  mileageMax?: number
  bodyType?: string
  segment?: string
  vehicleType?: string
  fuel?: string
  transmission?: string
  condition?: string
  inventoryStatus?: string
  tags?: string[]
}

export type PublicVehicleListResult = {
  docs: PublicVehicleCard[]
  totalDocs: number
  totalPages: number
  page: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

/**
 * Deterministic sorts the public catalog supports. The smart ranks
 * (mostViewed/mostClicked/mostLeads) are deliberately absent: they silently
 * fall back to newest today and are removed from the contract until F036
 * trusted rollups exist (F012).
 */
export const PUBLIC_VEHICLE_SORT_VALUES = [
  'newest',
  'priceAsc',
  'priceDesc',
  'yearDesc',
  'mileageAsc',
] as const

export type PublicVehicleSort = (typeof PUBLIC_VEHICLE_SORT_VALUES)[number]

/** Query parameters accepted by GET /api/public/vehicles. */
export const PUBLIC_CATALOG_QUERY_PARAMS = [
  'page',
  'limit',
  'sort',
  'q',
  'keyword',
  'brand',
  'model',
  'modelFamily',
  'city',
  'agency',
  'dealership',
  'yearMin',
  'yearMax',
  'mileageMin',
  'mileageMax',
  'bodyType',
  'segment',
  'vehicleType',
  'fuel',
  'transmission',
  'condition',
  'inventoryStatus',
  'tags',
] as const
