# REVIEW TO GPT-5.5 PRO - Round 2 Inventory Stabilization

> Read ORIENT.md first. This is a code-review packet for the delta after the prior NO-SHIP inventory audit. Please use `PRIOR_CONTEXT.md` for continuity.

## Intent

Review the implemented stabilization round for the GBE Autos CMS Admin inventory system. The goal is to determine where we now stand against the prior review, what is still unsafe or incomplete, and what concrete actions remain before production.

Mode: code-review.

Base reviewed state: `e473521` (`Fix inventory loading on Supabase`).

Current state under review: uncommitted working tree changes in `C:\Users\Kecin\Desktop\GBEAutosCMSAdmin`, plus one related public frontend change in `C:\Users\Kecin\Desktop\GBE Autos\lib\cms.ts` summarized below.

## User Intent / Important Product Decision

The user clarified that `/admin/inventory` is the primary inventory UI and should remain the main operator workflow. Native Payload `/admin/collections/vehicles` must not be promoted in the UI, but should remain directly reachable as a hidden emergency/schema fallback. Current implementation keeps `Vehicles.admin.group = false`, sidebar Inventario points to `/admin/inventory`, and native `/admin/collections/vehicles` returns 200 if manually opened.

## What Changed In This Round

### Server-authoritative vehicle state

- `src/collections/Vehicles.ts` now derives `imageStatus`, `specStatus`, and `completenessScore` from the assembled full doc (`originalDoc + data`) instead of only the partial PATCH body.
- Server publish guard now calls `getVehiclePublishIssues` when the assembled vehicle is published, so direct REST, bulk publish, native Payload edits, and custom workspace edits share the same blocking rules.
- `src/services/vehicleWorkflow.ts` now refuses to preserve `approved/generated` image status without a real Payload `image` relation, treats empty specs as `missing`, and supports routing through dealership/city/fallback.

### Image approval enforcement

- Added `src/app/(payload)/api/cms/vehicle-media-assets/assign/route.ts`.
- New endpoint: `POST /api/cms/vehicle-media-assets/assign`.
- Body: `{ vehicleId, assetId, target: "hero" | "gallery" }`.
- Requires authenticated `admin`, `inventory_manager`, or `media_editor`.
- Only assigns assets with `approvalStatus: "approved"` and `rightsStatus` in `owned|licensed`.
- `src/components/views/VehicleImageStudio.tsx` now records/uses a `vehicle-media-assets` record before assigning public hero/gallery images.
- Imported provider candidates remain library assets unless approved; synced/imported owned images can be approved/assigned.

### Secured paid/admin endpoints and import protections

- `/api/cms/vehicle-specs` now requires Payload auth and `admin|inventory_manager`.
- `/api/cms/vehicle-photos` import now requires `vehicleId`, validates `http/https`, rejects localhost/private IP sources, enforces image MIME, size, and timeouts.

### Inventario primary route with Payload fallback

- `/admin/inventory` remains primary and visible.
- Native `/admin/collections/vehicles` stays hidden from nav but directly reachable.
- `/admin/collections/vehicles/:id/workspace` remains the custom workspace route.
- Comments in `Vehicles.ts` and `AdminBuilderNavLinks.tsx` clarify primary-vs-fallback intent.

### Custom workflow stabilization

- `InventoryManager` bulk update/delete now checks each response and reports partial failures.
- `VehicleCreateFlow` and `VehicleWorkspaceTab` no longer manually write `specStatus: "manual"` or `"matched"`; server derives it.
- `VehicleImportModal` uses pinned local `xlsx@0.18.5` instead of CDN SheetJS.
- Import runner no longer creates placeholder dealerships; imports remain draft and return warning rows for missing dealership/price/review needs.
- AI image wizard is feature-gated behind `NEXT_PUBLIC_ENABLE_AI_IMAGE_WIZARD=true`.
- Public CMS API only exposes hero image when `imageStatus === "approved"`.
- Supabase image sync script now blocks direct vehicle table image updates unless `ALLOW_DIRECT_VEHICLE_IMAGE_DB_UPDATE=true`.
- Admin style duplicate selector issue fixed.

### Related public frontend change outside this repo

In `C:\Users\Kecin\Desktop\GBE Autos\lib\cms.ts`, added `CMS_STRICT_MODE` / `NEXT_PUBLIC_CMS_STRICT_MODE`. Local fallback can remain for development, but strict mode throws on missing/failed CMS requests so staging/production smokes can fail loudly instead of silently using static fallback data.

## Verification Already Run

- `npm run generate:importmap` passed.
- `npm run generate:types` passed during the main stabilization pass.
- `npm run check:admin-styles` passed.
- `npm run lint` passed with only pre-existing warnings in `src/migrations/20260521_060610_site_builder_schema.ts`.
- `npm run build` passed.
- `npm run test:e2e:production` passed: 28 passed, 5 warnings, 1 skipped, 0 failed.
- HTTP smoke:
  - `GET /api/cms/vehicle-specs?action=makes` unauthenticated returns 401.
  - `GET /api/public/vehicles?limit=3` returns 200.
  - `/admin/inventory`, `/admin/collections/vehicles`, and `/admin/collections/vehicles/5223/workspace` return 200.

## Inventario Feature Surface To Review

Please review whether these features are now correctly built, what remains fragile, and which should be changed before production.

### 1. Inventory list/dashboard (`InventoryManager`)

- Route: `/admin/inventory`.
- Loads vehicles from Payload REST `/api/vehicles` with tab filters for published, drafts, needs review, missing images, used, and archived.
- Supports search, sort, pagination, card/table display, row selection, bulk status changes, and bulk delete.
- Bulk updates are still client-side loops over `/api/vehicles/:id` but now inspect response statuses and surface failures.
- Uses thumbnails from Payload Media relation or synced image URL for display, but public API only exposes approved Payload image relation.

### 2. Create vehicle (`VehicleCreateFlow`)

- Route: `/admin/inventory/new`.
- Creates draft vehicles through Payload REST `/api/vehicles`.
- Captures core fields: brand, model, trim, year, condition, inventory status, dealership, city, price, mileage, colors, description, body type, transmission, fuel, specs/source metadata.
- Uses `VehicleSpecsLookup` to apply RapidAPI/catalog specs into the Payload `specs` group.
- Does not manually force `specStatus`; server derives state.

### 3. Vehicle workspace (`VehicleWorkspaceTab`)

- Route: `/admin/collections/vehicles/:id/workspace`.
- Loads vehicle, dealership/tag options, analytics events, leads, and related editing panels.
- Supports core edits, publish status changes, tag assignment/creation, landing sections, template overrides, specs lookup, and image studio.
- Saves through Payload REST `/api/vehicles/:id`; server now owns publish validation and derived workflow state.

### 4. Specs lookup (`VehicleSpecsLookupModal`)

- Calls `/api/cms/vehicle-specs` for makes, models, generations, trims, and trim specs.
- Endpoint is now authenticated and role-gated.
- Applies normalized specs/source metadata into create/workspace drafts.
- Needs review for provider caching/rate-limit behavior and UX failure states.

### 5. Image studio (`VehicleImageStudio`)

- Loads vehicle media assets and templates.
- Supports direct upload, CarsXE candidate search/import, synced-image import, local asset use, gallery remove/reorder, crop/save, and opening AI wizard.
- Public hero/gallery assignment now goes through `/api/cms/vehicle-media-assets/assign`.
- Server requires approved/right-cleared asset before assigning public hero/gallery.
- Direct remove/reorder gallery still PATCHes vehicle gallery directly; review whether that is acceptable or should also go through server action.

### 6. Vehicle photo API (`/api/cms/vehicle-photos`)

- GET searches/caches CarsXE image candidates and local matches.
- POST imports a remote candidate into Payload Media and creates `vehicle-media-assets`.
- Now validates auth, role, URL scheme, localhost/private addresses, MIME, size, timeout, and vehicle context.
- Imported provider candidates default to review/unknown rights unless caller supplies owned/approved for synced agency images.

### 7. AI image wizard (`VehicleAIImageWizard`)

- Currently feature-gated off unless `NEXT_PUBLIC_ENABLE_AI_IMAGE_WIZARD=true`.
- Existing implementation supports selecting source images, styles/templates, creating workshop jobs, running generation, importing outputs, cropping outputs, saving templates, and reusing outputs.
- Because it is gated off, production v1 does not rely on this path. If enabled later, it likely still needs the same approved-asset assignment enforcement as Image Studio.

### 8. Import modal and import runner

- `VehicleImportModal` parses CSV and XLSX locally with pinned `xlsx`.
- Maps workbook columns to normalized vehicle draft fields.
- Calls `/api/cms/import/run`.
- Import runner creates/updates draft vehicles, no longer creates placeholder dealerships, returns row warnings/errors, and leaves dealership/image/spec issues for review before publish.

### 9. Public API contract

- `/api/public/vehicles` and `/api/public/vehicles/[slug]` expose published, non-sold vehicles.
- Cards expose stable public fields and now only expose hero image when `imageStatus === "approved"`.
- Detail exposes description, features, gallery, landing, specs, sourceMeta, and templateOverrides.

## Specific Questions For Pro

1. Has this delta adequately addressed the prior critical no-ship issues, especially partial PATCH state corruption, publish bypass, image approval enforcement, and paid endpoint auth?
2. Are there new regressions or unsafe assumptions in the new `/api/cms/vehicle-media-assets/assign` endpoint?
3. Is keeping `/admin/inventory` primary while `/admin/collections/vehicles` is hidden-but-reachable a sound Payload CMS integration compromise?
4. Which Inventario features listed above are production-ready, which are still prototype-grade, and which should be changed before launch?
5. Are there any remaining paths where unapproved or rights-unknown media can reach the public website?
6. What should be the next concrete implementation phase: Supabase-to-Payload Media importer, AI wizard hardening, import workflow hardening, public frontend contract smokes, or something else?

## Out Of Scope For This Review

- Do not request a total rewrite of Payload/Payload admin unless there is a concrete blocking reason.
- Do not evaluate visual design polish beyond functional correctness and operator safety.
- Do not require AI wizard to be production-ready for v1 unless its disabled state is insufficient.
- Do not mutate production Supabase data.

## Desired Output

- Verdict: GO / REVISE / NO-SHIP for this stabilization round.
- Findings ordered by severity with file/path evidence.
- A table mapping the Inventario features to: ready, needs changes, defer/flag.
- Remaining action list to move toward production.
- Explicit note on whether the prior NO-SHIP concerns are resolved, partially resolved, or still open.
