# Repository Reconciliation

## F001 — Three-role fail-closed migration (admin/general/sales) replacing the live six-role enum

**Classification:** `partially_implemented`  
**User outcome:** Administrators trust that only the three explicitly granted business roles confer access: an account with a missing, null, stale, or invalid role can do nothing privileged, and every guard speaks the approved role language.  
**Business value:** Closes the highest-leverage security hole — every guard currently fails open to admin for roleless authenticated users — and aligns the entire authorization layer with the confirmed three-role product model before any other feature builds on it.

### Repository evidence

- src/access/roles.ts:31-40 — getRoles returns ['admin'] for any authenticated user with no role ('Users without any role behave as admins')
- src/access/roles.ts:12-27 — the code role set is the legacy six roles, matching the [MCP-live-verified] live enum which has neither 'general' nor 'sales'
- src/services/cmsRequestAuth.ts:40 — requireCmsRole delegates to hasRole and inherits the fail-open fallback across all custom CMS routes
- src/collections/Users.ts:44-56 — role select defaults to 'viewer' (not a valid target role) with admin-only field access already in place
- src/app/(payload)/api/public/vehicles/preview/[id]/route.ts:12-16 — guards name legacy roles inventory_manager/content_editor that will not exist after migration
- Consultation [MCP-live-verified]: live enum is exactly admin, inventory_manager, content_editor, sales_manager, media_editor, viewer; 3 user rows; per-user values unknown pending D02/D06

### Acceptance criteria

- [ ] The live role enum contains exactly admin, general, and sales; every user row holds exactly one valid target role per the signed-off D02 mapping; the migration is idempotent, staged-tested, and aborts on unmapped users
- [ ] getRoles resolves missing/null/blank/invalid roles to no roles — never admin — and anonymous access remains denied; 'viewer' no longer exists as a default or option
- [ ] Every guard, field access rule, custom route, and admin UI option references only the three target roles per the D01 matrix; no reference to the six legacy roles remains in src
- [ ] Security tests prove 401/403 for anonymous, roleless, and invalid-role fixtures on invite, vehicle-specs, import, workshop, media review, and preview endpoints, and the documented allow/deny matrix passes per role
- [ ] A pre-migration user export and rollback procedure are archived; the migration never runs against production during blueprint/build work

## F002 — Operations truth capture — complete the blocked read-only live facts

**Classification:** `partially_implemented`  
**User outcome:** The team plans migrations from verified facts — Postgres version, sizes, policies, grants, privileged functions, Storage bucket restrictions, role distribution, and content-quality aggregates — instead of estimates and unknowns.  
**Business value:** Every migration in this roadmap (roles, price, media, homepage reconciliation) mutates live business data; the audit already verified schema shape, enums, advisors, and row estimates via MCP but every execute_sql was cancelled, so the exact aggregates that gate F001, F009-F011, and F013 remain unknown.

### Repository evidence

- docs/product/inputs/SUPABASE_LIVE_READONLY_AUDIT_20260710_VERIFIED.md — MCP-01..MCP-12 succeeded (tables, extensions, migrations, advisors, generated types, docs) while MCP-13..MCP-20 (all SQL) were cancelled before execution
- The audit ships the exact read-only capture transactions: version/sizes/forced-RLS, policies/grants/views/SECURITY DEFINER, Storage bucket aggregate, and roles/content aggregates
- src/migrations contains 15 registered migration modules versus 17 live payload_migrations rows — the audit requires a safe name-only capture to reconcile before migration planning
- scripts/production-e2e-smoke.ts exists as a read-only smoke check but captures none of the required catalog/aggregate artifacts

### Acceptance criteria

- [ ] Archived, timestamped read-only outputs exist for: server version, per-object sizes and forced-RLS state, policy inventory, API-role grants, views/materialized views, SECURITY DEFINER functions, Storage bucket identity/visibility/limits/aggregates, user role distribution, vehicle price/image/status aggregates, dealership/pages/site_config/media/leads/analytics aggregates, and a name-only payload_migrations reconciliation
- [ ] No mutation, RPC, identity read, object-name read, or secret read occurred during capture
- [ ] The pages orphan-child question (0 parent rows vs 1 row each in pages_blocks_hero and pages_blocks_cta) is resolved with exact counts and foreign-key state
- [ ] F002's gate flips to passed in a dated addendum, and D02's mapping review is scheduled from the role-distribution output

## F003 — Minimum Node 22 CI and security-test harness

**Classification:** `not_implemented`  
**User outcome:** Every change is proven by a reproducible pipeline — install, style guard, typecheck, lint, focused security tests, production build — before it ships.  
**Business value:** No CI, test framework, or typecheck script exists, so no later feature's acceptance criteria are mechanically enforceable; the audit sequences this immediately after F001 so the fail-closed proof becomes a permanent regression gate.

### Repository evidence

- No .github/workflows directory exists (verified live)
- package.json:7-27 — scripts contain build/lint/migrate/seed/smoke but no test, typecheck, or CI entry point; :59-61 pins engines to node 22.x
- scripts/check-admin-styles.mjs exists as the one wired quality guard (npm run check:admin-styles)
- scripts/production-e2e-smoke.ts:1 targets production, not an ephemeral CI database

### Acceptance criteria

- [ ] A clean checkout on Node 22 runs install, style guard, typecheck, lint, focused security tests, and production build as required CI checks, all passing
- [ ] The security tests never touch the production database; their target is ephemeral or explicitly authorized
- [ ] CI artifacts (logs, reports, build output) are retained and linkable
- [ ] Documentation states what CI does and does not prove (no browser coverage, no Storefront verification yet)

## F004 — Vehicle raw/public/preview boundary contracts under the three-role model

**Classification:** `partially_implemented`  
**User outcome:** Anonymous visitors see exactly the published, non-sold, approved-media vehicle data intended for the storefront — and nothing else — through frozen, tested DTO contracts; staff preview works only for permitted target roles.  
**Business value:** Locks in the existing hardening with regression proof so the vehicle boundary cannot silently reopen, gives the Storefront a stable contract, and reconciles the duplicate status/image paths the live audit confirmed (status vs inventory_status, _status vs publish_status, legacy image columns vs image_id).

### Repository evidence

- src/collections/Vehicles.ts:243-247 — raw reads require authentication; mutations require inventory roles
- src/services/publicVehicleCatalog.ts — bounded public DTO service enforcing published/non-sold serialization for the public routes under src/app/(payload)/api/public/vehicles/
- src/app/(payload)/api/public/vehicles/preview/[id]/route.ts:12-16 — preview requires requireCmsRole but with legacy role names
- src/app/(payload)/api/[...slug]/route.ts:14-19 and src/app/(payload)/api/graphql/route.ts — raw REST and GraphQL remain mounted, so the boundary rests on per-collection access rules only tests keep honest
- src/collections/Vehicles.ts:620-643,749-771 — overlapping inventoryStatus/publishStatus and legacy image fields the contract must pin down; live DB additionally carries legacy 'status' and Payload '_status' columns [MCP-live-verified]

### Acceptance criteria

- [ ] Anonymous requests to raw REST and GraphQL for vehicles, vehicle-collections, and vehicle-media-assets are denied, with tests
- [ ] Public list/detail/collection/preview DTO snapshots are frozen and any field change fails CI
- [ ] Unpublished, sold, and unapproved-media content is proven absent from every public path
- [ ] Preview endpoints deny anonymous and roleless users and succeed only for the D01-designated roles
- [ ] The canonical status fields are documented and the legacy status/_status duplication has a written reconciliation plan

## F005 — Content and reference access closure with a safe public dealership DTO

**Classification:** `partially_implemented`  
**User outcome:** Internal operational data — dealership internal notes and staff names, site configuration writes, page mutations — is readable and writable only by roles that need it, while the storefront gets a bounded dealership DTO including an approved external website link.  
**Business value:** Closes the remaining always-true and Payload-default boundaries, eliminates public exposure of person-related internal fields, and creates the approved external-URL capability the confirmed product model requires (route visitors to external dealership sites GBE does not control) — none of which the current schema supports.

### Repository evidence

- src/collections/Dealerships.ts:5-7 — access declares only read: () => true; create/update/delete fall to Payload defaults; internalNotes (:57-63), salesRepName (:55), and email (:35) are publicly readable
- src/collections/Dealerships.ts — no external website URL field exists anywhere in the collection, matching the [MCP-live-verified] finding of no external-site URL column
- src/globals/SiteConfig.ts:10-12 — only read: () => true; no update access declaration
- src/collections/Pages.ts:30-35 — public read over all fields regardless of the manual status field at :69-78
- src/collections/Media.ts:7-12 — public read with role-guarded mutations (to be ratified in the matrix)
- src/collections/AnalyticsEvents.ts:8-9 — any authenticated user may update or delete raw analytics events

### Acceptance criteria

- [ ] internalNotes, salesRepName, and other internal fields are not readable anonymously via any path; the public dealership DTO exposes only visitor-safe fields including the approved external URL
- [ ] SiteConfig updates require the D01-designated role; anonymous and unprivileged writes are denied with tests
- [ ] Dealerships, Pages, Media, and VehicleTags mutations are explicitly role-guarded — no collection relies on Payload defaults
- [ ] AnalyticsEvents update/delete require admin
- [ ] The dealership externalUrl field exists with documented approval semantics, and only approved links are served publicly

## F006 — Lead and analytics ingestion hardening

**Classification:** `not_implemented`  
**User outcome:** Sales staff see leads and metrics that reflect real customer actions: one submission equals one lead, events cannot be spoofed or replayed, and management fields cannot be set by the public.  
**Business value:** Leads are the commercial output of the platform; today anyone can create arbitrary leads and analytics rows (408 live analytics rows are already operationally untrusted per the audit), poisoning the dashboard and any future smart ranking.

### Repository evidence

- src/collections/Leads.ts:7-12 — create: () => true over the full schema at a broad collection boundary
- src/collections/AnalyticsEvents.ts:5-10 — anonymous create over the full event schema; no idempotency, rate limiting, or server timestamps; authenticated users may update/delete
- Consultation: public.analytics_events reports 408 rows whose counts remain operationally untrusted pending F006; public.leads reports 0 rows
- No rate-limit or body-limit middleware exists on any public route (verified route files)

### Acceptance criteria

- [ ] Public raw create on leads and analytics-events is denied; only the narrow ingestion endpoints accept submissions
- [ ] A fixture journey produces exactly one lead and one conversion; replaying the identical request is idempotent
- [ ] Management fields cannot be set through public ingestion and require the designated sales/admin roles to change
- [ ] Oversized bodies and burst traffic are rejected per configured limits, with tests
- [ ] Dashboard figures reconcile against a rollup/aggregation source

## F007 — Pages draft/version publishing proof (resequenced after homepage)

**Classification:** `not_implemented`  
**User outcome:** Content editors can draft, preview, publish, roll back, and unpublish standalone pages, with anonymous visitors never seeing unpublished work.  
**Business value:** Extends the publishing model proven on the homepage (F013) to generic pages; deliberately resequenced so it cannot delay the primary homepage, and it resolves the live orphan-child question (0 pages rows vs live pages_blocks rows).

### Repository evidence

- src/collections/Pages.ts:69-79 — manual status select and isVisible checkbox instead of Payload versions/drafts; no versions config exists anywhere under src (grep verified)
- src/collections/Pages.ts:30-35 — public read regardless of status
- Consultation [MCP-live-verified]: public.pages reports 0 rows while pages_blocks_hero and pages_blocks_cta each report one row — an orphan/stale-child integrity check is required

### Acceptance criteria

- [ ] A draft page is invisible to anonymous readers on every public path while previewable to an authenticated editor
- [ ] Publish, unpublish, and rollback each behave correctly under tests; version history is retained
- [ ] The versions migration applies cleanly to staging and is reversible; existing published pages remain visible and unchanged
- [ ] The pages orphan-child rows are reconciled (repaired or documented) from exact counts

## F008 — Tenant identity foundation (removed — single GBE site confirmed)

**Classification:** `obsolete_or_duplicate`  
**User outcome:** None — the product is a single GBE platform and main website; no tenant accounts, tenant pages, domains, switching, or isolated dealership workspaces will be built.  
**Business value:** Removing this feature eliminates a critical-risk workstream and unblocks durable media (F009) and homepage publishing (F013) that were previously gated on tenant decisions.

### Repository evidence

- Consultation [MCP-live-verified]: no public tenant table or tenant-named column exists; the tenant/tenants schema lookup returned no tables
- Repository-wide search for tenant models under src returns no matches; src/payload.config.ts:107-123 registers no tenant collection
- docs/product/inputs/HUMAN_PRODUCT_DECISIONS_20260710.md — 'One GBE site, not a multi-tenant dealership platform' with explicit do-not-build list
- docs/product/roadmaps/gbe-platform-roadmap-20260710/BLUEPRINT.json F008 — the prior feature this disposition retires

### Acceptance criteria

- [ ] The roadmap contains no tenant-dependent acceptance criteria, and no tenant schema, membership, host-resolution, or dealership-site-builder work is scheduled or implemented

## F009 — Durable media: Supabase Storage behind the canonical Payload Media service (unblocked)

**Classification:** `not_implemented`  
**User outcome:** Images uploaded through the CMS survive every redeploy and restart, and every new upload lands in exactly one canonical durable location with stable single-site keys.  
**Business value:** Vehicle photos are the core asset; local-filesystem uploads on serverless hosting are silently lost, and the parallel service-role sync script maintains a second write path. The audit found no live incompatibility with Supabase Storage, which is the confirmed direction, and removed the former tenant-decision blocker.

### Repository evidence

- src/collections/Media.ts:28 — upload: true with no storage adapter; src/payload.config.ts:167 — plugins: [] confirms none is configured
- scripts/sync-vehicle-images.mjs:22-24 — out-of-band path using SUPABASE_SERVICE_ROLE_KEY against bucket 'vehicle-images'; :39 gates optional direct vehicle-row updates behind ALLOW_DIRECT_VEHICLE_IMAGE_DB_UPDATE
- Consultation [MCP-live-verified]: Storage reports 1 bucket row and 277 object rows with RLS enabled; bucket identity, visibility, size limits, and MIME restrictions remain unknown pending F002
- @supabase/supabase-js is already a dependency (package.json:34)

### Acceptance criteria

- [ ] A file uploaded through Payload is retrievable byte-identical (hash-compared) after a full redeploy/restart on staging
- [ ] Deleting the Media document removes or tombstones the stored object per the documented lifecycle
- [ ] All new vehicle imagery flows through the canonical Media relationship; no new direct imageUrl/Storage-URL writes occur
- [ ] Object keys follow the documented single-site convention and bucket restrictions match the F002-captured configuration

## F010 — Media reconciliation and legacy image-path retirement

**Classification:** `blocked_by_prerequisite`  
**User outcome:** Every existing vehicle image is accounted for: the 42 Payload media rows, 277 Storage objects, vehicle image relationships, and legacy image columns reconcile to one canonical contract, and the old paths are retired.  
**Business value:** Completes the single-source-of-truth media contract; until reconciliation, the storefront depends on unmanaged legacy URLs the CMS cannot govern, and the true Storage inventory (bucket contents vs Media records) remains unexplained.

### Repository evidence

- src/collections/Vehicles.ts:749-771 — legacy imageUrl/imagePath/imageFilename coexist with the canonical image relationship
- Consultation [MCP-live-verified]: 277 Storage object rows vs 42 Payload media rows are not directly comparable without bucket and relationship aggregates; no orphan conclusion is justified yet
- scripts/sync-vehicle-images.mjs — the legacy population mechanism whose outputs must be reconciled and whose write path must be retired
- src/collections/VehicleMediaAssets.ts — approval/provenance metadata (13 live rows) that the canonical contract must preserve

### Acceptance criteria

- [ ] A reconciliation report accounts for 100% of legacy image values and Storage objects (migrated, already-canonical, or documented-orphan)
- [ ] Public and admin reads resolve imagery through canonical Media relationships only
- [ ] The legacy direct-URL write path (script and columns) is removed or hard-deprecated with a guard
- [ ] The backfill is idempotent with an archived rollback plan

## F011 — Numeric pricing migration and human-reviewed backfill

**Classification:** `not_implemented`  
**User outcome:** Vehicle prices are numeric amounts with a currency: sorting and range filtering are correct, and malformed price text can no longer reach the storefront.  
**Business value:** Price is the primary purchase-decision datum across 1,391 live vehicles; text storage makes price sorts lexicographic and blocks price filters and facets entirely.

### Repository evidence

- src/collections/Vehicles.ts:604-609 — price is type 'text' explicitly accepting numbers or ranges ('398900 or 599000 - 798500')
- Consultation [MCP-live-verified]: price is character varying in the live schema; null/blank/numeric/range/invalid counts are unknown pending F002's aggregate capture
- src/services/publicVehicleCatalog.ts:166-169 — priceAsc/priceDesc sort on the text column today

### Acceptance criteria

- [ ] Every vehicle has priceAmount/currency populated or an explicit documented-null state; the backfill reconciliation report covers all rows against F002's captured quality counts
- [ ] Numeric sorts and range filters return correct order for fixtures including 99,000 vs 100,000-style cases
- [ ] Publish gating requires a valid numeric price; malformed input is rejected at the API with tests
- [ ] The migration is idempotent, staged-tested, reversible, and never run against production during build-plan work

## F012 — Complete public catalog: filters, deterministic sorts, facets, and parameterized collections

**Classification:** `partially_implemented`  
**User outcome:** Storefront shoppers can filter by price and color, sort deterministically (including true numeric price and year ascending), page through facet-counted results, and collection pages honor caller filters.  
**Business value:** The catalog is the storefront's engine; missing filters and silently-fallback smart sorts mean shoppers see misleading orderings today and the Storefront cannot build honest controls against the contract.

### Repository evidence

- src/services/publicVehicleCatalog.ts:79-101 — typed options cover brand/model/year/mileage/body/fuel/etc. but omit price and color
- src/services/publicVehicleCatalog.ts:164-181 — no yearAsc; mostViewed/mostClicked/mostLeads silently map to -createdAt
- src/app/(payload)/api/public/collections/[slug]/route.ts — collection detail accepts only paging, not the catalog filter set
- Consultation: smart analytics sorts remain a competing but misleading path while they silently behave like 'newest'

### Acceptance criteria

- [ ] Price range, color, and yearAsc filters/sorts are accepted and correct across list and collection endpoints, with fixture tests
- [ ] Facet counts match filtered result sets for every filterable dimension
- [ ] Collection detail honors the same filter/sort contract as the list endpoint
- [ ] Smart ranks are removed or backed by trusted rollups per D04 — no silent fallback remains
- [ ] The expanded DTO/contract snapshot is frozen in CI

## F013 — Primary GBE homepage publishing on site_config with legacy home retirement (unblocked, prioritized)

**Classification:** `not_implemented`  
**User outcome:** Editors stage homepage changes as drafts, preview them, and publish deliberately with unpublish and rollback available; the homepage's content, navigation, and media come from the single site_config source of truth; the legacy home content is reconciled and retired.  
**Business value:** The homepage is the confirmed top product priority and the brand's front door; today every save publishes instantly to the live global, and two populated homepage models compete for truth in the live database — a real source-of-truth conflict verified by the audit.

### Repository evidence

- src/components/views/HomeBuilder.tsx:23-33 — saves POST directly to /api/globals/site-config; UI copy at :38 states 'Los cambios se publican al guardar'
- src/globals/SiteConfig.ts:7-23 — the registered global has no versions/drafts and no update access policy; livePreview/preview point at NEXT_PUBLIC_FRONTEND_URL
- src/globals/Home.ts — legacy global exists unregistered (absent from src/payload.config.ts:123) with public read
- Consultation [MCP-live-verified]: both home (1 row, plus home_stats 3 and home_brands 8) and site_config (1 row, plus populated blocks/navigation child tables) contain live rows
- Consultation [MCP-live-verified]: site_config navigation and hero/brands/inventory-search/trust-steps block child tables are populated, so a publishing boundary protects real content
- Old flat site_config columns coexist with the newer general_* fields in the live schema (audit competing-paths list)

### Acceptance criteria

- [ ] Saving homepage sections creates a draft invisible to anonymous consumers; publish is a separate explicit action gated to the D01-designated role
- [ ] Authenticated preview renders the draft; unpublish and rollback restore defined prior states, each covered by tests
- [ ] Concurrent homepage edits are protected: a stale write returns a conflict instead of silently overwriting
- [ ] Legacy home/home_stats/home_brands content is reconciled per D03 with an archived export, the tables are retired, and src/globals/Home.ts is removed
- [ ] Editor UI copy no longer claims save-equals-publish, and homepage content/navigation/media all resolve from site_config through the published boundary

## F014 — Versioned vehicle presentation content (separately gated product decision)

**Classification:** `requires_product_decision`  
**User outcome:** Marketing content for a vehicle's landing page can be drafted, previewed, and rolled back independently of the vehicle's operational inventory state.  
**Business value:** Vehicle detail pages are the conversion surface; coupling content to the live inventory record means every content edit is instantly live and unversioned — but the human decisions doc explicitly states this must not block homepage work and remains an open product choice.

### Repository evidence

- src/collections/Vehicles.ts — landing/presentation fields live on the operational record; no versions config exists on the collection
- src/app/(payload)/api/public/vehicles/preview/[id]/route.ts — authenticated preview of current unversioned data already works
- docs/product/inputs/HUMAN_PRODUCT_DECISIONS_20260710.md — vehicle presentation versioning listed under 'Still requiring a decision'

### Acceptance criteria

- [ ] D07 is resolved and recorded before any schema work
- [ ] If approved: vehicle presentation content supports draft, authenticated preview, publish, and rollback without altering operational inventory state, with a reversible reconciled migration
- [ ] Publish-completeness enforcement continues to hold for the published surface

## F015 — Optimistic concurrency for vehicle workspace and publishing flows

**Classification:** `not_implemented`  
**User outcome:** Two editors working on the same vehicle or the homepage can no longer silently overwrite each other; the second writer gets a conflict with a recovery path.  
**Business value:** Client-side dirty guards protect against accidental navigation but not concurrent sessions or direct API writes — a real data-loss vector as the editing team grows.

### Repository evidence

- src/components/views/VehicleWorkspaceTab.tsx — dirty/publish guards are client-side checks before the request (workspace save guards commit 65ab237); saves carry no expected-version precondition
- src/collections/Vehicles.ts — no server-side stale-write rejection hook exists
- src/components/views/HomeBuilder.tsx:23-33 — homepage saves likewise carry no concurrency precondition (addressed for the homepage inside F013, generalized here)

### Acceptance criteria

- [ ] A two-session stale-write test returns a conflict and preserves the newer revision
- [ ] Direct API writes without the precondition are rejected or explicitly exempted by documented policy
- [ ] The workspace UI surfaces conflicts with a recovery path instead of silent overwrite

## F016 — Admin style architecture isolation (sequenced last among build features)

**Classification:** `partially_implemented`  
**User outcome:** Admin UI styling changes are safe and local: editing one view's styles cannot break another's, and visual regressions are caught automatically.  
**Business value:** The style guard passes today, but a multi-thousand-line global stylesheet with partial guard coverage remains a regression engine taxing every UI change; the audit sequences this after access, homepage, media, and catalog foundations.

### Repository evidence

- src/app/(payload)/custom.scss — the global stylesheet (currently modified in the uncommitted working tree) imported globally for the admin
- scripts/check-admin-styles.mjs — the existing selector-ownership guard wired as npm run check:admin-styles
- No *.module.css/scss files exist under src (glob verified)

### Acceptance criteria

- [ ] Style guard coverage extends to all admin view selector namespaces, passing in CI
- [ ] A measurable, sustained reduction of custom.scss with view styles moved to scoped modules per an agreed per-phase target
- [ ] Browser visual-regression checks pass at supported breakpoints for key admin views
- [ ] No new global selectors are added for new components (enforced by guard or lint rule)

## F017 — Storefront verification release gate at a pinned SHA

**Classification:** `blocked_by_prerequisite`  
**User outcome:** The main GBE website verifiably renders the published homepage, navigation, inventory, media, approved dealership redirects, isolated previews, and deduplicated analytics exactly as the backend contracts define.  
**Business value:** Every storefront-facing contract in this roadmap is currently accepted only on the producer side; the repository root redirects to /admin and the real consumer lives elsewhere, so consumer mismatches would surface in production without this gate.

### Repository evidence

- src/app/(frontend)/page.tsx:4 — the repository root redirects to /admin; the main GBE website is a separate repository absent from this workspace
- src/globals/SiteConfig.ts:13-23 and src/collections/Pages.ts:40-47 — livePreview/preview target NEXT_PUBLIC_FRONTEND_URL, a contract only the Storefront can honor
- Consultation: catalog evidence does not prove deployed Payload routes, Storefront routes, or GraphQL/REST endpoints enforce the intended rules; Storefront verification remains mandatory

### Acceptance criteria

- [ ] The Storefront is captured at an exact SHA and its clean checks pass in the shared gate
- [ ] The published homepage, navigation, and every registered block type render from site_config (unknown blocks degrade safely) under shared fixtures
- [ ] Published inventory, canonical media, and approved dealership external links resolve correctly; drafts and previews are invisible to anonymous visitors
- [ ] A storefront fixture journey produces exactly one lead and reconciled, deduplicated analytics rows
- [ ] Storefront filter/URL state round-trips match the frozen catalog contract
