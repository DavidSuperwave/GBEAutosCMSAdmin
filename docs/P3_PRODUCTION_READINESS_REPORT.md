# P3 Production Readiness Report

Date: 2026-06-10

## Scope

Completed the remaining P3 validation pass across:

- Admin/CMS/API: `C:\Users\Kecin\Desktop\GBEAutosCMSAdmin`
- Public frontend: `C:\Users\Kecin\Desktop\GBE Autos`

The pass used local QA fixtures with `QA_P3` markers and safe API checks for WhatsApp/AI behavior. No real WhatsApp conversation or AI image generation was opened.

## Data Seeded

- 10 edge-case vehicles:
  - full data with gallery/custom landing blocks
  - no price
  - one image/no gallery
  - partial specs
  - reserved
  - sold
  - unpublished draft
  - new vehicle
  - city/brand routing
  - fallback routing
- 1,050 high-volume catalog vehicles for pagination/performance checks.
- 2 public collections:
  - `qa-p3-manual`
  - `qa-p3-mazda-culiacan`
- 1 published, nav-linked public page:
  - `qa-p3-public-page`
- QA leads and analytics events from safe WhatsApp routing tests.

## Fixes Applied

- Added migration `20260610_140000_p3_site_config_nav_link_id_sync`.
- Corrected fresh-install schema in `20260610_120000_p2_pages_nav_and_analytics` so SiteConfig footer/legal link array row IDs use `varchar`, matching Payload's generated schema.
- Applied the live DB schema sync and recorded the migration in `payload_migrations`.
- Hardened public lead routing city normalization so `Culiacán`, `Culiacan`, mojibake forms, and lossy request encodings resolve to the same city for brand/city WhatsApp routing.

## Verified

- Supabase/Postgres:
  - `20260610_130000_p3_page_home_block_schema_sync` recorded.
  - `20260610_140000_p3_site_config_nav_link_id_sync` recorded.
  - Page/home builder block tables exist.
  - SiteConfig footer/legal link IDs are `character varying`.
  - QA vehicle/page/collection/lead/analytics rows exist.
- Public API:
  - `/api/public/vehicles?keyword=QA` returns 1,000+ paginated results.
  - `/api/public/collections/qa-p3-manual` returns the manual QA vehicles.
  - `/api/pages` returns the published QA page with sections.
- Browser desktop:
  - homepage reflects CMS sections after cache refresh.
  - inventory pagination/filtering works with 1,000+ QA vehicles.
  - seminuevos brand/city filters work.
  - manual and smart collection routes render.
  - Mazda brand page reflects QA inventory counts.
  - dynamic CMS page renders hero, collection, and CTA blocks.
  - vehicle detail renders full-data and no-price cases.
  - sold and draft vehicles are hidden from public detail routes.
- Browser mobile:
  - homepage, inventory, seminuevos, dynamic page, and no-price vehicle detail render without runtime errors or detected horizontal overflow at 390x844.
- WhatsApp/lead path:
  - direct dealership routing returns Mazda Culiacán.
  - city+brand routing now returns Mazda Culiacán.
  - unmatched city/brand falls back to the global WhatsApp.
  - each safe lead submit created a lead and analytics event.
- AI image workflow:
  - not-configured branch exists and returns a friendly `configured: false` response without provider calls when keys are absent.
  - real generation was intentionally not invoked because keys are configured.
- Technical checks:
  - admin `npm run generate:types`
  - admin `npm run generate:importmap`
  - admin `npm run lint`
  - admin `npm run build`
  - public `npm run lint`
  - public `npm run build`

## Known Notes

- Admin lint reports four warnings in the older generated migration `20260521_060610_site_builder_schema.ts`; no new lint errors were introduced.
- QA fixtures are intentionally retained for further manual walkthroughs. They are labeled with `QA_P3` in `sourceId`, `stockId`, page/collection slugs, lead names, and analytics source sections.
- One pre-fix lead (`QA P3 CityBrand`) documents the routing bug before the fix; the later `QA P3 CityBrand Fixed` lead verifies the corrected behavior.

## Cleanup Guide

When QA data should be removed, delete records matching these markers:

- vehicles where `source_id like 'QA_P3_%'`
- pages where `slug = 'qa-p3-public-page'`
- vehicle collections where `slug in ('qa-p3-manual', 'qa-p3-mazda-culiacan')`
- leads where `first_name like 'QA P3%'`
- analytics events where `source_section like 'p3_%'`

Run cleanup only after confirming no further browser QA depends on the seeded dataset.

## Production Deploy Smoke

Before production cutover:

1. Apply all Payload migrations to the intended production database.
2. Confirm `payload_migrations` includes both P3 migrations listed above.
3. Confirm SiteConfig footer/legal link ID columns are `character varying`.
4. Build both Vercel projects with production env vars.
5. Smoke public routes: `/`, `/inventario`, `/seminuevos`, `/marcas`, `/colecciones`, one vehicle detail, and one dynamic CMS page.
6. Submit one safe internal test lead and confirm the lead plus analytics event in the production database.
7. Remove the production test lead/event after verification.
