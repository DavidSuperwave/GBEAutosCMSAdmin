# GBE Autos CMS Admin — platform hardening and publishing roadmap (reconciled against codex/admin-workflow-updates)

**Blueprint ID:** `gbeautoscmsadmin-gbe-platform-roadmap-20260710-blueprint-20260710t122259z`  
**Gate status:** `needs_decision`  
**Execution authorization:** `none`

## Product outcome

A safe-to-operate multi-user vehicle CMS for GB Automotriz in which every privilege is explicit and fail-closed, public APIs expose only intended published data, leads and analytics are trustworthy, media survives redeploys under one canonical contract, content changes are draftable/previewable/reversible instead of live-on-save, the catalog supports correct numeric pricing with complete filters and sorts, and — after a deliberate foundation decision — multiple tenants can be isolated on one platform. All of this must become provable through a reproducible Node 22 CI and staging harness rather than asserted from code reading.

## Consultation summary

The plan-audit consultation (run gbeautoscmsadmin-gbe-current-roadmap-audit-20260710t105553z) returned verdict `revise`. It found that commits e9484c9..d6d505f materially improved authorization (shared requireCmsRole guard, authenticated raw reads for Vehicles/VehicleCollections/VehicleMediaAssets, server-side publish gating, bounded public DTOs, media approval enforcement), but that these gains remain undermined by a fail-open role fallback that treats roleless authenticated users as admins, and by residual open boundaries: public Pages/Dealerships/SiteConfig reads, public Lead/Analytics ingestion with client-settable management fields, raw REST and GraphQL still mounted, no rate/body limits. It found P0-2 (durable media) and P0-7 (tenancy) fully open, no draft/version publishing model for Pages, SiteConfig, or vehicle content, text-based pricing with incomplete catalog filters/sorts, no test framework or CI, and the admin style guard now passing while the 8,721-line global stylesheet architecture remains. It ruled that WP-00, WP-02, WP-03, and WP-04 contain cross-repository, tenant-dependent, or multi-model scope that cannot ship as single bounded features, and prescribed a corrected sequence: operations truth capture, then WP-01A explicit-role fail-closed migration (the recommended first feature), then Admin-only CI, then layered authorization completion, a Pages-only publishing proof, the tenant foundation decision gate, durable media in two phases, catalog correctness in two phases, remaining publishing models, and style work last.

## Repository assessment

Live repository re-inspected at branch codex/admin-workflow-updates (HEAD d6d505f, matching the consultation packet, plus uncommitted logo/CSS/preview-page/launch-config changes). Every material consultation claim reproduced: (1) src/access/roles.ts:31-40 returns ['admin'] for any authenticated user with no role, and src/services/cmsRequestAuth.ts:40 delegates to hasRole, so all requireCmsRole guards are fail-open for roleless accounts; (2) src/collections/Vehicles.ts:243-248 now requires authentication to read and canManageInventory to mutate, with server-side publish-completeness enforcement in beforeValidate at :358-363, but price is a text field at :603-609; (3) src/collections/Pages.ts:30-35 has public read and no versions/drafts anywhere in collection or global configs (grep for versions/drafts matches only an old vehicles migration and UI labels); (4) src/collections/Dealerships.ts:5-7 exposes all fields including internalNotes publicly with Payload-default mutations; src/globals/SiteConfig.ts:10-12 declares only public read with no update policy; (5) src/collections/Leads.ts:7-12 and src/collections/AnalyticsEvents.ts:5-10 allow anonymous creation across full schemas including management fields (stage, assignedTo, notes), and any authenticated user may update/delete analytics events; (6) src/collections/Media.ts:28 uses local upload:true and src/payload.config.ts:167 has plugins: [] — no storage adapter; (7) raw REST and GraphQL remain mounted at src/app/(payload)/api/[...slug]/route.ts and src/app/(payload)/api/graphql/route.ts; (8) src/services/publicVehicleCatalog.ts:79-101 omits price/color filters, :164-181 maps priceAsc/priceDesc to the text price column and all three analytics ranks plus newest to -createdAt with no yearAsc, and the public collection route src/app/(payload)/api/public/collections/[slug]/route.ts:22-25 accepts only page/limit; (9) no tenant/Tenant match anywhere under src; (10) package.json has no test framework, no test:security script, and no .github directory exists; (11) src/app/(payload)/custom.scss is 8,721 lines and imported globally, with no CSS/SCSS modules; (12) src/components/views/HomeBuilder.tsx:22-33 POSTs directly to the live site-config global ('changes publish on save'); (13) src/components/views/VehicleWorkspaceTab.tsx:781-796 dirty/publish guards are client-side only with no optimistic-concurrency header; (14) src/collections/Users.ts:44-52 already restricts role field create/update to admins. The consultation's corrected sequence is therefore consistent with the live tree and is adopted below with feature-level classifications.

## Milestones

### M01 — Operations gate — staging truth capture

A trusted, archived snapshot of the real environment: Postgres version/extensions, exposed schemas, API-role grants and RLS state, sanitized deployment settings, the complete user/role inventory, media inventory, and backup/restore readiness. No data migration proceeds without this evidence.

Features: F002

### M02 — Fail-closed authorization foundation (WP-01A)

Every authenticated user has an explicit reviewed role; missing/invalid roles grant no privilege; the first focused security-test harness exists and passes against roleless fixtures.

Features: F001

### M03 — Admin release harness (WP-00A)

A clean Node 22 CI pipeline runs install, style guard, typecheck, lint, focused security/integration tests, and production build as required checks with retained artifacts.

Features: F003

### M04 — Authorization completion in layers (WP-01B/C/D)

The vehicle raw/public/preview boundary, the content/reference collections and globals, and the lead/analytics ingestion paths are each independently proven closed with negative REST/GraphQL/custom-endpoint tests.

Features: F004, F005, F006

### M05 — Publishing proof — Pages only (WP-04A)

One Page fixture demonstrates Payload drafts/versions end to end: authenticated draft preview, anonymous non-visibility, publish, unpublish, rollback.

Features: F007

### M06 — Tenant foundation decision and schema (P0-7)

Tenant identity, membership, host resolution, and reversible GBE backfill exist (or tenancy is explicitly deferred per D02), unblocking tenant-scoped media keys and multi-tenant fixtures.

Features: F008

### M07 — Durable media (WP-02A/B)

All new uploads land in durable object storage through one canonical media contract; legacy imageUrl values are inventoried, backfilled, reconciled, and cut over after a staging durability proof (upload → redeploy → hash-compare → delete).

Features: F009, F010

### M08 — Catalog correctness (WP-03A/B)

Pricing is numeric with currency and a reconciled backfill; the public catalog API offers complete filters, deterministic sorts, facets, and parameterized collection queries under contract tests.

Features: F011, F012

### M09 — Remaining publishing models and concurrency (WP-04B/C)

Homepage/SiteConfig and vehicle presentation content gain draft/version/rollback semantics per decisions D02/D03, and concurrent edits are protected by an optimistic-concurrency contract instead of client-only guards.

Features: F013, F014, F015

### M10 — Style architecture and cross-repository gates

Global admin styling is decomposed into owned, scoped modules with browser regression coverage, and Storefront integration (catalog UI, live preview, analytics reconciliation) is verified against a pinned GBECMS capture per D06.

Features: F016, F017

## Global risks

- The database is live production Supabase data; every migration in this roadmap (roles, price, media, tenancy) must run against staging with archived rollback evidence first — the consultation forbids production migration during blueprint/build work
- The fail-open role fallback (src/access/roles.ts:38) is in production now; until F001 lands, any malformed or roleless account holds effective admin across all guarded endpoints
- There is no CI, typecheck-in-anger, or test suite: TypeScript and ESLint could not even be executed in the audit sandbox, so current type/lint health is unknown until F003 runs them on clean Node 22
- Raw REST and GraphQL remain mounted for all collections; any access-rule mistake anywhere becomes an immediate public exposure, which is why every access feature requires negative-path tests
- Media bytes are non-durable on serverless hosting today; a redeploy can silently lose newly uploaded images until F009 ships
- Public lead/analytics ingestion is spoofable now, so all current dashboard metrics and lead counts should be treated as untrusted until F006 plus rollups land
- Sequencing risk: performing media keying (F009) or SiteConfig versioning (F013) before the tenant decision (D02) forces remigration; the milestone order exists to prevent that rework
- Cross-repository blindness: all Storefront behavior is carried forward, not verified; contract changes in F004/F012 could break the live storefront without F017's gate
- The uncommitted working tree (logo, custom.scss, vehicle-preview page, launch config) is not part of any reviewed commit; it should be committed or discarded deliberately before feature work begins on this branch
