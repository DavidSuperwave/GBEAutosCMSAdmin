# GBE Autos CMS Admin — single-site homepage-first roadmap (revised per verified Supabase live read-only audit, 2026-07-10)

**Blueprint ID:** `gbeautoscmsadmin-gbe-single-site-homepage-roadmap-20260710-blueprint-20260710t132330z`  
**Gate status:** `needs_decision`  
**Execution authorization:** `none`

## Product outcome

A safe-to-operate single-site CMS for the primary GBE website in which exactly three business roles (admin, general, sales) confer explicit fail-closed privileges; the registered site_config global is the sole homepage source of truth with draft, preview, publish, unpublish, and rollback semantics replacing publish-on-save; the legacy home global family is reconciled and retired; public APIs expose only bounded published DTOs (including a safe dealership DTO with an approved external link); leads and analytics are trustworthy; media bytes live durably in Supabase Storage behind the canonical Payload Media service with single-site keys; the catalog gains numeric pricing and deterministic complete filters/sorts; and every contract is proven by a Node 22 CI harness and a pinned-SHA Storefront verification gate rather than asserted from code reading.

## Consultation summary

The F002 operations truth-capture audit ran strictly read-only against the live Supabase project bdnvgbdmqmbzemllqngs and returned 'partially captured; F002 remains open'. It live-verified: the role enum is exactly the legacy six-role set (admin, inventory_manager, content_editor, sales_manager, media_editor, viewer) with neither 'general' nor 'sales'; all 93 public tables report RLS enabled but 35 have no policies (advisor INFO only, no ERROR/WARN); no tenant table or tenant-named column exists anywhere, confirming the single-site model and mandating removal of the tenancy feature; both the legacy 'home' table family (home, home_stats, home_brands — all with live rows) and the registered 'site_config' model contain data, creating a real competing homepage source-of-truth problem; Storage holds 1 bucket and 277 object rows against only 42 Payload media rows, with bucket identity/visibility unknown; and vehicles (1,391 rows) carry text price plus overlapping status and image fields. Every execute_sql call was cancelled by the MCP layer, so exact Postgres version, byte sizes, forced-RLS, policies, grants, privileged functions, exact counts, and role distributions remain unknown. The audit reconciles the prior 17-feature platform blueprint against confirmed human decisions: F008 (tenancy) is removed; F009 (durable media on Supabase Storage) and F013 (homepage/SiteConfig publishing) are unblocked, with F013 pulled forward ahead of generic Pages publishing (F007); F001 is revised to migrate the live six-role enum to the three-role fail-closed model (admin/general/sales); F002 stays open pending safe manual SQL captures; and F017 Storefront verification remains the release gate. Recommended sequence: complete F002 captures, then F001, F003 CI, homepage-relevant F005 access closure, F013 homepage publishing, remaining F004–F006 boundary work, F009–F010 media, F011–F012 catalog, then F007/F014/F015, F016, and finally F017.

## Repository assessment

Live repository re-inspected at branch codex/admin-workflow-updates (HEAD d6d505f, plus uncommitted logo/CSS/preview-page/launch-config changes and untracked docs/scripts). Every material consultation claim reproduced against the tree: (1) src/access/roles.ts:12-27 defines the six legacy roles matching the live enum, and getRoles at :31-40 returns ['admin'] for any authenticated user with no role — the fail-open fallback that keeps F001 critical; src/services/cmsRequestAuth.ts:40 delegates to hasRole so every requireCmsRole guard inherits it. (2) src/payload.config.ts:149-165 uses the Postgres adapter via DATABASE_URI, :167 has plugins: [] (no storage adapter), :123 registers SiteConfig as the only global while src/globals/Home.ts exists unregistered with public read — matching the live competing home/home_stats/home_brands rows. (3) src/collections/Media.ts:28 is upload: true to local filesystem with public read at :8; scripts/sync-vehicle-images.mjs:22-24,39 is the out-of-band Supabase Storage write path using SUPABASE_SERVICE_ROLE_KEY against bucket 'vehicle-images' with an optional direct vehicle-row update mode — the dual media contract the audit requires retiring. (4) src/collections/Vehicles.ts:604-609 keeps price as text accepting ranges; :620-643 carries inventoryStatus (available/reserved/sold) and publishStatus (draft/needs_review/published/archived); :743-771 carries sourceDealerName plus legacy imageUrl/imagePath/imageFilename beside the canonical image relationship — all matching the live schema findings. (5) src/globals/SiteConfig.ts:10-12 declares only public read with no update policy and no versions; src/components/views/HomeBuilder.tsx:23-33 POSTs section edits directly to /api/globals/site-config and its UI copy at :38 states changes publish on save — no durable publishing boundary. (6) src/collections/Dealerships.ts:5-7 has public read over all fields including internalNotes (:57-63) and salesRepName (:55), no mutation access declared, and no approved external-URL field anywhere in the collection. (7) src/collections/Leads.ts:8 and src/collections/AnalyticsEvents.ts:6 allow anonymous create over full schemas; AnalyticsEvents update/delete require only authentication (:8-9). (8) Raw REST and GraphQL remain mounted at src/app/(payload)/api/[...slug]/route.ts:14-19 and src/app/(payload)/api/graphql/route.ts beside the bounded public DTO routes under src/app/(payload)/api/public/. (9) src/services/publicVehicleCatalog.ts:79-101 omits price/color options and :164-181 silently maps mostViewed/mostClicked/mostLeads (and newest) to -createdAt. (10) The preview route src/app/(payload)/api/public/vehicles/preview/[id]/route.ts:12-16 enforces requireCmsRole but names the legacy roles inventory_manager/content_editor, which the three-role migration must rewrite. (11) No versions/drafts config exists in any collection or global (grep matches only a 2026-05-21 migration's table names); Pages uses a manual status select at src/collections/Pages.ts:69-78. (12) No .github/workflows directory exists and package.json:7-27 has no test or typecheck script — no CI harness. (13) src/migrations contains 15 registered migration modules (17 entries including index.ts and a schema JSON) versus 17 live payload_migrations rows, confirming the audit's name-only capture requirement. (14) No tenant model or tenant-named code exists under src, consistent with the live schema and the single-site decision. The prior blueprint at docs/product/roadmaps/gbe-platform-roadmap-20260710/BLUEPRINT.json supplies the F001–F017 identifiers revised here.

## Milestones

### M01 — Close the operations truth gap (F002 manual captures)

The blocked read-only captures are executed by an authorized operator per D06: Postgres version, table sizes and forced-RLS, policy/grant/SECURITY DEFINER inventory, Storage bucket identity and aggregates, role distribution, and content-quality aggregates are archived, converting the audit's unknowns into evidence that feeds the role mapping (D02), media planning, and price backfill.

Features: F002

### M02 — Three-role fail-closed authorization foundation

The live six-role enum and code model are migrated to exactly admin/general/sales per the approved matrix (D01) and per-user mapping (D02); missing, null, or invalid roles grant no privilege anywhere; negative tests prove it.

Features: F001

### M03 — Minimum Node 22 CI and security-test harness

A clean Node 22 pipeline runs install, style guard, typecheck, lint, the focused security tests from F001, and production build as required checks with retained artifacts, making all later acceptance criteria mechanically enforceable.

Features: F003

### M04 — Homepage-relevant access closure

SiteConfig gains an explicit update policy, Pages public read is scoped, Dealerships stop exposing internal fields and gain a bounded public DTO with an approved external URL field, and Media/reference access is ratified — the access preconditions for safe homepage publishing.

Features: F005

### M05 — Primary GBE homepage publishing on site_config

site_config is the single homepage source of truth with draft, authenticated preview, explicit publish, unpublish, rollback, and concurrency protection; publish-on-save is gone; the legacy home/home_stats/home_brands family and unregistered Home global are reconciled per D03 and retired.

Features: F013

### M06 — Remaining API boundary hardening

The vehicle raw/public/preview contracts are frozen and proven with the three target roles, and lead/analytics ingestion is hardened with idempotency, limits, and server-owned fields so commercial data becomes trustworthy.

Features: F004, F006

### M07 — Durable media on Supabase Storage and legacy cutover

All new uploads flow through the canonical Payload Media service into Supabase Storage under single-site keys with a staging durability proof; the 42 Media rows, 277 Storage objects, vehicle image relationships, and legacy image columns are reconciled; the out-of-band sync path and legacy fields are retired.

Features: F009, F010

### M08 — Catalog correctness

Vehicle pricing becomes numeric amount/currency after human-reviewed classification of ambiguous values, and the public catalog offers complete filters, deterministic numeric sorts, and facets — with smart ranks removed or trusted per D04.

Features: F011, F012

### M09 — Secondary publishing models and concurrency

Pages gain the draft/version publishing proof, vehicle presentation versioning proceeds if D07 approves it, and optimistic concurrency protects vehicle workspace edits beyond the homepage.

Features: F007, F014, F015

### M10 — Admin style architecture isolation

Global admin styling is decomposed into owned, scoped modules with guard and browser regression coverage, after functional contracts have stopped moving.

Features: F016

### M11 — Storefront release gate

The main GBE Storefront at a pinned SHA verifiably renders the published homepage, navigation, inventory, media, approved dealership redirects, isolated previews, and deduplicated analytics — the final gate before public acceptance.

Features: F017

## Global risks

- The database is live production Supabase data (project bdnvgbdmqmbzemllqngs, 1,391 vehicles); every migration in this roadmap — roles enum, price, media, homepage/legacy-home retirement — must run against staging with archived rollback evidence first and never against production during build work
- The fail-open role fallback (src/access/roles.ts:38) is live now: any malformed or roleless authenticated account holds effective admin across all guarded endpoints until F001 lands
- F002 remains open: exact Postgres version, policies, grants, SECURITY DEFINER functions, forced-RLS state, Storage bucket restrictions, and all exact aggregates are unknown; features consuming them (F001 mapping, F009-F011, F013 reconciliation) carry hidden risk until D06 closes the captures
- The 35 RLS-enabled-without-policy tables are deny-by-default for API roles subject to unknown grants, but this is neither proof of exposure nor of safety; the policy/grant capture must settle whether the Data API surface is actually closed
- Two populated homepage models (site_config and the legacy home family) compete for truth in the live database right now; any storefront or content work done before F013's reconciliation risks building on the wrong source
- Raw REST and GraphQL remain mounted for all collections; any access-rule mistake anywhere becomes an immediate public exposure, which is why every access feature requires negative-path tests
- Media bytes are non-durable on serverless hosting today, and the service-role sync script is an active second write path into Supabase Storage; a redeploy can silently lose newly uploaded images until F009 ships
- Public lead/analytics ingestion is spoofable now; all current dashboard metrics (408 live analytics rows) are untrusted until F006 plus rollups land, and smart ranks must stay hidden per D04 until then
- No CI, typecheck, or test suite exists; until F003, every acceptance criterion in this roadmap is manually asserted rather than mechanically enforced
- All Storefront behavior is carried forward, not verified; contract changes in F004/F012/F013 could break the live website without F017's pinned-SHA gate
- The working tree carries uncommitted changes (logo, custom.scss, vehicle-preview page, launch config) plus numerous untracked review artifacts and scripts; these should be committed or discarded deliberately before feature work begins on this branch
