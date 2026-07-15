🧿 oracle 0.14.0 — Balanced mystique, measurable results.
Chain: root -> inventory-preview-route-round-five-2
Created: 2026-06-22T21:00:07.193Z
Status: completed
Execution: br/fg (attached)
Reattach: oracle session inventory-preview-route-round-five-2
Models:
- gpt-5.5-pro — completed tok=1.5k/436.06k
Browser evidence:
- model requested=Pro; resolved=(unavailable); status=already-selected; strategy=current; verified=no
Artifacts:
- Browser transcript — C:\Users\Kecin\.oracle\sessions\inventory-preview-route-round-five-2\artifacts\transcript.md (9.2 KB)
Prompt:

REVIEW TO GPT-5.5 PRO - Round 5 Preview Route Fix
You are reviewing the latest implementation round for GBEAutosCMSAdmin,
a Payload CMS inventory backend. /admin/inventory is the primary operator UI
and native /admin/collections/vehicles is a hidden direct fallback.

Prior context
The attached prior verdict GPT_5_5_PRO_ROUND4_VERDICT.md was still
CONDITIONAL-GO. It confirmed the Round 3 landing serializer blocker was closed
for /api/public/*, but found one remaining launch blocker:
- /vehicle-preview/[id] was a public frontend route that used Payload Local API
  directly, read raw vehicle.image, vehicle.gallery, and vehicle.landing,
  and rendered raw media without the public serializer or production role
  gating.

Current round to review
Please review the current tree and decide whether the Round 4 launch blocker is
now closed and whether the project can be considered a clean v1 launch
candidate, with only normal production cutover tasks remaining.
Key changes since Round 4:
- src/app/(frontend)/vehicle-preview/[id]/page.tsx now:
  - authenticates in production via payload.auth({ headers }),
  - allows only admin, inventory_manager, or content_editor,
  - returns notFound() for unauthorized production access,
  - fetches the raw vehicle only after auth,
  - converts it through toPublicVehicleDetail(payload, rawVehicle),
  - renders sanitized public hero/gallery/landing/features fields instead of raw
  Payload docs.
- publicTemplateOverrides() now includes mobileCta, matching the vehicle schema
  and frontend type.
Already implemented from previous rounds:
- Raw reads for vehicles, vehicle-media-assets, and vehicle-collections require
  auth.
- Public APIs use overrideAccess: true and explicit public serializers.
- Hero/gallery/landing media are backed by approved/right-cleared
  vehicle-media-assets.
- Publishing blocks unapproved hero/gallery/landing media.
- AI wizard no longer directly assigns generated images as approved.
- Remote image import rejects unsafe sources and defaults imported candidates
  to review-needed/unknown rights.

Verification already run
- npm run lint
  - Passed with only existing unused-arg warnings
  in src/migrations/20260521_060610_site_builder_schema.ts.
- npm run check:admin-styles
  - Passed.
- npm run generate:types
  - Passed earlier in this blocker pass.
- npm run generate:importmap
  - Passed earlier in this blocker pass.
- npm run build
  - Passed.
- E2E_BASE_URL=http://localhost:3001 npm run test:e2e:production
  - Passed: 35 passed, 5 warnings, 0 skipped, 0 failed.
- Manual local preview smoke:
  - /vehicle-preview/5223 returns 200 in local dev.
  - Response does not include sourceMeta.

Questions for this review
1. Is /vehicle-preview/[id] still a launch blocker, or is the side route now safe
  enough?
2. Are there any remaining public media paths that bypass approved/right-cleared
  vehicle-media-assets for vehicle-specific images?
3. Is the project now a clean v1 launch candidate?
4. What remains before production cutover, grouped as:
  - launch blockers,
  - should-fix before production,
  - safe follow-up after v1.
Please be adversarial. If this is still not a clean launch candidate, name
the minimum code changes needed.

---
Answer:
## Verdict: **GO — clean v1 launch candidate**

The Round 4 blocker is **closed**. I would no longer treat `/vehicle-preview/[id]` as a launch blocker.

The prior verdict blocked launch because `/vehicle-preview/[id]` was a public frontend route that fetched raw Payload vehicle docs and rendered raw `vehicle.image`, `vehicle.gallery`, and `vehicle.landing` without auth or the public serializer.  In the Round 5 tree, that route now:

* Authenticates in production before fetching the vehicle: `src/app/(frontend)/vehicle-preview/[id]/page.tsx:129-134`
* Allows only `admin`, `inventory_manager`, or `content_editor`: `page.tsx:131`
* Fetches the raw vehicle only after the production auth check: `page.tsx:136-138`
* Converts the raw vehicle through `toPublicVehicleDetail(payload, rawVehicle)`: `page.tsx:142`
* Renders public-shaped `image`, `gallery`, `landing`, and `features`: `page.tsx:144-207`

So the side route is no longer the raw public bypass found in Round 4.

## Direct answers

### 1. Is `/vehicle-preview/[id]` still a launch blocker?

**No.** It is safe enough for v1 production.

The only nuance is that it still uses `overrideAccess: true` on the raw vehicle fetch, but that is acceptable here because the route-level production auth/role gate now happens first. The raw result is also immediately passed through `toPublicVehicleDetail()`, so the render path no longer consumes raw Payload media docs.

I would still add an explicit production regression test, because the current smoke evidence does not prove this route’s unauthenticated production behavior. Local dev returning `200` is expected because the gate only runs when `NODE_ENV === 'production'`.

### 2. Are there remaining public media paths bypassing approved/right-cleared `vehicle-media-assets` for vehicle-specific images?

For **vehicle-specific public render paths**, I did not find a remaining bypass.

Confirmed safe paths:

* Public vehicle detail uses `toPublicVehicleDetail()`: `src/app/(payload)/api/public/vehicles/[slug]/route.ts:34`
* Public vehicle preview API uses `toPublicVehicleDetail()`: `src/app/(payload)/api/public/vehicles/preview/[id]/route.ts:43`
* Frontend side preview route now uses `toPublicVehicleDetail()`: `src/app/(frontend)/vehicle-preview/[id]/page.tsx:142`
* Hero image only serializes when `imageStatus === 'approved'` and the media ID is in the approved map: `src/services/publicVehicleCatalog.ts:290-318`
* Gallery images are filtered by approved media ID: `publicVehicleCatalog.ts:330-343`
* Landing `imageText` and landing gallery images are filtered through `approvedPublicImage()`: `publicVehicleCatalog.ts:362-450`
* `approvedVehicleMediaMap()` only accepts assets with `approvalStatus = approved` and `rightsStatus in owned|licensed`: `src/services/vehicleMediaPolicy.ts:70-82`
* Publishing blocks unapproved hero/gallery/landing media: `src/collections/Vehicles.ts:369-394`

Remaining **non-blocking media policy caveats**:

* `Media` remains public: `src/collections/Media.ts:7-8`. Prior review already treated that as acceptable for hosted file rendering, but it means uploaded media is not private once stored.
* `/api/public/collections*` still exposes collection/SEO images through `toPublicImage()` without `vehicle-media-assets`: `src/services/publicVehicleCatalog.ts:659-672`. I do **not** count this as a vehicle-specific image bypass; it is editorial collection/SEO media. Document that policy or add a generic approval model later.

### 3. Is this now a clean v1 launch candidate?

**Yes, assuming the accepted v1 policy is: vehicle-specific public inventory imagery must be approved/right-cleared, while generic Media files and editorial collection/SEO images are public assets.**

No remaining code launch blocker found in the Round 4/5 preview-route area.

## What remains before production cutover

### Launch blockers

**None found** in this Round 5 tree.

The one condition that would change this verdict: if the true product requirement is “no uploaded image bytes or media metadata should be public until approved,” then the public `media` collection/file model is not sufficient and must be redesigned before launch. Under the current reviewed policy, that is not a blocker.

### Should-fix before production

1. **Add a real production regression test for `/vehicle-preview/[id]`.**
   Test unauthenticated production access returns `404`, authenticated allowed-role access returns `200`, and the HTML does not include `sourceMeta` or raw Payload media fields.

2. **Commit the reviewed working tree and produce a real diff artifact.**
   The bundled `diffstat.txt`, `full.diff`, and `commit_log.txt` are empty, and `REVIEW_META.md` says there are 43 uncommitted changes. This is a release-process risk, not an app blocker.

3. **Document the media policy.**
   Make it explicit that `vehicle-media-assets` controls vehicle hero/gallery/landing publication, but generic `media`, collection images, SEO images, homepage media, and editorial assets are public once uploaded.

4. **Run one production data cleanup query before cutover.**
   Check for published vehicles whose hero/gallery/landing media do not have approved/right-cleared `vehicle-media-assets`. Even though new publishes are blocked, legacy rows can still surprise operators during edits.

5. **Keep the non-approver image UX fix on the pre-launch list.**
   The system is safer now, but inventory operators may still hit confusing failures if they try to assign assets that are not actually approved.

### Safe follow-up after v1

* Usage-specific approvals for `vehicle_hero`, `vehicle_gallery`, and `landing_page`.
* Generic approval model for non-vehicle public media.
* Stronger remote import/SSRF hardening.
* Transactional media assignment instead of best-effort rollback.
* Multi-tenant role isolation when this becomes a multi-client platform.
* Cleaner preview tests for both `/api/public/vehicles/preview/[id]` and `/vehicle-preview/[id]`.

Final ship call: **GO for v1 launch candidate.**


4m15s · gpt-5.5-pro[browser] · ↑434.56k ↓1.5k ↻0 Δ436.06k
files=2

4m15s · gpt-5.5-pro[browser] · ↑434.56k ↓1.5k ↻0 Δ436.06k | files=2 | slug=inventory-preview-route-round-five-2
