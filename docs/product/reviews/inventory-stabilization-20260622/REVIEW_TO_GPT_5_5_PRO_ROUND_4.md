# REVIEW TO GPT-5.5 PRO - Round 4 Landing Serializer Fixes

You are reviewing the latest implementation round for `GBEAutosCMSAdmin`, a Payload CMS inventory backend. `/admin/inventory` remains the primary operator UI and native `/admin/collections/vehicles` remains a hidden direct fallback.

## Prior context

The attached prior verdict `GPT_5_5_PRO_ROUND3_VERDICT.md` was **CONDITIONAL-GO**, not NO-SHIP. It said the two Round 2 blockers were materially closed:

1. Raw Payload inventory REST reads are now authenticated.
2. Core hero/gallery image approval is now a server invariant.

The one remaining launch blocker was:

- `toPublicVehicleDetail()` still returned raw `vehicle.landing`, which could leak raw Payload media objects from `imageText.image` or `gallery.images[].image` without checking `vehicle-media-assets` approval/rights.

## Current round to review

Please review the current tree and delta from base `e473521`, with emphasis on whether the Round 3 launch blocker is now closed and whether the project is now a clean launch candidate or still conditional.

Key changes in this round:

- Added `landingMediaIds()` to `src/services/vehicleMediaPolicy.ts`.
- `approvedVehicleMediaMap()` now includes landing block media IDs when requested.
- `Vehicles.beforeValidate` now includes landing media IDs in the approved/right-cleared asset lookup and blocks publishing when landing images are not backed by approved/right-cleared `vehicle-media-assets`.
- Replaced raw `vehicle.landing` passthrough in `src/services/publicVehicleCatalog.ts` with `serializePublicLandingBlocks()`.
- `serializePublicLandingBlocks()`:
  - serializes only known stable block types,
  - strips unapproved `imageText.image`,
  - omits gallery images without approved/right-cleared asset records,
  - omits empty gallery blocks,
  - returns only stable public image payloads, not raw Payload media docs.
- Public `specs` and `templateOverrides` are now whitelisted rather than raw object passthrough.
- Preview route `/api/public/vehicles/preview/[id]` is role-gated in production to `admin`, `inventory_manager`, or `content_editor`.
- `vehicle-media-assets.approvalStatus` and `rightsStatus` now have field access so only `admin` or `media_editor` can set/update them through normal collection access.
- `scripts/production-e2e-smoke.ts` now includes a pure regression check proving public landing serialization omits unapproved media.

## Verification already run

- `npm run lint`
  - Passed with only existing unused-arg warnings in `src/migrations/20260521_060610_site_builder_schema.ts`.
- `npm run check:admin-styles`
  - Passed.
- `npm run generate:types`
  - Passed.
- `npm run generate:importmap`
  - Passed.
- `npm run build`
  - Passed.
- `E2E_BASE_URL=http://localhost:3001 npm run test:e2e:production`
  - Passed: 35 passed, 5 warnings, 0 skipped, 0 failed.
- Manual local HTTP detail check:
  - `/api/public/vehicles/[slug]` does not include `sourceMeta`.
  - Sample public detail response has serialized landing output instead of raw Payload object passthrough.

## Questions for this review

1. Is the Round 3 launch blocker around raw landing blocks now closed?
2. Are there remaining public media paths that bypass `vehicle-media-assets` approval/rights checks?
3. Is the landing serializer stable enough for the public frontend contract?
4. Did the publish invariant become too strict in a way that blocks valid workflows?
5. Are the field-level approval controls on `vehicle-media-assets` sufficient for v1?
6. What remains before production cutover, grouped as:
   - launch blockers,
   - should-fix before production,
   - safe follow-up after v1.

Please be adversarial. If this is still not a clean launch candidate, say exactly why and list the minimum code changes needed.
