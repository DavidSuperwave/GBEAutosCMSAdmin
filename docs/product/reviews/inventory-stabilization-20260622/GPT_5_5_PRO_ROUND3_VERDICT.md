🧿 oracle 0.14.0 — Pride Month: more color on the streets, less red in CI.
Chain: root -> inventory-blocker-fixes-round-three-2
Created: 2026-06-22T20:12:46.239Z
Status: completed
Execution: br/fg (attached)
Reattach: oracle session inventory-blocker-fixes-round-three-2
Models:
- gpt-5.5-pro — completed tok=2.54k/427.37k
Browser evidence:
- model requested=Pro; resolved=(unavailable); status=already-selected; strategy=current; verified=no
Artifacts:
- Browser transcript — C:\Users\Kecin\.oracle\sessions\inventory-blocker-fixes-round-three-2\artifacts\transcript.md (14.3 KB)
Prompt:

REVIEW TO GPT-5.5 PRO - Round 3 Inventory Blocker Fixes
You are reviewing the latest implementation round for GBEAutosCMSAdmin,
a Payload CMS inventory backend where /admin/inventory is the primary operator
UI and /admin/collections/vehicles is a hidden direct fallback.

Prior context
The attached prior verdict GPT_5_5_PRO_ROUND2_VERDICT.md returned NO-SHIP. It
found two production blockers:
1. Raw Payload REST exposed inventory-related data publicly (vehicles,
  vehicle-media-assets, vehicle-collections).
2. Public hero/gallery image approval was not a server invariant; direct
  REST/native edits and some UI paths could bypass approved/right-cleared
  vehicle-media-assets.
It also flagged hardening work for AI image wizard and remote image import.

Current round to review
Please review the current repo tree and diff from base e473521. Focus on whether
the implementation now closes the prior NO-SHIP blockers and what is still left
to do to reach a production launch candidate.
Key changes implemented after the prior verdict:
- Raw reads for vehicles, vehicle-media-assets, and vehicle-collections are now
  authenticated. media remains public for file rendering.
- /api/public/vehicles, /api/public/vehicles/[slug], preview, and public
  collection helpers use overrideAccess: true and serialize a public-safe
  contract.
- Public vehicle detail no longer returns sourceMeta.
- Added src/services/vehicleMediaPolicy.ts to resolve approved/right-cleared
  media from vehicle-media-assets.
- Vehicles.beforeValidate now:
  - detects hero image changes by media ID,
  - downgrades non-backed approved hero status,
  - blocks publishing if hero or gallery images are not backed by
  approved/right-cleared vehicle media assets.
- /api/cms/vehicle-media-assets/assign now binds the asset to the vehicle/usage
  before updating the vehicle, and attempts rollback if vehicle update fails.
- AI wizard no longer directly PATCHes generated outputs into hero/gallery as
  approved; generated outputs are recorded as review-needed assets.
- /api/cms/vehicle-photos now validates final redirect URLs, rejects
  private/localhost targets, rejects SVG, streams with a hard size cap, requires
  vehicle context, and ignores caller-supplied approved/owned status for generic
  remote imports.
- scripts/production-e2e-smoke.ts now asserts unauthenticated raw REST rejection
  and public detail metadata safety when E2E_BASE_URL is set.

Verification already run
- npm run lint
  - Passed with only existing unused-arg warnings
  in src/migrations/20260521_060610_site_builder_schema.ts.
- npm run check:admin-styles
  - Passed.
- npm run generate:types
  - Passed.
- npm run generate:importmap
  - Passed.
- npm run build
  - Passed.
- E2E_BASE_URL=http://localhost:3001 npm run test:e2e:production
  - Passed: 34 passed, 5 warnings, 0 skipped, 0 failed.
- Manual HTTP checks on local server:
  - /api/vehicles?limit=1 -> 403 unauthenticated.
  - /api/vehicle-media-assets?limit=1 -> 403 unauthenticated.
  - /api/vehicle-collections?limit=1 -> 403 unauthenticated.
  - /api/public/vehicles?limit=1 -> 200.
  - /api/public/vehicles/[slug] no longer includes sourceMeta.
  - /admin/inventory, /admin/inventory/new, and /admin/collections/vehicles
  return 200.

Questions for this review
1. Do the current changes close the two prior production blockers?
2. Are there remaining bypass paths where unapproved or rights-unknown media can
  reach the public website?
3. Is the current raw Payload access policy correct for a Payload CMS + public
  frontend setup?
4. Is the public serializer now safe enough, or does it still leak internal
  fields through landing/spec/template data?
5. Is the Vehicles.beforeValidate approval check robust across create, update,
  native Payload edit, direct REST PATCH, Inventario bulk publish, and assign
  endpoint updates?
6. Is the remote image import hardening sufficient for v1, or are
  redirects/DNS/body streaming still risky?
7. Please map what remains to do from here, grouped as:
  - launch blockers,
  - should-fix before production cutover,
  - safe follow-up after v1.
Please be adversarial. If this is still NO-SHIP, say exactly why and list
the minimum code changes needed. If it is close enough for a launch candidate,
say what residual risks remain.

---
Answer:
# Verdict: **CONDITIONAL-GO / close to launch candidate, but not clean GO yet**

The two **Round 2 production blockers are materially closed** for the core vehicle hero/gallery flow. The prior NO-SHIP required locking down raw Payload reads and enforcing approved/right-cleared media as a server invariant before public use. 

I would not call this **NO-SHIP** anymore for the specific prior blockers. I would call it **CONDITIONAL-GO** because there is one remaining public serializer gap: **raw `landing` blocks are still returned directly and can contain public image/gallery blocks that bypass `vehicle-media-assets` approval.**

Scope note: the zip’s diff artifacts are empty and the repo has no `.git`, so I reviewed the bundled current tree, not a real `e473521...HEAD` diff.

---

## 1. Are the two prior blockers closed?

### Blocker 1 — Raw Payload REST exposed inventory data publicly: **Closed**

Confirmed current access:

* `vehicles`: `read: isAuthenticated` in `src/collections/Vehicles.ts:244-248`
* `vehicle-media-assets`: `read: isAuthenticated` in `src/collections/VehicleMediaAssets.ts:12-16`
* `vehicle-collections`: `read: isAuthenticated` in `src/collections/VehicleCollections.ts:54-58`
* `media`: still public read in `src/collections/Media.ts:7-11`, which is correct for rendering hosted files

The generated Payload REST route still exposes `GET = REST_GET(config)` at `src/app/(payload)/api/[...slug]/route.ts:14`, but collection access now blocks unauthenticated raw reads. This is the right architecture: raw Payload APIs for authenticated CMS operators; `/api/public/*` for the public frontend.

### Blocker 2 — Hero/gallery approval not server invariant: **Mostly closed for main hero/gallery**

The new invariant is real:

* `approvedVehicleMediaMap()` only accepts `approvalStatus: approved` and `rightsStatus: owned|licensed` in `src/services/vehicleMediaPolicy.ts:34-58`.
* `Vehicles.beforeValidate` checks the assembled vehicle state, detects hero changes by media ID, downgrades fake `approved` hero status, and blocks published vehicles with unapproved hero/gallery media in `src/collections/Vehicles.ts:326-379`.
* Public card/detail serialization only exposes hero when both `imageStatus === approved` and the exact media ID is in the approved map in `src/services/publicVehicleCatalog.ts:257-285`.
* Public gallery serialization now filters each gallery media ID against the approved map in `src/services/publicVehicleCatalog.ts:297-310`.

This closes the direct REST/native edit bypasses called out in Round 2 for `image`, `imageStatus`, and the main `gallery` field.

---

## 2. Remaining bypass paths for unapproved/right-unknown media

### Launch blocker: raw `landing` blocks still bypass media approval

`toPublicVehicleDetail()` returns:

```ts
landing: Array.isArray(vehicle.landing) ? vehicle.landing : [],
```

at `src/services/publicVehicleCatalog.ts:327`.

That means vehicle detail can still expose raw landing block content, including:

* `VehicleImageTextBlock.image`
* `VehicleGalleryBlock.images[].image`

Those images are Payload `media` uploads, not checked against `vehicle-media-assets`. So an operator can place an unapproved or rights-unknown media file into a vehicle landing block and it will be returned by `/api/public/vehicles/[slug]`.

Minimum fix:

* Replace raw `landing` passthrough with a `serializePublicLandingBlocks(vehicle, approvedMediaIds)` function.
* Either:

  * remove image-bearing landing blocks from public output unless their media IDs are approved/right-cleared for that vehicle, or
  * intentionally classify landing images as editorial CMS media and add a separate approval model for those fields.
* Do not return raw Payload media docs inside landing blocks. Return only `{ url, alt }`.

This is the only issue I would treat as a remaining **launch blocker**, because it is a public image path outside the new invariant.

---

## 3. Raw Payload access policy

The current policy is correct for a Payload CMS + public frontend setup.

Public traffic should use:

* `/api/public/vehicles`
* `/api/public/vehicles/[slug]`
* `/api/public/collections`
* `/api/public/collections/[slug]`

Raw Payload endpoints should require CMS auth. That is now true for the three inventory collections.

One hardening note: `isAuthenticated` allows any logged-in CMS user, including viewer-style users, to read all internal inventory/media asset metadata. That is acceptable for a small trusted operator team, but before broader client/multi-tenant rollout I would split read roles more tightly.

---

## 4. Public serializer safety

### Safe enough now

The main card/detail serializer no longer leaks the obvious internal inventory fields:

* no `sourceMeta`
* no `sourceId`
* no `sourceImportId`
* no `sourceDealerName`
* no `reviewNotes`
* no raw `vehicle-media-assets`

The public vehicle list uses `overrideAccess: true` but serializes through `toPublicVehicleCard()` in `src/services/publicVehicleCatalog.ts:341-363`, which is the right pattern.

### Still not safe enough

The raw `landing` passthrough is the remaining serializer leak. Even if it does not leak `sourceMeta`, it can leak unstable Payload block shape and raw media objects. `specs` and `templateOverrides` are less concerning because they are bounded groups of public-ish technical data and visibility flags, but I would still serialize them explicitly for contract stability.

---

## 5. `Vehicles.beforeValidate` robustness

For the core fields, it is robust enough across:

* create as draft
* update
* native Payload edit
* direct REST PATCH
* Inventario bulk publish
* assign endpoint updates

Why: it merges `originalDoc + data`, recomputes `imageStatus`, checks exact hero/gallery media IDs against approved/right-cleared asset rows, and blocks whenever the assembled vehicle is `published`.

One caveat: create-and-publish with an already-approved asset cannot pass because the vehicle ID does not exist yet, so `approvedVehicleMediaMap()` cannot bind the asset to the new vehicle. That is operationally fine: create draft → assign approved media → publish.

---

## 6. Remote image import hardening

Sufficient for controlled v1, not perfect SSRF hardening.

Good changes:

* requires auth and media-capable roles: `src/app/(payload)/api/cms/vehicle-photos/route.ts:753-760`
* requires `vehicleId`: `src/app/(payload)/api/cms/vehicle-photos/route.ts:749-751`
* validates URL scheme and blocks localhost/private IPs: `src/app/(payload)/api/cms/vehicle-photos/route.ts:202-224`
* uses manual redirect handling and revalidates each redirect: `src/app/(payload)/api/cms/vehicle-photos/route.ts:265-287`
* rejects SVG: `src/app/(payload)/api/cms/vehicle-photos/route.ts:197-200`
* streams with size cap: `src/app/(payload)/api/cms/vehicle-photos/route.ts:226-263`
* ignores client-supplied approval/rights status and stores `needs_review` / `unknown`: `src/app/(payload)/api/cms/vehicle-photos/route.ts:781-783`

Residual risk: DNS is still checked before `fetch`, and `fetch` performs its own connection resolution. True DNS rebinding protection requires egress controls, an allowlist/proxy, or a lower-level HTTP client with custom DNS/connect validation. For an authenticated internal media tool, this is acceptable for v1.

---

## What remains

### Launch blockers

1. **Sanitize and approval-gate `landing` blocks in public vehicle detail.**
   Do not return raw `vehicle.landing`. Filter or strip image-bearing landing block media unless approved/right-cleared, and serialize only stable public fields.

2. **Add regression tests for landing block leakage.**
   Add a test where a published vehicle has an unapproved media image inside `landing.gallery` or `landing.imageText`; `/api/public/vehicles/[slug]` should not expose that image.

### Should-fix before production cutover

1. Add e2e/API tests for the direct bypasses, not only smoke checks:

   * direct PATCH published vehicle with unapproved `image + imageStatus: approved` should fail
   * direct PATCH published vehicle gallery with unapproved media should fail
   * public detail should omit unapproved hero/gallery/landing media
   * raw REST should reject unauthenticated reads

2. Serialize `specs` and `templateOverrides` explicitly instead of returning raw group objects.

3. Add field-level approval controls on `vehicle-media-assets.approvalStatus` and `rightsStatus`, so not every media-capable role can self-mark assets as `approved/owned`.

4. Role-gate preview route more tightly. `/api/public/vehicles/preview/[id]` currently allows any authenticated CMS user in production. Better to require `admin`, `inventory_manager`, or `content_editor`.

5. Add rate limits/quotas to paid provider endpoints: specs lookup, photo search/import, AI workshop.

### Safe follow-up after v1

1. Transactional assignment/import flows. The assign endpoint has rollback, but not a real transaction.

2. Stronger SSRF protection via network egress allowlist/proxy.

3. Daily ingestion-grade import pipeline: duplicate resolution, row caps, rollback/retry, job state semantics.

4. Multi-tenant/client scoping once this expands beyond one trusted operator environment.

5. AI wizard polish. The current Round 3 change is good: generated outputs are recorded as review-needed assets instead of directly patched into public hero/gallery.

---

## Direct answers

1. **Do current changes close the two prior blockers?**
   Yes for raw REST and core hero/gallery media. Conditional due to landing block images.

2. **Remaining bypass paths?**
   Yes: public `landing` image/gallery blocks.

3. **Raw Payload access correct?**
   Yes. Authenticated raw CMS, curated public API.

4. **Public serializer safe enough?**
   Not fully. Main vehicle fields are safe; raw `landing` is not.

5. **`beforeValidate` robust?**
   Yes for main hero/gallery and publish/update paths.

6. **Remote import sufficient?**
   Sufficient for controlled v1; residual DNS/connect risk remains.

7. **Final ship call?**
   **CONDITIONAL-GO after fixing public landing serialization.** Without that fix, I would not call it a clean production launch candidate.


3m03s · gpt-5.5-pro[browser] · ↑424.83k ↓2.54k ↻0 Δ427.37k
files=2

3m03s · gpt-5.5-pro[browser] · ↑424.83k ↓2.54k ↻0 Δ427.37k | files=2 | slug=inventory-blocker-fixes-round-three-2
