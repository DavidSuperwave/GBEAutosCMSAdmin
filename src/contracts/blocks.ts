/**
 * Site section block contract (F038).
 *
 * The registered homepage/page builder block slugs. src/blocks/SiteSections.ts
 * defines the Payload block configs; a test asserts its slugs match this list
 * exactly so the registry cannot drift from the contract. The Storefront
 * renders all of these (and treats unknown slugs as ignorable). This list is
 * the seed for the F025 versioned block registry.
 */

export const SITE_SECTION_BLOCK_SLUGS = [
  'hero',
  'promoStrip',
  'featuredVehicles',
  'inventoryCollection',
  'inventorySearch',
  'cityInventory',
  'promoBanner',
  'trustSteps',
  'testimonials',
  'videoTips',
  'brands',
  'agencies',
  'mediaText',
  'cta',
] as const

export type SiteSectionBlockSlug = (typeof SITE_SECTION_BLOCK_SLUGS)[number]
