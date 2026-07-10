# REVIEW TO GPT-5.5 PRO - Round 3 Inventory Blocker Fixes

You are reviewing the latest implementation round for `GBEAutosCMSAdmin`, a Payload CMS inventory backend where `/admin/inventory` is the primary operator UI and `/admin/collections/vehicles` is a hidden direct fallback.

## Prior context

The attached prior verdict `GPT_5_5_PRO_ROUND2_VERDICT.md` returned **NO-SHIP**. It found two production blockers:

1. Raw Payload REST exposed inventory-related data publicly (`vehicles`, `vehicle-media-assets`, `vehicle-collections`).
2. Public hero/gallery image approval was not a server invariant; direct REST/native edits and some UI paths could bypass approved/right-cleared `vehicle-media-assets`.

It also flagged hardening work for AI image wizard and remote image import.

## Current round to review

Please review the current repo tree and diff from base `e473521`. Focus on whether the implementation now closes the prior NO-SHIP blockers and what is still left to do to reach a production launch candidate.

Key changes implemented after the prior verdict:

- Raw reads for `vehicles`, `vehicle-media-assets`, and `vehicle-collections` are now authenticated. `media` remains public for file rendering.
- `/api/public/vehicles`, `/api/public/vehicles/[slug]`, preview, and public collection helpers use `overrideAccess: true` and serialize a public-safe contract.
- Public vehicle detail no longer returns `sourceMeta`.
- Added `src/services/vehicleMediaPolicy.ts` to resolve approved/right-cleared media from `vehicle-media-assets`.
- `Vehicles.beforeValidate` now:
  - detects hero image changes by media ID,
  - downgrades non-backed approved hero status,
  - blocks publishing if hero or gallery images are not backed by approved/right-cleared vehicle media assets.
- `/api/cms/vehicle-media-assets/assign` now binds the asset to the vehicle/usage before updating the vehicle, and attempts rollback if vehicle update fails.
- AI wizard no longer directly PATCHes generated outputs into hero/gallery as approved; generated outputs are recorded as review-needed assets.
- `/api/cms/vehicle-photos` now validates final redirect URLs, rejects private/localhost targets, rejects SVG, streams with a hard size cap, requires vehicle context, and ignores caller-supplied approved/owned status for generic remote imports.
- `scripts/production-e2e-smoke.ts` now asserts unauthenticated raw REST rejection and public detail metadata safety when `E2E_BASE_URL` is set.

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
  - Passed: 34 passed, 5 warnings, 0 skipped, 0 failed.
- Manual HTTP checks on local server:
  - `/api/vehicles?limit=1` -> 403 unauthenticated.
  - `/api/vehicle-media-assets?limit=1` -> 403 unauthenticated.
  - `/api/vehicle-collections?limit=1` -> 403 unauthenticated.
  - `/api/public/vehicles?limit=1` -> 200.
  - `/api/public/vehicles/[slug]` no longer includes `sourceMeta`.
  - `/admin/inventory`, `/admin/inventory/new`, and `/admin/collections/vehicles` return 200.

## Questions for this review

1. Do the current changes close the two prior production blockers?
2. Are there remaining bypass paths where unapproved or rights-unknown media can reach the public website?
3. Is the current raw Payload access policy correct for a Payload CMS + public frontend setup?
4. Is the public serializer now safe enough, or does it still leak internal fields through landing/spec/template data?
5. Is the `Vehicles.beforeValidate` approval check robust across create, update, native Payload edit, direct REST PATCH, Inventario bulk publish, and assign endpoint updates?
6. Is the remote image import hardening sufficient for v1, or are redirects/DNS/body streaming still risky?
7. Please map what remains to do from here, grouped as:
   - launch blockers,
   - should-fix before production cutover,
   - safe follow-up after v1.

Please be adversarial. If this is still NO-SHIP, say exactly why and list the minimum code changes needed. If it is close enough for a launch candidate, say what residual risks remain.
