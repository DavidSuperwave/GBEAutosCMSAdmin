🧿 oracle 0.14.0 — Prompt drama in; release notes out.
Chain: root -> inventory-stabilizat-round-two
Created: undefined
Status: completed
Models:
- gpt-5.5-pro — completed tok=4.91k/419.37k
Browser evidence:
- model requested=Pro; resolved=(unavailable); status=already-selected; strategy=current; verified=no
Artifacts:
- Browser transcript — C:\Users\Kecin\.oracle\sessions\inventory-stabilizat-round-two\artifacts\transcript.md (30.1 KB)
Answer:
# Verdict: **NO-SHIP for production; REVISE the stabilization round**

This round materially improves the prior state, especially around partial PATCH derivation, specs endpoint auth, and making `/admin/inventory` the intended workflow. But it does **not** fully close the prior NO-SHIP concerns. The two remaining blockers are direct public/API bypasses around vehicle/media visibility and media approval enforcement. I reviewed this against the previous NO-SHIP checklist, which specifically called out partial PATCH corruption, split image source of truth, unenforced media approval, unauthenticated paid specs proxy, import workflow weakness, AI wizard scope, and public API instability. 

Scope note: the bundle did not include a usable diff artifact; `change-artifacts/full.diff`, `diffstat.txt`, and `commit_log.txt` are empty. I reviewed the bundled current tree under `repo/`. I also could not verify the related external public frontend change in `C:\Users\Kecin\Desktop\GBE Autos\lib\cms.ts` because that file is summarized but not included.

---

## Blocking findings

### 1. Raw Payload REST still exposes inventory data publicly

**Severity: Critical**

`Vehicles.access.read` is still `read: () => true` in `src/collections/Vehicles.ts:238-240`. Because the generated Payload REST route exports public `GET` handling at `src/app/(payload)/api/[...slug]/route.ts:14`, unauthenticated callers can hit raw Payload endpoints such as `/api/vehicles`, not only the curated `/api/public/vehicles`.

That means the public can potentially read draft, needs-review, archived, and internal vehicle fields, including hidden sync fields such as `imageUrl`, `imagePath`, `imageFilename`, `sourceId`, `sourceImportId`, `sourceDealerName`, `reviewNotes`, source metadata, and unpublished landing/template data. The curated public route filters to published/non-sold vehicles, but the underlying collection access does not.

Related leaks also exist in:

| Collection             |                                 File evidence | Risk                                                 |
| ---------------------- | --------------------------------------------: | ---------------------------------------------------- |
| `vehicles`             |         `src/collections/Vehicles.ts:238-240` | Draft/internal inventory exposed through raw REST.   |
| `vehicle-media-assets` | `src/collections/VehicleMediaAssets.ts:12-16` | Candidate/source/approval/rights metadata is public. |
| `vehicle-collections`  | `src/collections/VehicleCollections.ts:52-58` | Hidden/manual collections can leak through raw REST. |

**Required fix:** make raw collection reads authenticated by default, or return only a minimal public filter. The safest pattern is: authenticated admin users can read the full collection; unauthenticated traffic must use `/api/public/*` only. Then update `/api/public/vehicles` and `/api/public/collections` to use `overrideAccess: true` internally and manually serialize safe fields.

---

### 2. Approved hero image can still be bypassed by direct vehicle PATCH/native edit

**Severity: Critical**

The new assign endpoint is a good step, but it is not the server invariant. `deriveImageStatus` preserves an explicit `approved` status whenever there is any image relation: `src/services/vehicleWorkflow.ts:111-121`. `Vehicles.beforeValidate` then merges `originalDoc + data`, derives `imageStatus`, and only checks publish issues from that derived object: `src/collections/Vehicles.ts:320-335`.

This leaves at least two bypasses:

1. An authenticated inventory manager can directly PATCH a vehicle with `{ image: <mediaId>, imageStatus: "approved" }`.
2. If a vehicle already has `imageStatus: "approved"`, changing only `image` can inherit the prior approved status because `originalDoc.imageStatus` survives the merge.

There is no check that the chosen media has a corresponding `vehicle-media-assets` record with `approvalStatus: "approved"` and `rightsStatus: "owned" | "licensed"`.

The new endpoint enforces approval correctly inside `src/app/(payload)/api/cms/vehicle-media-assets/assign/route.ts:80-98`, but it is only one code path. The public serializer trusts `vehicle.imageStatus === "approved"` at `src/services/publicVehicleCatalog.ts:267-269`.

**Required fix:** enforce hero approval in `Vehicles.beforeValidate` or a dedicated async workflow hook, not only in `/api/cms/vehicle-media-assets/assign`. On publish, and whenever `image` changes, verify the exact media ID against an approved/right-cleared `vehicle-media-assets` row for that vehicle. Also stop preserving `approved` when the image relation changes.

---

### 3. Gallery images can still publish without approval or rights clearance

**Severity: Critical**

The gallery public serializer exposes every gallery media item with no approval/rights check: `src/services/publicVehicleCatalog.ts:280-285` and `src/services/publicVehicleCatalog.ts:288-294`.

The Image Studio now uses `/api/cms/vehicle-media-assets/assign` for adding approved gallery assets, which is good. But the vehicle `gallery` field itself remains directly writable through Payload REST/native edit, and the custom UI still PATCHes gallery directly for remove/reorder at `src/components/views/VehicleImageStudio.tsx:371-418`. If any caller adds an unapproved media ID to `gallery`, the public detail route will expose it.

This is a direct remaining path where rights-unknown media can reach the public site.

**Required fix:** either make gallery additions go through a server action only, or add a `Vehicles.beforeValidate` check that every gallery image on a published vehicle has an approved/right-cleared `vehicle-media-assets` record. Also make `toPublicVehicleDetail` filter gallery images by approved asset records rather than trusting the raw `gallery` array.

---

### 4. The AI wizard remains dangerous if the feature flag is enabled

**Severity: High**

The feature gate is useful, and keeping it off for v1 is the right decision. However, the enabled code path still directly PATCHes public vehicle media:

* Gallery direct PATCH: `src/components/views/VehicleAIImageWizard.tsx:1069-1085`
* Hero direct PATCH with `imageStatus: "approved"`: `src/components/views/VehicleAIImageWizard.tsx:1088-1097`
* Import output then records the asset after assignment: `src/components/views/VehicleAIImageWizard.tsx:1101-1116`

That ordering is backwards for the new model. If enabled, it reintroduces the exact bypass the assign endpoint is meant to eliminate.

**Required fix:** before ever enabling `NEXT_PUBLIC_ENABLE_AI_IMAGE_WIZARD=true`, convert AI hero/gallery assignment to `/api/cms/vehicle-media-assets/assign` and require approved/right-cleared assets before public use.

---

### 5. Remote image import is improved, but still not hardened enough for production

**Severity: High**

`/api/cms/vehicle-photos` now validates auth, role, URL scheme, DNS/private IP, MIME, size, and timeout. That is meaningful progress. Evidence: auth/role checks at `src/app/(payload)/api/cms/vehicle-photos/route.ts:683-690`, URL/private-address checks at `src/app/(payload)/api/cms/vehicle-photos/route.ts:196-217`, and MIME/size checks at `src/app/(payload)/api/cms/vehicle-photos/route.ts:727-747`.

Remaining problems:

* `fetch` follows redirects by default; the code validates the original URL but not the final redirected URL.
* DNS is checked before fetch, so DNS rebinding/final connection drift remains possible.
* The endpoint downloads the full `arrayBuffer()` before checking `MAX_IMPORT_BYTES`, so oversized responses can still consume memory before rejection.
* The API lets the request body provide `approvalStatus` and `rightsStatus` at `src/app/(payload)/api/cms/vehicle-photos/route.ts:711-712`, then stores those values at `src/app/(payload)/api/cms/vehicle-photos/route.ts:781-782`. That is convenient for synced agency images, but too broad for arbitrary remote URLs.
* SVG is not explicitly rejected; `image/*` MIME alone is not a sufficient safety boundary.

**Required fix:** validate redirects/final URLs, stream with a hard byte cap, reject SVG unless sanitized, and only allow caller-supplied `approvalStatus: approved` / `rightsStatus: owned` through a tightly scoped synced-image path or admin-only action.

---

## Non-blocking but important findings

### Specs endpoint is now authenticated, but still lacks quota/rate-limit controls

`/api/cms/vehicle-specs` now requires an authenticated user with `admin` or `inventory_manager` role at `src/app/(payload)/api/cms/vehicle-specs/route.ts:130-138`. That resolves the prior unauthenticated paid proxy issue.

Remaining concern: provider calls use Next fetch revalidation for one hour at `src/app/(payload)/api/cms/vehicle-specs/route.ts:30-37`, but there is no per-user throttling, persistent cache table, or quota feedback. For a small internal team, this is acceptable for v1, but it should be added before broader operator rollout.

### Import workflow is safer but still not daily-ingestion-grade

The import runner now authenticates users and limits roles at `src/app/(payload)/api/cms/import/run/route.ts:43-51`, creates drafts at `src/app/(payload)/api/cms/import/run/route.ts:139-145`, and avoids placeholder dealership creation. That is a good stabilization.

Remaining gaps: no transaction around import job + vehicle writes, limited duplicate detection, no max row/file limits server-side, no rollback endpoint shown, and the job is marked `completed` even when row errors exist. It is acceptable for controlled draft backfills, not a production daily ingestion pipeline.

### Publish validation is materially better, but media approval is not complete

The server now derives status from assembled data at `src/collections/Vehicles.ts:320-329` and blocks critical publish issues at `src/collections/Vehicles.ts:331-335`. That addresses the broad partial PATCH state-corruption issue.

However, the publish validator only sees `image` and `imageStatus`; it does not verify the image/media asset approval record. That leaves the blocker above.

---

## Prior NO-SHIP concern status

| Prior concern                                                        | Current status                        | Notes                                                                                                               |
| -------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Partial vehicle PATCH corrupts image/spec/completeness state         | **Mostly resolved**                   | `originalDoc + data` derivation is the right pattern, but image approval status is preserved too broadly.           |
| Custom Inventario replaces native workflow without server validation | **Partially resolved**                | Publish/spec/completeness moved server-side. Media approval still depends on using the intended endpoint.           |
| Split image source of truth                                          | **Partially resolved**                | Public hero now prefers Payload Media relation, but legacy `imageUrl` fields still exist and raw REST exposes them. |
| Media approval lifecycle not enforced                                | **Still open / blocking**             | Assign endpoint is good, but direct vehicle PATCH/native edit/gallery/API paths remain.                             |
| `/api/cms/vehicle-specs` unauthenticated paid proxy                  | **Resolved**                          | Auth + role check added. Add rate limits later.                                                                     |
| Spec status claims manual/matched while empty                        | **Mostly resolved**                   | Empty specs become `missing`; matched requires provider source and enough filled fields.                            |
| Import workflow not production-grade                                 | **Partially resolved**                | Safer draft import, but still not daily ingestion.                                                                  |
| Admin list/search/filter/bulk correctness gaps                       | **Improved**                          | Bulk actions now inspect failures. Still client-loop based.                                                         |
| AI image wizard prototype-grade                                      | **Acceptable only while flagged off** | If enabled, it still bypasses the new media assignment model.                                                       |
| Public vehicle API contract not launch-stable                        | **Still open / blocking**             | Curated `/api/public/*` improved, but raw Payload collection reads are public.                                      |
| Server-side image import accepts arbitrary URLs                      | **Partially resolved**                | Better validation, but redirects/rebinding/approval spoofing remain.                                                |

---

## Inventario feature readiness table

| Feature                       | Status                       | Launch note                                                                                                                                   |
| ----------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory list/dashboard      | **Needs changes**            | Usable operator UI. Bulk failures improved. But it relies on raw `/api/vehicles`, whose public read access must be locked down.               |
| Create vehicle                | **Mostly ready**             | Draft creation path is reasonable. Server-derived spec status is good.                                                                        |
| Vehicle workspace             | **Needs changes**            | Core edit/publish flow is improved. Must prevent direct image/gallery approval bypasses.                                                      |
| Specs lookup                  | **Ready for controlled v1**  | Auth fixed. Add rate limits/persistent caching later.                                                                                         |
| Image Studio                  | **Needs changes**            | Good direction with asset records + assign endpoint. Must move gallery enforcement/server validation into invariants.                         |
| Vehicle photo API             | **Needs changes**            | Safer than before, but not fully hardened for arbitrary remote fetches.                                                                       |
| AI image wizard               | **Defer / flag**             | Keeping it disabled is correct. Do not enable until it uses the approved-asset assignment path.                                               |
| Import modal + runner         | **Controlled backfill only** | Good for draft imports. Not yet production daily ingestion.                                                                                   |
| Public API contract           | **Needs changes / blocking** | Curated serializer improved, but raw Payload REST leaks and gallery approval filtering are not stable.                                        |
| Native Payload fallback route | **Sound compromise**         | Keeping `/admin/inventory` primary and native Vehicles hidden-but-reachable is fine, but field/server invariants must make native edits safe. |

---

## Answers to the specific questions

1. **Has the delta adequately addressed the prior critical issues?**
   Partially. Partial PATCH status derivation and specs auth are substantially addressed. Publish bypass is improved but not complete. Image approval enforcement is still incomplete because direct vehicle PATCH/native edit/gallery paths can bypass the new assign endpoint.

2. **New regressions or unsafe assumptions in `/api/cms/vehicle-media-assets/assign`?**
   The endpoint itself is directionally good: it authenticates, role-gates, verifies vehicle ownership when present, requires `approved`, and limits rights to `owned|licensed`. Main gaps are that it is not the only write path, it updates vehicle before asset usage without a transaction, and it allows vehicle-less assets to be assigned to any vehicle unless that is an explicit approved-library concept.

3. **Is `/admin/inventory` primary with hidden native fallback sound?**
   Yes. That is a reasonable Payload compromise. The caveat is that native routes and raw REST must be safe by construction. Right now `imageStatus`, `image`, and `gallery` can still be edited in ways that bypass the approval lifecycle.

4. **Which features are production-ready vs prototype?**
   Specs lookup and draft create are closest to ready. Inventory/workspace/Image Studio need approval and access-control fixes. Import remains controlled-backfill grade. AI wizard remains prototype/flagged.

5. **Remaining paths where unapproved or rights-unknown media can reach public website?**
   Yes: direct PATCH/native edit of `image + imageStatus`, changing `image` on an already-approved vehicle, direct PATCH/native edit of `gallery`, AI wizard if enabled, and public detail gallery serialization.

6. **Next concrete implementation phase?**
   Do **not** start with AI wizard hardening. First fix server invariants and public access. Then build the Supabase-to-Payload Media importer.

---

## Required action list before production

1. **Lock down raw Payload REST reads.**
   Make `vehicles`, `vehicle-media-assets`, and probably `vehicle-collections` authenticated for full reads. Use `/api/public/*` as the only public contract.

2. **Make media approval a server invariant.**
   On publish and on any hero/gallery change, verify the exact media IDs against approved/right-cleared `vehicle-media-assets` rows.

3. **Stop preserving approved hero status when the hero media changes.**
   `deriveImageStatus` should not allow old approval to carry over to a new media relation.

4. **Filter public gallery by approved/right-cleared assets.**
   Do not serialize raw `vehicle.gallery` to public detail without asset approval checks.

5. **Move all public media mutations through server actions.**
   Add dedicated endpoints for hero assign, gallery add, gallery remove, and gallery reorder. Reorder/removal can be looser, but additions must be approval-checked.

6. **Harden remote image import.**
   Validate redirects/final URLs, stream with hard byte cap, block SVG, and restrict caller-supplied approved/owned status.

7. **Add regression smokes for the actual bypasses.**
   Add tests that prove unauthenticated `/api/vehicles` cannot see drafts/internal fields, direct PATCH cannot approve arbitrary hero media, direct PATCH cannot add unapproved gallery media to a published vehicle, and `/api/public/vehicles/[slug]` never returns unapproved gallery images.

8. **Then build Supabase-to-Payload Media migration/importer.**
   After invariants are enforced, bulk-import synced Supabase images into Payload Media + `vehicle-media-assets`, defaulting to draft/review unless the source is explicitly trusted.

Bottom line: this is a strong stabilization pass, but not production-safe yet. The remaining blockers are concentrated and fixable; once raw public REST access and media approval invariants are closed server-side, the inventory system can move from NO-SHIP to a realistic launch candidate.


7m42s · gpt-5.5-pro[browser] · ↑414.45k ↓4.91k ↻0 Δ419.37k
files=2

7m42s · n/a · ↑414.45k ↓4.91k ↻0 Δ419.37k | slug=inventory-stabilizat-round-two
