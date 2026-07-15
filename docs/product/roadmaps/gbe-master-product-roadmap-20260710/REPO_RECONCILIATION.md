# Repository Reconciliation

## F001 — Three-role fail-closed migration (admin/general/sales) replacing the live six-role enum

**Classification:** `partially_implemented`  
**User outcome:** Administrators trust that only the three explicitly granted business roles confer access: an account with a missing, null, stale, or invalid role can do nothing privileged, and every guard speaks the approved role language.  
**Business value:** Closes the highest-leverage security hole — every guard currently fails open to admin for roleless authenticated users — and aligns the entire authorization layer with the confirmed three-role product model before any other feature builds on it.

### Repository evidence

- src/access/roles.ts:31-40 — getRoles returns ['admin'] for any authenticated user with no role ('Users without any role behave as admins')
- src/access/roles.ts:12-27 — the code role set is the legacy six roles, matching the MCP-live-verified live enum which has neither 'general' nor 'sales'
- src/services/cmsRequestAuth.ts:40 — requireCmsRole delegates to hasRole and inherits the fail-open fallback across all custom CMS routes, including import run, workshop generate, media review, and invite
- src/collections/Users.ts:44-56 — role select defaults to 'viewer' (not a valid target role) with admin-only field access
- docs/product/inputs/SUPABASE_LIVE_READONLY_AUDIT_20260710_VERIFIED.md — live enum is exactly the six legacy roles; 3 user rows; per-user values unknown pending D02/D06

### Acceptance criteria

- [ ] The live role enum contains exactly admin, general, and sales; every user row holds exactly one valid target role per the signed-off D02 mapping; the migration is idempotent, staged-tested, and aborts on unmapped users
- [ ] getRoles resolves missing/null/blank/invalid roles to no roles — never admin — and anonymous access remains denied; 'viewer' no longer exists as a default or option
- [ ] Every guard, field access rule, custom route, and admin UI option references only the three target roles per the D01 matrix; no reference to the six legacy roles remains in src
- [ ] Security tests prove 401/403 for anonymous, roleless, and invalid-role fixtures on invite, vehicle-specs, import, workshop, media review, and preview endpoints, and the documented allow/deny matrix passes per role in CI
- [ ] A pre-migration user export and rollback procedure are archived; the migration never runs against production during blueprint/build work

## F002 — Operations truth capture — complete the blocked read-only live facts

**Classification:** `partially_implemented`  
**User outcome:** The team plans migrations from verified facts — Postgres version, sizes, policies, grants, privileged functions, Storage bucket restrictions, role distribution, and content-quality aggregates — instead of estimates and unknowns.  
**Business value:** Every data migration in this roadmap (roles, price, media, homepage reconciliation) mutates live business data; the audit verified schema shape, enums, advisors, and row estimates via MCP but every execute_sql was cancelled, so the exact aggregates that gate F001, F009-F011, and F013 remain unknown. Per the consultation, this blocks only migrations that require its outputs — never clean-repository CI, source pinning, documentation, design-system inventory, or Storefront baseline capture.

### Repository evidence

- docs/product/inputs/SUPABASE_LIVE_READONLY_AUDIT_20260710_VERIFIED.md — MCP-01..MCP-12 succeeded (tables, extensions, migrations, advisors, generated types) while MCP-13..MCP-20 (all SQL) were cancelled before execution; gate result 'Partially captured; F002 remains open'
- The audit ships the exact read-only capture transactions: version/sizes/forced-RLS, policies/grants/views/SECURITY DEFINER, Storage bucket aggregate, and roles/content aggregates (sections 'Unknowns and safe manual captures')
- src/migrations contains 15 registered migration modules versus 17 live payload_migrations rows — a safe name-only capture must reconcile before migration planning

### Acceptance criteria

- [ ] Archived, timestamped read-only outputs exist for: server version, per-object sizes and forced-RLS state, policy inventory, API-role grants, views/materialized views, SECURITY DEFINER functions, Storage bucket identity/visibility/limits/aggregates, user role distribution, vehicle price/image/status aggregates, dealership/pages/site_config/media/leads/analytics aggregates, and a name-only payload_migrations reconciliation
- [ ] No mutation, RPC, identity read, object-name read, or secret read occurred during capture
- [ ] The pages orphan-child question (0 parent rows vs 1 row each in pages_blocks_hero and pages_blocks_cta) is resolved with exact counts and foreign-key state
- [ ] F002's gate flips to passed in a dated addendum, and D02's mapping review is scheduled from the role-distribution output

## F003 — Expanded security-test harness on the baseline CI

**Classification:** `not_implemented`  
**User outcome:** Every security-relevant change is proven by required CI checks: role/permission fixtures, negative REST/GraphQL/Local API/custom-route tests, and allow/deny matrix runs execute on every push.  
**Business value:** The baseline CI slice (F018) makes builds reproducible; this feature makes the fail-closed authorization model a permanent regression gate so the three-role proof, boundary contracts, and ingestion rules cannot silently reopen.

### Repository evidence

- No .github/workflows directory exists and no test framework is installed (no vitest/jest/playwright in package.json dependencies)
- package.json scripts contain build/lint/migrate/seed/smoke entries but no test or typecheck script; scripts/production-e2e-smoke.ts targets production, not an ephemeral CI database
- scripts/check-admin-styles.mjs is the one wired quality guard (npm run check:admin-styles)

### Acceptance criteria

- [ ] The F001 allow/deny matrix and negative-path suites run as required CI checks on Node 22 and pass on a clean checkout
- [ ] Security tests never touch the production database; their target is ephemeral or explicitly authorized staging
- [ ] CI artifacts (logs, reports, build output) are retained and linkable
- [ ] Documentation states what CI does and does not prove (no browser coverage, no Storefront verification yet)

## F004 — Vehicle raw/public/preview boundary contracts under the three-role model

**Classification:** `partially_implemented`  
**User outcome:** Anonymous visitors see exactly the published, non-sold, approved-media vehicle data intended for the storefront — and nothing else — through frozen, tested DTO contracts; staff preview works only for permitted target roles.  
**Business value:** Locks in the existing hardening with regression proof so the vehicle boundary cannot silently reopen, gives the Storefront a stable contract, and reconciles the duplicate status/image paths the live audit confirmed.

### Repository evidence

- src/collections/Vehicles.ts:243-247 — raw reads require authentication; mutations require inventory roles
- src/services/publicVehicleCatalog.ts — bounded public DTO service enforcing published/non-sold serialization for routes under src/app/(payload)/api/public/vehicles/
- src/app/(payload)/api/public/vehicles/preview/[id]/route.ts:12-16 — preview requires requireCmsRole but names legacy roles inventory_manager/content_editor
- src/app/(payload)/api/[...slug]/route.ts:14-19 and src/app/(payload)/api/graphql/route.ts — raw REST and GraphQL remain mounted, so the boundary rests on per-collection access rules only tests keep honest
- src/collections/Vehicles.ts:620-643,749-771 — overlapping inventoryStatus/publishStatus and legacy image fields; live DB additionally carries legacy 'status' and Payload '_status' columns (MCP-live-verified)

### Acceptance criteria

- [ ] Anonymous requests to raw REST and GraphQL for vehicles, vehicle-collections, and vehicle-media-assets are denied, with tests
- [ ] Public list/detail/collection/preview DTO snapshots are frozen and any field change fails CI
- [ ] Unpublished, sold, and unapproved-media content is proven absent from every public path
- [ ] Preview endpoints deny anonymous and roleless users and succeed only for the D01-designated roles
- [ ] The canonical status fields are documented and the legacy status/_status duplication has a written reconciliation plan

## F005 — Content and reference access closure with a safe public dealership DTO

**Classification:** `partially_implemented`  
**User outcome:** Internal operational data — dealership internal notes and staff names, site configuration writes, page mutations — is readable and writable only by roles that need it, while the storefront gets a bounded dealership DTO including an approved external website link.  
**Business value:** Closes the remaining always-true and Payload-default boundaries, eliminates public exposure of person-related internal fields, and creates the approved external-URL capability the confirmed product model requires for optional off-site routing.

### Repository evidence

- src/collections/Dealerships.ts:5-7 — access declares only read: () => true; create/update/delete fall to Payload defaults; internalNotes (:57-63), salesRepName (:55), and email (:35) are publicly readable
- src/collections/Dealerships.ts — no external website URL field exists anywhere in the collection (MCP-live-verified: no external-site URL column)
- src/globals/SiteConfig.ts:10-12 — only read: () => true; no update access declaration
- src/collections/Pages.ts:30-35 — public read over all fields regardless of the manual status field
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
**Business value:** Leads are the commercial output of the platform; today anyone can create arbitrary leads and analytics rows (408 live analytics rows already operationally untrusted per the audit), poisoning dashboards and any future ranking or reporting.

### Repository evidence

- src/collections/Leads.ts:7-12 — create: () => true over the full schema at a broad collection boundary; no hooks, no dedup, no server-owned timestamps
- src/collections/AnalyticsEvents.ts:5-10 — anonymous create over the full event schema; no idempotency, rate limiting, or server timestamps; authenticated users may update/delete
- No custom ingestion route exists: src/app/(payload)/api/public/ contains only collections/ and vehicles/ routes — ingestion relies entirely on default Payload REST endpoints
- No rate-limit or body-limit middleware exists anywhere (no middleware.ts; zero rate-limit matches in src)

### Acceptance criteria

- [ ] Public raw create on leads and analytics-events is denied; only the narrow ingestion endpoints accept submissions
- [ ] A fixture journey produces exactly one lead and one conversion; replaying the identical request is idempotent
- [ ] Management fields cannot be set through public ingestion and require the designated sales/admin roles to change
- [ ] Oversized bodies and burst traffic are rejected per configured limits, with tests
- [ ] Dashboard figures reconcile against a rollup/aggregation source

## F007 — Generic Pages draft/version publishing (after the homepage proof)

**Classification:** `not_implemented`  
**User outcome:** Content editors can draft, preview, publish, roll back, and unpublish standalone pages, with anonymous visitors never seeing unpublished work.  
**Business value:** Extends the publishing model proven on the homepage (F013) to generic pages, deliberately resequenced so it cannot delay the primary homepage, and resolves the live orphan-child question (0 pages rows vs live pages_blocks rows).

### Repository evidence

- src/collections/Pages.ts:69-79 — manual status select and isVisible checkbox instead of Payload versions/drafts; no versions config exists anywhere under src
- src/collections/Pages.ts:30-35 — public read regardless of status
- src/components/views/LandingBuilder.tsx — Pages CRUD and section building run through the raw pages collection with slug/SEO settings but no draft boundary
- MCP-live-verified: public.pages reports 0 rows while pages_blocks_hero and pages_blocks_cta each report one row — an orphan/stale-child integrity check is required

### Acceptance criteria

- [ ] A draft page is invisible to anonymous readers on every public path while previewable to an authenticated editor
- [ ] Publish, unpublish, and rollback each behave correctly under tests; version history is retained
- [ ] The versions migration applies cleanly to staging and is reversible; existing published pages remain visible and unchanged
- [ ] The pages orphan-child rows are reconciled (repaired or documented) from exact counts

## F009 — Durable media: Supabase Storage behind the canonical Payload Media service

**Classification:** `not_implemented`  
**User outcome:** Images uploaded through the CMS survive every redeploy and restart, and every new upload lands in exactly one canonical durable location with stable single-site keys.  
**Business value:** Vehicle photos are the core asset; local-filesystem uploads on serverless hosting are silently lost, and the parallel service-role sync script maintains a second write path. The audit found no live incompatibility with Supabase Storage, the confirmed direction. Durable media is a hard dependency of public launch acceptance.

### Repository evidence

- src/collections/Media.ts:28 — upload: true with no storage adapter; src/payload.config.ts — plugins: [] confirms none is configured
- scripts/sync-vehicle-images.mjs:22-24 — out-of-band path using SUPABASE_SERVICE_ROLE_KEY against bucket 'vehicle-images'; :39 gates optional direct vehicle-row updates behind ALLOW_DIRECT_VEHICLE_IMAGE_DB_UPDATE
- MCP-live-verified: Storage reports 1 bucket row and 277 object rows with RLS enabled; bucket identity, visibility, size limits, and MIME restrictions remain unknown pending F002
- @supabase/supabase-js is already a dependency (package.json)

### Acceptance criteria

- [ ] A file uploaded through Payload is retrievable byte-identical (hash-compared) after a full redeploy/restart on staging
- [ ] Deleting the Media document removes or tombstones the stored object per the documented lifecycle
- [ ] All new vehicle imagery flows through the canonical Media relationship; no new direct imageUrl/Storage-URL writes occur
- [ ] Object keys follow the documented single-site convention and bucket restrictions match the F002-captured configuration

## F010 — Media reconciliation and legacy image-path retirement

**Classification:** `blocked_by_prerequisite`  
**User outcome:** Every existing vehicle image is accounted for: the 42 Payload media rows, 277 Storage objects, vehicle image relationships, and legacy image columns reconcile to one canonical contract, and the old paths are retired.  
**Business value:** Completes the single-source-of-truth media contract; until reconciliation, the storefront depends on unmanaged legacy URLs the CMS cannot govern. Legacy reconciliation is a dependency of any public launch that consumes existing images.

### Repository evidence

- src/collections/Vehicles.ts:749-771 — legacy imageUrl/imagePath/imageFilename coexist with the canonical image relationship
- MCP-live-verified: 277 Storage object rows vs 42 Payload media rows are not directly comparable without bucket and relationship aggregates; no orphan conclusion is justified yet
- scripts/sync-vehicle-images.mjs — the legacy population mechanism whose outputs must be reconciled and whose write path must be retired
- src/collections/VehicleMediaAssets.ts — approval/provenance metadata the canonical contract must preserve

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

- src/collections/Vehicles.ts:604-609 — price is type 'text' explicitly accepting numbers or ranges
- MCP-live-verified: price is character varying in the live schema; null/blank/numeric/range/invalid counts are unknown pending F002
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

### Acceptance criteria

- [ ] Price range, color, and yearAsc filters/sorts are accepted and correct across list and collection endpoints, with fixture tests
- [ ] Facet counts match filtered result sets for every filterable dimension
- [ ] Collection detail honors the same filter/sort contract as the list endpoint
- [ ] Smart ranks are removed from the public contract with no silent fallback remaining; their restoration is explicitly gated on F036 trusted rollups
- [ ] The expanded DTO/contract snapshot is frozen in CI

## F013 — Primary GBE homepage publishing on site_config with legacy home retirement

**Classification:** `not_implemented`  
**User outcome:** Editors stage homepage changes as drafts, preview them, and publish deliberately with unpublish and rollback available; the homepage's content, navigation, and media come from the single site_config source of truth; the legacy home content is reconciled and retired.  
**Business value:** The homepage is the confirmed top customer-facing priority; today every save publishes instantly to the live global, and two populated homepage models compete for truth in the live database — a real source-of-truth conflict verified by the audit.

### Repository evidence

- src/components/views/HomeBuilder.tsx:23-33 — saves POST directly to /api/globals/site-config; UI copy at :38 states 'Los cambios se publican al guardar'
- src/globals/SiteConfig.ts:7-23 — the registered global has no versions/drafts and no update access policy; livePreview/preview point at NEXT_PUBLIC_FRONTEND_URL
- src/globals/Home.ts — legacy global exists unregistered with public read
- MCP-live-verified: both home (1 row, plus home_stats 3 and home_brands 8) and site_config (1 row, plus populated blocks/navigation child tables) contain live rows

### Acceptance criteria

- [ ] Saving homepage sections creates a draft invisible to anonymous consumers; publish is a separate explicit action gated to the D01-designated role
- [ ] Authenticated preview renders the draft; unpublish and rollback restore defined prior states, each covered by tests
- [ ] Concurrent homepage edits are protected: a stale write returns a conflict instead of silently overwriting
- [ ] Legacy home/home_stats/home_brands content is reconciled per D03 with an archived export, the tables are retired, and src/globals/Home.ts is removed
- [ ] Editor UI copy no longer claims save-equals-publish, and homepage content/navigation/media all resolve from site_config through the published boundary

## F014 — Safe versioned vehicle presentation editing (required; model shape per D07)

**Classification:** `requires_product_decision`  
**User outcome:** Marketing content for a vehicle's landing page can be drafted, previewed, published, and rolled back independently of the vehicle's operational inventory state.  
**Business value:** Vehicle detail pages are the conversion surface; coupling content to the live inventory record means every content edit is instantly live and unversioned. Per the consultation this capability is required — leaving vehicle content editing unsafe is not an acceptable final outcome; only the storage/versioning shape (separate versioned related model preferred) remains open under D07.

### Repository evidence

- src/collections/Vehicles.ts — landing/presentation fields live on the operational record; no versions config exists on the collection
- src/components/views/VehicleWorkspaceTab.tsx — the vehicle workspace edits landing sections directly against the live record
- src/app/(frontend)/vehicle-preview/[id]/page.tsx — authenticated preview of current unversioned data already works, gated by legacy role names
- docs/product/inputs/MASTER_PRODUCT_ROADMAP_CONSULTATION_20260710.md section 4.D — 'Safe vehicle presentation editing is required; the open decision is whether it lives in a separate versioned related model or on Vehicles, with separation preferred'

### Acceptance criteria

- [ ] D07 is resolved and recorded before any schema work
- [ ] Vehicle presentation content supports draft, authenticated preview, publish, and rollback without altering operational inventory state, with a reversible reconciled migration
- [ ] Publish-completeness enforcement continues to hold for the published surface
- [ ] Anonymous visitors never see unpublished presentation content on any public path

## F015 — Optimistic concurrency for vehicle workspace and publishing flows

**Classification:** `not_implemented`  
**User outcome:** Two editors working on the same vehicle or the homepage can no longer silently overwrite each other; the second writer gets a conflict with a recovery path.  
**Business value:** Client-side dirty guards protect against accidental navigation but not concurrent sessions or direct API writes — a real data-loss vector as the editing team grows.

### Repository evidence

- src/components/views/VehicleWorkspaceTab.tsx — dirty/publish guards are client-side checks before the request; saves carry no expected-version precondition
- src/collections/Vehicles.ts — no server-side stale-write rejection hook exists
- src/components/views/HomeBuilder.tsx:23-33 — homepage saves likewise carry no concurrency precondition (addressed for the homepage inside F013, generalized here)

### Acceptance criteria

- [ ] A two-session stale-write test returns a conflict and preserves the newer revision
- [ ] Direct API writes without the precondition are rejected or explicitly exempted by documented policy
- [ ] The workspace UI surfaces conflicts with a recovery path instead of silent overwrite

## F016 — Interim admin style containment inside Payload (destination is the operator console)

**Classification:** `partially_implemented`  
**User outcome:** While workflows still live inside Payload Admin, styling changes are safe and local: editing one view's styles cannot break another's, and the style guard holds the line until each workflow migrates to the operator console.  
**Business value:** The 8,722-line global stylesheet is a regression engine taxing every UI change. Per the consultation, CSS modules inside Payload are interim containment, not the destination architecture — the dedicated operator console (F026/F027) is the target; this feature keeps the interim period safe without over-investing in a surface being replaced.

### Repository evidence

- src/app/(payload)/custom.scss — 8,722 lines styling dashboards, nav, builders, inventory, workspace, modals, and the admin-kit-* design-system classes (currently modified in the uncommitted working tree)
- scripts/check-admin-styles.mjs — the existing selector-ownership guard wired as npm run check:admin-styles
- No *.module.css/scss files exist under src (glob verified)

### Acceptance criteria

- [ ] Style guard coverage extends to all admin view selector namespaces, passing in CI
- [ ] No new global selectors are added for new components (enforced by guard or lint rule)
- [ ] custom.scss stops growing and each section is deleted as its workflow migrates to the operator console, tracked in a containment ledger
- [ ] Browser visual-regression checks pass at supported breakpoints for the admin views that remain inside Payload

## F017 — Cross-repository release gate: Storefront verification at the pinned SHA with durable-media launch dependencies

**Classification:** `blocked_by_prerequisite`  
**User outcome:** The main GBE website verifiably renders the published homepage, navigation, inventory, canonical durable media, approved dealership redirects, isolated previews, and deduplicated analytics exactly as the backend contracts define — before public acceptance.  
**Business value:** Every storefront-facing contract is currently accepted only on the producer side; the real consumer lives in a separate repository. Per the consultation, this final gate must additionally depend on canonical durable media (F009) and, where existing images are consumed, legacy reconciliation (F010) — separating 'builder mechanics complete' from 'launch-ready'.

### Repository evidence

- src/app/(frontend)/page.tsx:4 — the repository root redirects to /admin; the main GBE website is a separate repository absent from this workspace
- src/globals/SiteConfig.ts:13-23 and src/collections/Pages.ts:40-47 — livePreview/preview target NEXT_PUBLIC_FRONTEND_URL, a contract only the Storefront can honor
- docs/product/inputs/MASTER_PRODUCT_ROADMAP_CONSULTATION_20260710.md section 3.4 — 'The final Storefront release gate must depend on canonical durable media and, where existing images are consumed, legacy reconciliation'

### Acceptance criteria

- [ ] The Storefront is captured at an exact SHA and its clean checks pass in the shared gate
- [ ] The published homepage, navigation, and every registered block type render from site_config (unknown blocks degrade safely) under shared fixtures
- [ ] Published inventory, canonical durable media (with an explicit storage durability check), and approved dealership external links resolve correctly; drafts and previews are invisible to anonymous visitors
- [ ] A storefront fixture journey produces exactly one lead and reconciled, deduplicated analytics rows
- [ ] Storefront filter/URL state round-trips match the frozen catalog contract
- [ ] Release ownership, abort thresholds, rollback triggers, and evidence paths are documented and exercised

## F018 — Pinned clean baselines and Node 22 baseline CI slice (before the role migration)

**Classification:** `not_implemented`  
**User outcome:** Every developer and reviewer works from pinned, reproducible Admin and Storefront baselines, and every change is proven by a clean Node 22 pipeline — install, style guard, typecheck, lint, build, migration/static checks, and a minimal test runner — before the critical role migration is attempted.  
**Business value:** No CI, test framework, or typecheck script exists, and the working tree carries uncommitted and untracked changes, so no acceptance criterion in this roadmap is mechanically enforceable and the source baseline is not reproducible. The consultation's first sequencing correction requires this baseline slice before F001 so the highest-risk migration is developed inside a reproducible harness, not before one exists.

### Repository evidence

- No .github directory exists at all — no CI workflows (verified live)
- package.json — scripts contain build/lint/migrate/seed/smoke but no test or typecheck entry; engines pin node 22.x; no vitest/jest/playwright installed
- git status at inspection: uncommitted modifications (.claude/launch.json, src/app/(frontend)/vehicle-preview/[id]/page.tsx, src/app/(payload)/custom.scss, src/components/PrismaCMSLogo.tsx) plus untracked review artifacts, run scripts, docs/product/, scripts/sanity-format-mileage.mjs, and src/utils/
- scripts/check-admin-styles.mjs — the one existing quality guard, wired as npm run check:admin-styles
- tsconfig.json exists but tsc runs only implicitly inside next build; no standalone typecheck

### Acceptance criteria

- [ ] Every currently dirty or untracked file is deliberately committed, exported, or discarded with the disposition recorded; the pinned Admin SHA and lockfile hash are documented
- [ ] A clean checkout at the pinned SHA on Node 22 runs install, style guard, typecheck (tsc --noEmit), lint, production build, migration/static checks, and the minimal test runner as required CI checks, all passing
- [ ] The pipeline runs on every push/PR with retained artifacts
- [ ] No step in the baseline slice depends on F002's blocked captures or the role migration

## F019 — Staging environment, backup/restore, and migration-rehearsal infrastructure

**Classification:** `not_implemented`  
**User outcome:** Every risky migration (roles, price, media, homepage retirement) is rehearsed against a staging database and storage with proven backup/restore, documented abort thresholds, rollback triggers, evidence paths, and named release ownership before it can touch live data.  
**Business value:** The database is live production Supabase data (1,391 vehicles); the only smoke script targets production and no staging, backup/restore, or rehearsal path exists in the repository. Without this infrastructure, every migration in the roadmap carries unbounded blast radius.

### Repository evidence

- scripts/production-e2e-smoke.ts — the only end-to-end script targets production, not an ephemeral or staging environment
- No staging configuration, backup/restore script, rehearsal runbook, or environment mapping exists anywhere in the repository (verified by script and docs inventory)
- docs/product/inputs/SUPABASE_LIVE_READONLY_AUDIT_20260710_VERIFIED.md — the live project holds the production business data every roadmap migration would mutate

### Acceptance criteria

- [ ] A staging database and storage bucket exist with a documented, sanitized seeding procedure
- [ ] A backup is taken and a full restore is executed and verified at least once, with the procedure archived
- [ ] A migration-rehearsal runbook exists with abort thresholds, rollback triggers, evidence paths, and named release-ownership placeholders, and is exercised by at least one real rehearsal
- [ ] CI security and durability suites target staging or ephemeral infrastructure, never production

## F020 — Early Storefront baseline capture and shared contract/block drift checks

**Classification:** `requires_product_decision`  
**User outcome:** The team knows exactly what the live Storefront consumes today — routes, DTO fields, block types, analytics calls — and any drift between Admin contracts and Storefront expectations fails a check long before the final release gate.  
**Business value:** All Storefront conclusions are currently carried forward, not verified, and contract changes in F004/F012/F013 could break the live website invisibly. Capturing the baseline early (explicitly not blocked by F002) converts the final gate from a discovery event into a confirmation event.

### Repository evidence

- src/app/(frontend)/page.tsx:4 — the repository root redirects to /admin; the Storefront consumer is absent from this workspace
- src/services/publicVehicleCatalog.ts — PublicVehicleCard/PublicVehicleDetail/PublicLandingBlock types exist only in this repository with no consumer-side check
- src/blocks/SiteSections.ts — 14 homepage block types are defined with no drift check against any renderer registry
- docs/product/inputs/MASTER_PRODUCT_ROADMAP_CONSULTATION_20260710.md section 3.2 — Storefront baseline capture must not be blocked by the incomplete F002 capture

### Acceptance criteria

- [ ] The Storefront repository is captured at the D05-pinned SHA with its clean check status and lockfile hash recorded
- [ ] An inventory exists of every route, DTO field, block type, and analytics event the Storefront consumes from this backend
- [ ] A drift check runs in CI and fails when an Admin contract change breaks a consumed field or block
- [ ] The capture is archived and referenced as the baseline for F028/F029 scoping and the F017 release gate

## F021 — Authentication operations: login, reset, staged email, invites, and break-glass recovery

**Classification:** `partially_implemented`  
**User outcome:** Staff can reliably sign in and out, recover passwords through emails that verifiably deliver, accept invites that grant exactly the intended role, and an administrator lockout has a tested break-glass recovery path.  
**Business value:** Auth today is Payload defaults with a thin invite route: email delivery silently disables when SMTP env vars are absent, invite acceptance rides the reset-password flow, nothing rate-limits auth endpoints, and no recovery procedure exists — operationally fragile for the exact accounts the three-role model protects.

### Repository evidence

- src/collections/Users.ts:32 — auth: true with no options object: Payload default sessions, no maxLoginAttempts/lockTime/tokenExpiration configuration
- src/payload.config.ts:129-143 — nodemailerAdapter wired only when SMTP_HOST/FROM_EMAIL/PASS/USER are all present (hasSMTPConfig :29-35); otherwise email is undefined and forgotPassword/invite emails silently do not send
- src/app/(payload)/api/users/invite/route.ts:29-73 — admin-only invite creates a user with a temporary password then calls payload.forgotPassword to email a set-password link; duplicate emails re-send the reset
- No custom invite-acceptance page exists; users complete setup via Payload's built-in reset screen; no rate limiting exists on any auth route (no middleware.ts, zero rate-limit matches in src)

### Acceptance criteria

- [ ] Login, logout, session expiration, and login-attempt lockout behave per configured policy, with tests
- [ ] Password reset request, completion, and token expiration work end-to-end with staged email delivery verified by a delivery check; missing SMTP configuration fails loudly, not silently
- [ ] Invite creation and acceptance grant exactly the intended target role; a non-admin cannot invite; tests prove privilege enforcement
- [ ] A break-glass administrator recovery procedure is documented and rehearsed at least once on staging
- [ ] Auth endpoints are rate-limited and the limits are covered by tests

## F022 — Rate limits, request limits, idempotency, and auditability for cost-bearing and commercial endpoints

**Classification:** `not_implemented`  
**User outcome:** Cost-bearing operations (AI generation, provider image search, imports) and commercial endpoints (leads, analytics, invites) cannot be abused by burst traffic, replays, or oversized payloads, and every privileged invocation is auditable.  
**Business value:** No rate limiting exists anywhere in the application — the AI generation endpoint, CarsXE search, import run, invite, and public ingestion all rely on session/role checks alone. Once the AI studio flag turns on, an unthrottled paid-provider endpoint is a direct financial exposure; per the AGIREAL rules, rate limiting must fail closed for protected operations.

### Repository evidence

- No middleware.ts exists and zero rate-limit/429/too-many-requests matches exist anywhere in src (verified by repository-wide search)
- src/app/(payload)/api/cms/workshop/generate/route.ts — the paid OpenRouter call has no rate limit, request cap, timeout, or idempotency key; only requireCmsRole plus the env flag gate it
- src/app/(payload)/api/cms/vehicle-photos/route.ts:43-44 — the only throttling-adjacent control in the app is a CarsXE search cache with a 7-day TTL
- docs/product/inputs/AGIREAL_REUSE_MATRIX.md rule 8 — rate limiting must fail closed for protected/cost-bearing operations; permissive fallbacks are unacceptable

### Acceptance criteria

- [ ] Burst traffic against cost-bearing and commercial endpoints is rejected per configured limits, with tests; limits fail closed when the backing store is unavailable
- [ ] Replaying an identical cost-bearing or state-creating request is a no-op proven by idempotency tests
- [ ] Oversized request bodies are rejected per route caps
- [ ] Privileged and cost-bearing invocations produce audit records binding actor, route, key, and outcome

## F023 — Governed import pipeline: dry run, human approval, idempotency, rollback, and ~1,400-row scale proof

**Classification:** `partially_implemented`  
**User outcome:** Operators import CSV/XLSX inventory through mapping and normalization into a dry-run report they approve before anything commits; commits are idempotent, row errors are actionable, and a completed import can be rolled back.  
**Business value:** The existing pipeline is commit-only: parsing happens client-side, normalization and duplicate detection run inline at commit time, the declared validating/ready/rolled_back job states are never written, and no approval, idempotency, or rollback path exists — at the ~1,400-vehicle operating scale a bad file mutates live inventory with no undo.

### Repository evidence

- src/app/(payload)/api/cms/import/run/route.ts — the sole import endpoint commits in one pass: normalize (:97-166), duplicate detection by sourceId/stockId (:110-121), draft vehicle creation (:131-137); no dry-run mode, approval gate, idempotency key, or rollback endpoint exists
- src/collections/ImportJobs.ts:42-55 — statuses validating/ready/rolled_back are declared but never written by any code; :82-87 createdVehicleIds is stored 'para revisar o revertir' but no rollback code exists
- src/components/admin-ui/VehicleImportModal.tsx:44-118 — CSV parsed by a hand-rolled client-side parser and XLSX via xlsx sheet_to_json; results shown only post-commit; csv-parse is declared in package.json but unused
- src/services/importNormalize.ts — normalization and header-mapping helpers exist and are reusable (WORKBOOK_COLUMN_MAP :151-165, normalizeImportRow :197-257, suggestFieldForHeader :262-294)

### Acceptance criteria

- [ ] A dry run produces a persisted report (creates, updates, skips, row errors, duplicates) with zero database mutations, and the job reaches ready without touching vehicles
- [ ] Commit requires an explicit approval bound to the reviewed job; unapproved jobs cannot commit; the approval records the actor
- [ ] Re-submitting the same commit request is a no-op under the idempotency key
- [ ] Rolling back a completed import removes or reverts exactly the rows it created/updated, proven by tests
- [ ] A full ~1,400-row import completes on staging within documented duration/memory bounds with accurate counts
- [ ] Row-level errors identify the row, field, and reason, and error rows never partially commit

## F024 — Inventory operations: review queues, image association approval, completeness, lifecycle, aging, and exposure signals

**Classification:** `partially_implemented`  
**User outcome:** Operators run inventory as a workflow: incoming vehicles queue for review with completeness scores, images are associated and approved, publish/unpublish follows the lifecycle, and aging plus exposure signals show which vehicles need attention.  
**Business value:** Inventory is the operational spine of the platform even though the homepage is the first public priority. Completeness scoring, publish gating, and a media review pipeline already exist; what is missing is the queue tying imports to review, and any aging or exposure signal — so stale or underexposed vehicles are invisible today.

### Repository evidence

- src/collections/Vehicles.ts:687-697 — completenessScore computed on save via calculateVehicleCompleteness (src/services/vehicleWorkflow.ts:89-107); publish gating via getVehiclePublishIssues (:358-363; vehicleWorkflow.ts:178-236)
- src/collections/Vehicles.ts:257-270 — publishStatus transitions stamp publishedAt/lastPublishedBy and lastReviewedAt/lastReviewedBy
- src/components/views/InventoryManager.tsx:175-176,494-495,704-706 — client-side triage snapshot (QUEUE_LIMIT 1000) with completeness sorting and bars; no queue keyed to a specific import job
- No aging or exposure fields exist anywhere in src (zero matches for aging/exposure); the only lifecycle timestamps are publishedAt/lastReviewedAt/createdAt
- src/app/(payload)/api/cms/vehicle-media-assets/review/route.ts and assign/route.ts — reviewer-gated image approval and hero/gallery assignment already enforced server-side

### Acceptance criteria

- [ ] A review queue lists vehicles by import job and needs_review status with completeness scores, and reviewing a queue entry updates the lifecycle fields
- [ ] Image association and approval continue to flow exclusively through the reviewer-gated vehicle-media-assets pipeline, with tests
- [ ] Vehicles carry aging data (listing date and derived days-in-stock) surfaced in the queue and operations dashboard
- [ ] Exposure signals appear only when backed by F036 trusted rollups, with an explicit empty/placeholder state before that
- [ ] Publish/unpublish lifecycle transitions are covered by tests including the completeness publish gate

## F025 — Builder V2: versioned block registry and the complete editor contract

**Classification:** `partially_implemented`  
**User outcome:** Editors compose the homepage (and later pages and vehicle presentation) from one versioned block library with persisted hide/show and ordering, duplicate/delete, responsive mobile/tablet/desktop preview, reusable sections/templates, media selection, SEO fields, and per-block analytics identity — and unknown blocks degrade safely everywhere.  
**Business value:** The current builder has real foundations (14 block types, a 1,218-line SectionBuilder engine, schema-sync migrations) but no versioned registry contract: block schemas, editor libraries, and Storefront renderer expectations are maintained by hand in parallel, there is no analytics identity, no reusable templates, no SEO surface on the homepage flow, and no defined unknown-block behavior — every block change risks silent divergence from the consumer.

### Repository evidence

- src/blocks/SiteSections.ts — 14 block types (hero, promoStrip, featuredVehicles, inventoryCollection, inventorySearch, cityInventory, promoBanner, trustSteps, testimonials, videoTips, brands, agencies, mediaText, cta) wired into SiteConfig home.sections
- src/components/admin-ui/SectionBuilder.tsx (1,218 lines) and sectionLibraries.ts — the visual builder engine and a hand-maintained mirror of the Payload block schemas
- src/migrations/20260521_060610_site_builder_schema.ts and 20260610_130000_p3_page_home_block_schema_sync.ts — block schema changes handled as ad-hoc SQL migrations with no registry versioning
- No analytics identity, reusable template, or unknown-block handling exists in the block definitions or serializers (src/services/publicVehicleCatalog.ts serializes only the five vehicle-landing block types)
- src/components/views/VehicleTemplateBuilder.tsx — template visibility toggles exist for seminuevos/vehicleDetail but not reusable content sections

### Acceptance criteria

- [ ] One versioned block registry is the single source generating editor library, preview, renderer expectations, migrations, analytics identity, and fixtures — a block added or changed in one place propagates or fails CI
- [ ] Hide/show state, ordering, and duplicate/delete persist through the draft/publish cycle
- [ ] Responsive mobile/tablet/desktop preview renders each registered block at the builder's breakpoints
- [ ] Reusable sections/templates can be saved, inserted, and edited; media selection uses canonical Media only
- [ ] SEO fields exist and render as metadata on the published surface
- [ ] Every block emits page/block/placement analytics identity, and unknown block types degrade safely in both editor and renderer, with fixture tests

## F026 — Dedicated operator console shell with a product-owned design system

**Classification:** `not_implemented`  
**User outcome:** Dealers and operators work in a purpose-built product surface — its own navigation, search/commands, breadcrumbs, and notifications, with complete loading/empty/error/degraded-provider/permission-denied states, responsive layout, keyboard support, and accessibility — outside the Payload Admin layout and its global CSS.  
**Business value:** The dealer workflow is currently an application embedded in a CMS admin shell: every operator view is a Payload custom view styled by one 8,722-line global stylesheet. The consultation designates an isolated route/app shell with a product-owned design system as the destination architecture, with CSS modules inside Payload only interim containment.

### Repository evidence

- src/payload.config.ts:59-104 — all operator surfaces (inventory, builders, vehicle template, dashboards) are registered as Payload Admin custom views and dashboard widgets
- src/app/(payload)/custom.scss — 8,722 lines of global admin overrides styling every operator view; no CSS modules exist under src
- src/components/admin-ui/kit.tsx (503 lines) — shared admin primitives (AdminPageShell, AdminCard, AdminTable, ConfirmDialog, etc.) exist but are styled via admin-kit-* classes in the global stylesheet
- src/app/(frontend) — the only non-admin surface is the auth-gated vehicle-preview route; no operator shell exists outside (payload)

### Acceptance criteria

- [ ] The console shell renders entirely outside the Payload Admin layout with zero imports from the Payload admin CSS graph, verified by a build-level check
- [ ] A product-owned design system (tokens plus primitives) covers navigation, search/commands, breadcrumbs, notifications, and all required UI states including degraded-provider and permission-denied
- [ ] The shell is responsive at supported breakpoints, keyboard navigable, and passes an accessibility audit for its core flows
- [ ] Authentication and authorization enforce the D01 three-role matrix server-side; permission-denied states render for unauthorized roles
- [ ] Native Payload Admin remains fully functional for administrators as data-repair and fallback surface

## F027 — Incremental workflow migration into the operator console

**Classification:** `not_implemented`  
**User outcome:** Inventory, the vehicle workspace, import/review, homepage and page builders, media, leads, analytics, and the AI Studio each move into the operator console one bounded workflow at a time, without breaking the Payload Admin fallback during the transition.  
**Business value:** The console shell only pays off when the real workflows live in it; incremental migration keeps every workflow continuously operable, retires the corresponding custom.scss sections (F016 containment ledger), and lets the highest-friction surfaces move first per the D09 cadence.

### Repository evidence

- src/components/views/ — 17 view components (InventoryManager, VehicleWorkspaceTab, HomeBuilder, LandingBuilder, VehicleTemplateBuilder, VehicleImageStudio, MediaWorkspaceManager, dashboards) all live inside Payload Admin today
- src/components/views/MediaWorkspaceView.tsx — fully coded but registered nowhere, an immediate candidate to debut inside the console instead of Payload
- src/payload.config.ts:53-58 — custom nav injections (AdminBuilderNavLinks, AdminHomeLink) that the console's own navigation replaces

### Acceptance criteria

- [ ] Each migrated workflow reaches feature parity in the console (verified by a documented parity checklist) before its Payload custom view is retired for operators
- [ ] All console workflows call the same role-aware domain services/routes as before — no raw collection access from the UI
- [ ] Payload Admin remains available to administrators for data repair and fallback throughout and after the migration
- [ ] Each migration deletes its corresponding custom.scss section, tracked in the F016 containment ledger
- [ ] Loading/empty/error/degraded/permission-denied states work in every migrated workflow

## F028 — Modern GBE Storefront journeys: homepage, catalog, and vehicle detail

**Classification:** `unknown`  
**User outcome:** Shoppers experience a modern storefront: the published homepage rendered from site_config, a catalog with accurate new/used/Seminuevos navigation, complete deterministic filters/sorts/facets with useful no-result states and shareable URL state, and vehicle detail pages with galleries, condition/trust modules, related inventory, recently added, availability signals, and mobile-optimized conversion.  
**Business value:** The storefront is where the platform earns money; the alignment audit found the existing consumer dated and fed by incomplete contracts. Modern journeys built on the shared contracts (dynamic brand/model/location/dealership data — never hardcoded) turn the backend investment into measurable customer conversion, with approved external dealership links strictly supplemental to GBE-owned flows.

### Repository evidence

- The Storefront repository is absent from this workspace (src/app/(frontend)/page.tsx:4 redirects to /admin); its current journey quality cannot be verified until the D05 pin and F020 capture exist
- src/services/publicVehicleCatalog.ts and src/app/(payload)/api/public/* — the producer-side contracts (cards, detail, landing blocks, collections, options) these journeys must consume
- src/blocks/SiteSections.ts — the 14 homepage block types the storefront homepage must render
- docs/product/inputs/MASTER_PRODUCT_ROADMAP_CONSULTATION_20260710.md section 4.F — the required journey scope including Seminuevos navigation, deterministic sorts, shareable URL state, and mobile conversion behavior

### Acceptance criteria

- [ ] The homepage renders every registered block type from published site_config data with safe unknown-block degradation, under shared fixtures
- [ ] New/used/Seminuevos navigation and all catalog filters/sorts/facets behave per the frozen contract; filter state round-trips through shareable URLs; no-result states offer useful recovery
- [ ] Vehicle detail renders canonical-media galleries, trust/condition modules, related and recently-added inventory, and availability signals from backend data only — no hardcoded brand/model/location content
- [ ] Approved external dealership links appear only as supplemental routing per the D08 strategy
- [ ] Mobile conversion journeys (browse, filter, detail, contact) pass on supported devices

## F029 — Storefront quality: SEO, accessibility, performance, and honest failure states

**Classification:** `unknown`  
**User outcome:** The storefront earns search traffic and trust: real 404s, observable degraded mode instead of fake content, no plausible demo inventory in production, accessible pages, strong Core Web Vitals, canonical URLs, dynamic metadata, sitemap, robots, JSON-LD, and local SEO for Mexico.  
**Business value:** Organic discovery is the cheapest acquisition channel for a ~1,400-vehicle catalog, and fake-looking fallbacks or demo inventory in production would poison both trust and analytics. Spanish/Mexico behavior is the product default, making local SEO structurally important.

### Repository evidence

- The Storefront repository is absent from this workspace; its current SEO/accessibility/failure-state posture cannot be verified until the D05 pin and F020 capture exist
- docs/product/inputs/MASTER_PRODUCT_ROADMAP_CONSULTATION_20260710.md section 4.F — requires real 404s, observable degraded mode, no plausible demo inventory in production, accessibility, Core Web Vitals, canonical URLs, dynamic metadata, sitemap, robots, JSON-LD, and local SEO
- src/payload.config.ts — i18n is Spanish-only (es), matching the Spanish/Mexico default the storefront must honor

### Acceptance criteria

- [ ] Missing vehicles and pages return real 404 status codes; provider/backend outages render an observable degraded mode, never plausible demo inventory
- [ ] Canonical URLs, dynamic metadata, sitemap, robots, and JSON-LD generate from published backend data, validated by fixture tests
- [ ] Local SEO structure exists for Mexican cities and dealership locations in Spanish
- [ ] Core Web Vitals meet documented budgets on key journeys with CI regression checks
- [ ] Accessibility audits pass for home, catalog, detail, and conversion flows

## F030 — Durable AI job infrastructure: provider abstraction, queue, safety, and cost governance

**Classification:** `partially_implemented`  
**User outcome:** AI generation runs as durable queued jobs that survive restarts: operators can cancel, failures retry within bounded timeouts, replays are idempotent, concurrency is limited, every job carries provenance and cost against reservations/quotas, and unsafe content is blocked by moderation — with observable, auditable failure states.  
**Business value:** Generation today is one synchronous OpenRouter call inside an HTTP request with zero retry, timeout, cancellation, idempotency, cost tracking, quota, or moderation — a stability and financial liability the moment the studio flag turns on for a team. The AGIREAL adaptation rules make quotas, cost reservation/ledger, concurrency limits, retry/idempotency, cancellation, timeouts, and observable failures mandatory for provider calls.

### Repository evidence

- src/collections/WorkshopJobs.ts:33-188 — durable DB-backed job records with status draft/generating/ready_for_review/approved/rejected/failed already exist
- src/app/(payload)/api/cms/workshop/generate/route.ts:204-254,341-408 — generation is a single blocking provider fetch with no AbortController/timeout, no retry, no queue or worker, no idempotency key, no cost or quota code; provider fixed to OpenRouter/Grok by env default (:13-18)
- Repository-wide searches for queue/cron/retry/idempotency/moderation/quota/cost return nothing in the workshop paths; no rate limiting exists (F022 evidence)
- docs/product/inputs/AGIREAL_REUSE_MATRIX.md rules 5-8 — provenance, budgets, quotas, cancellation, timeouts, and fail-closed limiting are mandatory adaptation rules

### Acceptance criteria

- [ ] A generation job enqueued before a deploy/restart completes afterward; job state is always recoverable from the database
- [ ] Cancellation, bounded timeouts, and capped retries behave per configuration, with tests; replaying an enqueue request is idempotent
- [ ] Every provider call reserves cost before execution and settles a ledger entry after; exceeding a D11 quota rejects the job before any provider spend
- [ ] Prompts and outputs pass the D11 moderation policy before delivery; blocked content produces an auditable failure state
- [ ] Every job and output records provider, model, prompt, cost, safety, and provenance metadata
- [ ] Concurrency limits hold under a burst test and the enqueue endpoint enforces F022 rate limits

## F031 — AI Media Studio in the operator console: vehicle workshop and banner/promo/social workspace

**Classification:** `partially_implemented`  
**User outcome:** Operators generate and edit vehicle images and marketing assets (banners, promos, social) in one console studio: text-to-image and image editing with before/after comparison, crop/aspect variants, approve/reject, canonical Media save with provenance, and proposed attachment to a draft vehicle or page block — never auto-published.  
**Business value:** The vehicle image workshop already works per-vehicle and a full banner/promo/social workspace is fully coded but unreachable (registered nowhere), so real built value is stranded; porting both onto the durable job infrastructure inside the console turns the platform's key differentiator into an operable, governed product.

### Repository evidence

- src/components/views/VehicleImageStudio.tsx and VehicleAIImageWizard.tsx — the working per-vehicle studio and AI wizard (flag-gated at :91), with client-side crop-to-aspect (VehicleImageStudio.tsx:1567-1706; wizard :1104-1152) and outputs recorded as needs_review vehicle-media-assets (:718-754)
- src/components/views/MediaWorkspaceView.tsx and MediaWorkspaceManager.tsx — the banner/promo/social workspace (jobType marketing_asset, presets, aspect ratios, chat, reference uploads) fully coded but absent from src/payload.config.ts views and importMap.js — unreachable today; its outputs save to Media only with no approval record (MediaWorkspaceManager.tsx:340)
- src/collections/WorkshopJobs.ts:55-70,153-165 — banner/promo/social presets and saveDestination options already modeled
- No before/after comparison UI exists anywhere (verified); marketing outputs bypass the asset approval lifecycle
- docs/product/inputs/AGIREAL_REUSE_MATRIX.md — media-generation rows pin the adaptable AGIREAL patterns (prompt templates, per-card job states, before/after, edit/reset) and prohibit demo providers, client-only persistence, and permissive fallbacks

### Acceptance criteria

- [ ] Both the vehicle workshop and the banner/promo/social workspace are reachable in the operator console, running on durable F030 jobs
- [ ] Text-to-image and image editing support before/after comparison and crop/aspect variants
- [ ] Every generated or edited output — vehicle or marketing — enters a reviewer-gated approve/reject lifecycle and saves to canonical Media with provenance; nothing bypasses review
- [ ] An approved asset can be proposed for attachment to a draft vehicle or draft page block, and publication happens only through the normal publishing gates — no auto-publish path exists, proven by tests
- [ ] The legacy env-flag gate is replaced by role- and quota-based authorization from D01/D11

## F032 — Typed agent orchestrator and durable approval framework

**Classification:** `not_implemented`  
**User outcome:** Operators delegate work to controlled agents through a typed orchestrator that routes to inventory, merchandising, media, lead, or analytics specialists; every consequential action becomes a durable approval bound to the actor, the exact proposed diff, an expiration, and an idempotency key — agents can never publish or bypass roles, media policy, or endpoint limits.  
**Business value:** Agent-assisted operations are a core differentiator, but no agent, orchestrator, or AI SDK dependency exists in the repository today. Building the routing and approval framework once — on the same role-aware domain services the operator UI uses — prevents each future agent from inventing its own authorization shortcut.

### Repository evidence

- Repository-wide search finds no orchestrator, agent, or LLM-driven operational code; no anthropic/openai/ai-sdk packages exist in package.json (the only AI code is the image workshop's OpenRouter call)
- docs/product/inputs/AGIREAL_REUSE_MATRIX.md — typed routing contracts and approval/clarification patterns are pinned as adaptable (sub-agent-orchestrator, agent-hil-plan, ai-elements-confirmation) with mandatory adaptation rules 1-4: tools call role-aware domain services, approval is durable and bound to actor/diff/expiration/idempotency, client state is never authorization
- src/services/cmsRequestAuth.ts and the cms route family — the role-aware domain service surface agent tools must call instead of raw collections

### Acceptance criteria

- [ ] A typed orchestrator routes requests to at least two domain specialists with structured, streamed results
- [ ] Every consequential agent action creates a durable approval record binding actor, exact diff, expiration, and idempotency key; execution re-verifies the approval server-side and expired approvals cannot execute
- [ ] Agent tools call only role-aware domain services; a test proves an agent tool cannot perform a raw collection write or publish transition
- [ ] Replayed approved actions are idempotent no-ops; all agent actions produce audit records
- [ ] Agent endpoints respect D01 roles and F022 rate/cost limits

## F033 — Inventory import assistant agent

**Classification:** `not_implemented`  
**User outcome:** An operator hands the assistant an import file; the agent reads it, proposes column mappings, normalizes data, detects duplicates, validates images and pricing, and presents an exact diff — and only after the operator's durable approval does the governed import pipeline commit it.  
**Business value:** Imports are the highest-volume operational chore at ~1,400-vehicle scale; the agent removes the manual mapping/validation labor while the F023 dry-run/approval pipeline and F032 approval framework guarantee it cannot commit, publish, or bypass anything a human wouldn't.

### Repository evidence

- No agent-assisted import code exists anywhere in src (verified: zero orchestrator/assistant matches in the import paths)
- src/services/importNormalize.ts:262-294 — suggestFieldForHeader already implements heuristic header mapping the agent can build on
- src/app/(payload)/api/cms/import/run/route.ts — the commit surface the agent must reach only through the F023 approval-gated pipeline
- docs/product/inputs/AGIREAL_REUSE_MATRIX.md — spreadsheet preview/grid artifact patterns are adaptable for the review UI; replacing GBE import services is prohibited

### Acceptance criteria

- [ ] Given a fixture CSV/XLSX, the agent proposes correct mappings, normalization results, duplicate findings, and image/price validation as an exact diff without mutating any data
- [ ] Commit happens only through the F023 pipeline after a durable F032 approval bound to that exact diff; an altered diff invalidates the approval
- [ ] The agent cannot publish vehicles or bypass roles, media policy, or endpoint limits, proven by negative tests
- [ ] The full agent-assisted journey works at ~1,400-row scale on staging within documented bounds

## F034 — GBE lead capture and dealership/city-aware WhatsApp handoff

**Classification:** `requires_product_decision`  
**User outcome:** A shopper on any vehicle or page converts through a GBE-owned lead form or a WhatsApp deep link routed to the right dealership/city number with a prefilled context message; approved external dealership links appear only where the business chooses.  
**Business value:** Conversion is the platform's commercial purpose. The schema already stores site and per-dealership WhatsApp numbers and validates routing completeness at publish, but no wa.me link generation exists in this repository and the capture/handoff/redirect balance is an open business strategy (D08) — building the journey wrong would send measurable conversions off-platform.

### Repository evidence

- No wa.me/api.whatsapp.com link generation exists in application code (only seed data: src/seed/seed.ts:288)
- src/globals/SiteConfig.ts:35,44 and src/collections/Dealerships.ts:34 — site-level and per-dealership WhatsApp numbers are stored
- src/collections/Vehicles.ts:645-652 and src/services/vehicleWorkflow.ts:188-189 — allowFallbackRouting and publish-time validation requiring dealership/city/fallback routing completeness
- src/migrations/20260610_100000_p0_whatsapp_routing_contracts.ts — routing columns and analytics event types already migrated
- src/collections/Leads.ts:47-48 — whatsappNumber and whatsappOpenedAt fields exist for recording the handoff

### Acceptance criteria

- [ ] A routing service resolves the correct WhatsApp number for vehicle/dealership/city/fallback cases per fixtures, and generated wa.me links carry the prefilled context message
- [ ] Lead form submissions flow only through the hardened F006 ingestion endpoint, producing exactly one lead per journey
- [ ] Every WhatsApp handoff records the lead/analytics event pair including destination dealership/city
- [ ] Approved external links render only where the D08 rules allow, never replacing the primary GBE journey by default
- [ ] The D08 decision is recorded before the storefront conversion surfaces ship

## F035 — Lead inbox and sales workflow: assignment, stages, SLA, and routing outcomes

**Classification:** `partially_implemented`  
**User outcome:** Sales staff work leads in a dedicated inbox: new leads arrive assigned or claimable, move through explicit stages, show response timers against an SLA, record routing/handoff outcomes and delivery logs, and duplicate contacts consolidate into one deduplicated conversion picture.  
**Business value:** Lead fields (stage, assignedTo, contactedAt) exist but the only UI is the raw Payload list view — no inbox, no SLA measurement, no dedup — so response speed and conversion outcomes are unmanaged today; this converts stored rows into a managed sales process.

### Repository evidence

- src/collections/Leads.ts:79-96 — stage select (new through closed_won/closed_lost), assignedTo/contactedBy relationships, and contactedAt exist; no SLA, dedup, or routing-outcome fields
- No lead inbox, pipeline, or management component exists under src/components (verified); leads surface only via the default Payload list view and aggregate counts in AnalyticsDashboard
- src/collections/Leads.ts — no hooks: nothing computes response times, deduplicates by phone/email, or logs delivery/handoff outcomes

### Acceptance criteria

- [ ] The console inbox lists, assigns, and stages leads with server-validated transitions scoped to the D01 sales-capable roles
- [ ] First-response SLA is computed from server timestamps and visibly flags overdue leads
- [ ] Routing outcomes and delivery/handoff logs record where each lead went (form, WhatsApp destination, external link) per F034 events
- [ ] Duplicate submissions by the same normalized contact consolidate into one lead with history, and conversion counts deduplicate accordingly, with tests

## F036 — Trusted analytics: bounded sessions, attribution, consent, bot filtering, idempotent events, and rollups

**Classification:** `partially_implemented`  
**User outcome:** Every metric the platform shows is trustworthy: sessions and visitors are bounded server-validated identities, events carry source/UTM/campaign attribution, bots are filtered, replays are idempotent no-ops, consent and retention rules are enforced, and dashboards read from rollups instead of capped raw scans.  
**Business value:** The 408 live analytics rows are operationally untrusted: ingestion is publicly spoofable, session/visitor IDs are arbitrary client strings, there is no idempotency, UTM, consent, or bot filtering, and the dashboard reads at most 300 raw rows — so every current number is potentially wrong. Trusted rollups are also the explicit gate for restoring smart ranks and enabling exposure signals.

### Repository evidence

- src/collections/AnalyticsEvents.ts:26-42 — a usable ten-type event taxonomy already exists (page_view through page_duration)
- src/collections/AnalyticsEvents.ts:61-62,5-10 — sessionId/visitorId are unvalidated client strings; create is public; no idempotency, UTM, consent, or bot-filtering fields or hooks exist
- src/components/AnalyticsDashboard.tsx:123-159 — dashboards query raw events capped at 300 rows and group in JavaScript; no rollup layer or aggregation service exists anywhere
- src/migrations/20260610_100000_p0_whatsapp_routing_contracts.ts — WhatsApp-related event types already migrated into the taxonomy

### Acceptance criteria

- [ ] Sessions and visitors are bounded server-validated identities with documented windowing; malformed identities are rejected at ingestion
- [ ] Events carry UTM/source/campaign attribution and page/block/placement identity; replayed event IDs are idempotent no-ops
- [ ] Bot traffic is filtered at ingestion per documented rules; consent and retention policies are enforced with tests
- [ ] Rollups cover impressions, placement clicks, search/no-result behavior, detail engagement, lead/WhatsApp funnels, and destination dealership, and reconcile against fixture event streams
- [ ] Dashboards and any restored smart rank read exclusively from rollups

## F037 — Dealer-facing reporting: exposure, conversion, demand, aging, and SLA views

**Classification:** `partially_implemented`  
**User outcome:** Dealers and managers read trustworthy views: visitors and qualified sessions, inventory exposure and click-through, leads and WhatsApp conversion, top and underexposed vehicles, conversion by page/block/placement/source/city/dealership, no-result demand, inventory aging, and lead-response SLA.  
**Business value:** Reporting today is two global admin widgets over capped raw events with no dealer scoping — useful numbers exist only as untrusted approximations. This is the analytics product dealers actually consume and the business case for the trusted event investment.

### Repository evidence

- src/components/AnalyticsDashboard.tsx — global admin widget grouping capped raw events by vehicle/agency/city; no dealer-scoped views exist
- src/components/OperationsDashboard.tsx:42-61 — vehicle/import count queries only
- src/payload.config.ts:86-104 — both dashboards registered as full-width Payload Admin widgets
- No dealer-facing report, per-dealership filter/scoping, or SLA/aging/no-result view exists anywhere (verified)

### Acceptance criteria

- [ ] Every listed view (visitors/sessions, exposure/click-through, top/underexposed, conversion by page/block/placement/source/city/dealership, no-result demand, aging, SLA) renders in the console from rollups only
- [ ] Figures reconcile against fixture event streams end-to-end (ingestion through rollup to view)
- [ ] Views scope correctly by dealership/city and role per the D01 matrix
- [ ] The legacy raw-scan admin widgets are retired once console parity is verified

## F038 — Shared contracts source of truth and the bounded monorepo decision

**Classification:** `partially_implemented`  
**User outcome:** Public DTOs, catalog options, block schemas and migrations, renderer registry expectations, analytics event types, and test fixtures live in exactly one consumable source shared by Admin and Storefront, and the repository-structure question is settled by a bounded decision that never blocks urgent fixes.  
**Business value:** Every storefront-facing contract currently lives only inside this repository while a separate consumer depends on it by convention — the root cause of the drift risk that F020 checks for. One shared source turns drift from a runtime surprise into a compile/CI failure, and the D10 decision bounds how far restructuring goes.

### Repository evidence

- src/services/publicVehicleCatalog.ts — PublicVehicleCard/PublicVehicleDetail/PublicLandingBlock/PublicVehicleListOptions types and serializers exist in-repo only
- src/blocks/SiteSections.ts and src/components/admin-ui/sectionLibraries.ts — block schemas and their hand-maintained editor mirror
- src/collections/AnalyticsEvents.ts:26-42 — the event-type taxonomy a storefront tracker must match
- No packages/ directory, pnpm-workspace.yaml, turbo.json, lerna.json, or nx.json exists; the repo is a single npm package (verified)
- docs/product/inputs/MASTER_PRODUCT_ROADMAP_CONSULTATION_20260710.md section 4.K — one contracts source, a bounded migration decision, and independent deployability are required; a large repository move must not block urgent security, homepage, or media fixes

### Acceptance criteria

- [ ] One contracts source exports public DTOs, catalog options, block schemas, analytics event types, and fixtures, and both the Admin build and the F020 drift check consume it
- [ ] A contract change that breaks a consumed field or block fails CI in both repositories per the D10-chosen mechanism
- [ ] The D10 decision (package vs monorepo vs drift-checks-only, and timing) is recorded with its route
- [ ] Admin/platform and Storefront remain independently deployable
