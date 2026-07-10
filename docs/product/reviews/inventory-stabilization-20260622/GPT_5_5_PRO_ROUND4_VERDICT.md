🧿 oracle 0.14.0 — Your AI coworker's quality control.
Chain: root -> inventory-landing-round-four-2
Created: undefined
Status: completed
Models:
- gpt-5.5-pro — completed tok=2.13k/433.84k
Browser evidence:
- model requested=Pro; resolved=(unavailable); status=already-selected; strategy=current; verified=no
Artifacts:
- Browser transcript — C:\Users\Kecin\.oracle\sessions\inventory-landing-round-four-2\artifacts\transcript.md (12.2 KB)
Answer:
# Verdict: **CONDITIONAL-GO, not clean GO yet**

The **Round 3 blocker is closed for the intended public vehicle API**. `toPublicVehicleDetail()` no longer returns raw `vehicle.landing`; it now calls `serializePublicLandingBlocks()`, includes landing media in `approvedVehicleMediaMap()`, and `Vehicles.beforeValidate` blocks published vehicles with unapproved landing media. That directly addresses the prior launch blocker, which was raw landing blocks leaking `imageText.image` / `gallery.images[].image` without `vehicle-media-assets` approval checks. 

But I would **not** call the whole project a clean launch candidate yet because I found one serious side route:

## Launch blocker found: `/vehicle-preview/[id]` still renders raw vehicle media

`src/app/(frontend)/vehicle-preview/[id]/page.tsx` is a public frontend route, not the role-gated API preview route.

It does this:

* Fetches a vehicle server-side with `payload.findByID({ collection: 'vehicles', id, depth: 2 })` at `page.tsx:122-127`.
* Reads raw `vehicle.image`, `vehicle.gallery`, and `vehicle.landing` at `page.tsx:131-135`.
* Renders raw landing `imageText` and `gallery` media at `page.tsx:36-67` and `page.tsx:197`.

That matters because Payload’s Local API skips access control by default unless `overrideAccess: false` is explicitly set. Payload’s own docs state that Local API operations set `overrideAccess` to true by default / skip access control by default. ([Payload][1])

So even though `/api/public/vehicles/preview/[id]` is now role-gated, `/vehicle-preview/[id]` appears to remain a public raw preview bypass unless something outside this bundle blocks it. I found no middleware in the bundle.

**Minimum fix:** delete this route, move it under authenticated admin-only UI, or make it use the same `toPublicVehicleDetail()` serializer plus production auth/role gating. At minimum, set `overrideAccess: false` with an authenticated user context; better is to reuse the already-gated preview API contract.

# Direct answers

## 1. Is the Round 3 raw landing blocker closed?

**Yes for `/api/public/vehicles/[slug]` and `/api/public/vehicles/preview/[id]`.**

The public serializer path is now materially correct:

* `landingMediaIds()` extracts media from `imageText.image` and `gallery.images[].image`.
* `approvedVehicleMediaMap()` includes landing media IDs.
* `Vehicles.beforeValidate` blocks publishing if landing media is not approved/right-cleared.
* `serializePublicLandingBlocks()` strips unapproved imageText media, omits unapproved gallery images, omits empty galleries, and returns only stable `{ url, alt }` image payloads.

But **not closed globally** because `/vehicle-preview/[id]` still raw-renders landing and gallery media.

## 2. Are there remaining public media paths bypassing approval/rights checks?

**Yes.**

Blocking:

* `/vehicle-preview/[id]` raw-renders vehicle hero/gallery/landing media and likely bypasses collection access through Local API default behavior.

Non-blocking but should be clarified:

* `/api/public/collections*` exposes `vehicle-collections.image` and `seo.image` via `toPublicImage()` at `src/services/publicVehicleCatalog.ts:651-664` without `vehicle-media-assets` checks. If these are editorial collection/SEO images, that can be acceptable. If the policy is “every public image must be approved/right-cleared,” this needs a separate media approval model because `vehicle-media-assets` is vehicle-scoped.

Also, `media` files remain public by URL. That is fine for rendering, but the system should assume uploaded media is not private once stored.

## 3. Is the landing serializer stable enough for the public frontend contract?

**Yes, for the API contract.**

`serializePublicLandingBlocks()` is stable enough for v1 because it:

* Allows only known block types.
* Drops unknown block types.
* Does not return Payload IDs, raw media docs, `createdAt`, `updatedAt`, filenames, or source metadata.
* Returns predictable public block shapes.

One small contract issue: `templateOverrides.mobileCta` exists in the vehicle schema at `Vehicles.ts:916`, but `publicTemplateOverrides()` only whitelists `gallery`, `purchaseCard`, `quickSpecs`, `description`, `features`, and `similarVehicles` at `publicVehicleCatalog.ts:462`. Decide whether `mobileCta` should be public; right now it is silently dropped.

## 4. Did the publish invariant become too strict?

**Strict, but mostly correct.**

It will block these workflows:

* Create-and-publish in one request with new media, because the vehicle-scoped approved asset cannot exist before the vehicle exists.
* Publishing a vehicle with landing-only images selected directly from `media` without a matching approved/right-cleared `vehicle-media-assets` record.
* Editing unrelated fields on an already-published legacy vehicle if that vehicle already contains unapproved landing/gallery media.

That is acceptable if the intended workflow is:

1. Create/import vehicle as draft.
2. Attach media assets.
3. Approve/right-clear assets.
4. Publish.

The risk is UX: landing builders and image tools need to clearly explain why a selected image cannot publish. Otherwise operators will think the CMS is broken.

## 5. Are field-level approval controls sufficient for v1?

**Sufficient for normal Payload collection access, with one UX caveat.**

`approvalStatus` and `rightsStatus` are now field-gated to `admin` and `media_editor`, while the collection itself is still manageable by broader media roles. That is a good v1 split.

Caveat: `VehicleImageStudio.tsx` still attempts to create assets with `approvalStatus: 'approved'` and `rightsStatus: 'owned'` from the client at lines `441-444`, `596-597`, and `664-665`. For non-`admin` / non-`media_editor` users, Payload field access should prevent those fields from being set, which means the later assign step can fail because the asset is not actually approved. That is safer, but the UI should be updated so inventory operators do not get a confusing “assign failed” flow.

# What remains before production cutover

## Launch blockers

1. **Fix or remove `/vehicle-preview/[id]`.**
   This is the main remaining blocker. It bypasses the new serializer and likely bypasses access control via Payload Local API defaults.

Minimum acceptable fix:

```ts
// Either remove the route entirely,
// or make it authenticate + call toPublicVehicleDetail(),
// or redirect to the role-gated /api/public/vehicles/preview/[id] consumer.
```

2. **Confirm there are no deployed rewrites exposing that preview route.**
   I found no middleware in the bundle, so I would assume it is public until proven otherwise.

## Should-fix before production

1. **Add a regression test for `/vehicle-preview/[id]` or delete it.**
   The new smoke test covers the pure serializer, not this public page route.

2. **Clarify collection/SEO media policy.**
   If collection images are public editorial assets, document that they are outside `vehicle-media-assets`. If not, gate or remove `collection.image` and `seo.image` from public output.

3. **Update image approval UX for non-approver roles.**
   Hide “use as hero/gallery” for assets that are not actually approved/right-cleared, or show a clear “requires media editor approval” state.

4. **Include or intentionally omit `templateOverrides.mobileCta`.**
   The schema has it; the public serializer currently drops it.

5. **Run a production data cleanup check.**
   Find published vehicles with landing/gallery media that lack approved/right-cleared assets before cutover, because future edits will start failing until those records are cleaned.

## Safe follow-up after v1

* Usage-specific approval checks, if `vehicle_hero`, `vehicle_gallery`, and `landing_page` need separate approvals.
* Stronger SSRF/network egress controls for remote image import.
* Transactional media assignment instead of best-effort rollback.
* Broader multi-tenant role isolation once this becomes a multi-client platform.
* A generic media approval model for non-vehicle public images, if collection/homepage/SEO media must be governed too.

# Final ship call

**The Round 3 landing serializer blocker is closed for the public vehicle API.**

**The project is still CONDITIONAL-GO because `/vehicle-preview/[id]` is a public raw preview bypass.** Fix or remove that route, then I would call this a clean v1 launch candidate with only normal production cutover items remaining.

[1]: https://payloadcms.com/docs/local-api/overview?utm_source=chatgpt.com "Local API | Documentation"


3m57s · gpt-5.5-pro[browser] · ↑431.71k ↓2.13k ↻0 Δ433.84k
files=2

3m57s · n/a · ↑431.71k ↓2.13k ↻0 Δ433.84k | slug=inventory-landing-round-four-2
