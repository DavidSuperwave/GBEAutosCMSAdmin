# REVIEW TO GPT-5.5 PRO - Round 5 Preview Route Fix

You are reviewing the latest implementation round for `GBEAutosCMSAdmin`, a Payload CMS inventory backend. `/admin/inventory` is the primary operator UI and native `/admin/collections/vehicles` is a hidden direct fallback.

## Prior context

The attached prior verdict `GPT_5_5_PRO_ROUND4_VERDICT.md` was still **CONDITIONAL-GO**. It confirmed the Round 3 landing serializer blocker was closed for `/api/public/*`, but found one remaining launch blocker:

- `/vehicle-preview/[id]` was a public frontend route that used Payload Local API directly, read raw `vehicle.image`, `vehicle.gallery`, and `vehicle.landing`, and rendered raw media without the public serializer or production role gating.

## Current round to review

Please review the current tree and decide whether the Round 4 launch blocker is now closed and whether the project can be considered a clean v1 launch candidate, with only normal production cutover tasks remaining.

Key changes since Round 4:

- `src/app/(frontend)/vehicle-preview/[id]/page.tsx` now:
  - authenticates in production via `payload.auth({ headers })`,
  - allows only `admin`, `inventory_manager`, or `content_editor`,
  - returns `notFound()` for unauthorized production access,
  - fetches the raw vehicle only after auth,
  - converts it through `toPublicVehicleDetail(payload, rawVehicle)`,
  - renders sanitized public hero/gallery/landing/features fields instead of raw Payload docs.
- `publicTemplateOverrides()` now includes `mobileCta`, matching the vehicle schema and frontend type.

Already implemented from previous rounds:

- Raw reads for `vehicles`, `vehicle-media-assets`, and `vehicle-collections` require auth.
- Public APIs use `overrideAccess: true` and explicit public serializers.
- Hero/gallery/landing media are backed by approved/right-cleared `vehicle-media-assets`.
- Publishing blocks unapproved hero/gallery/landing media.
- AI wizard no longer directly assigns generated images as approved.
- Remote image import rejects unsafe sources and defaults imported candidates to review-needed/unknown rights.

## Verification already run

- `npm run lint`
  - Passed with only existing unused-arg warnings in `src/migrations/20260521_060610_site_builder_schema.ts`.
- `npm run check:admin-styles`
  - Passed.
- `npm run generate:types`
  - Passed earlier in this blocker pass.
- `npm run generate:importmap`
  - Passed earlier in this blocker pass.
- `npm run build`
  - Passed.
- `E2E_BASE_URL=http://localhost:3001 npm run test:e2e:production`
  - Passed: 35 passed, 5 warnings, 0 skipped, 0 failed.
- Manual local preview smoke:
  - `/vehicle-preview/5223` returns 200 in local dev.
  - Response does not include `sourceMeta`.

## Questions for this review

1. Is `/vehicle-preview/[id]` still a launch blocker, or is the side route now safe enough?
2. Are there any remaining public media paths that bypass approved/right-cleared `vehicle-media-assets` for vehicle-specific images?
3. Is the project now a clean v1 launch candidate?
4. What remains before production cutover, grouped as:
   - launch blockers,
   - should-fix before production,
   - safe follow-up after v1.

Please be adversarial. If this is still not a clean launch candidate, name the minimum code changes needed.
