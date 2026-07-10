# Repository Reconciliation

## F001 — Explicit-role fail-closed migration and authorization proof (WP-01A)

**Classification:** `partially_implemented`  
**User outcome:** Administrators can trust that only explicitly granted roles confer access: an account with a missing, null, or unknown role can no longer invite users, review media, run imports, or see privileged data.  
**Business value:** Closes the highest-leverage security hole (consultation finding F1): every guard in the codebase currently fails open for roleless authenticated users, so all later authorization work is built on sand until this lands.

### Repository evidence

- src/access/roles.ts:31-40 — getRoles returns ['admin'] for any authenticated user with no role ('Users without any role behave as admins')
- src/services/cmsRequestAuth.ts:30-44 — requireCmsRole is centralized and server-side but delegates to hasRole, inheriting the fail-open fallback
- src/collections/Users.ts:44-52 — role field create/update already restricted to admins via adminFieldAccess, with defaultValue 'viewer' for new users
- src/migrations/index.ts exists with prior migrations (e.g. 20260610_100000_p0_whatsapp_routing_contracts.ts), establishing the migration pattern to extend
- package.json:7-27 — no test:security script or any test framework; the consultation's proof commands require adding one

### Acceptance criteria

- [ ] Every staged user has exactly one valid explicit role after migration; the migration is idempotent and aborts if an unmapped user remains
- [ ] getRoles resolves missing/null/unknown roles to no roles — never admin — and anonymous behavior remains denied
- [ ] Role field create/update remains admin-only; only explicit admins can invite users
- [ ] Roleless fixtures receive 403 from invite, vehicle-specs, import, workshop, media review, and preview endpoints; each explicit role's representative allow/deny cases match the documented matrix
- [ ] Existing explicit admins retain access; a pre-migration export and rollback procedure are archived
- [ ] Local API/overrideAccess usage cannot bypass the endpoint's explicit-role decision
- [ ] npm ci, check:admin-styles, tsc --noEmit, lint, test:security -- role-boundary (before and after migrate), and build all pass on clean Node 22

## F002 — Operations gate — staging and production truth capture

**Classification:** `not_implemented`  
**User outcome:** The team operates from verified facts about the live system — who the users are, what roles they hold, what the database exposes, and whether backups restore — instead of assumptions.  
**Business value:** Every migration in this roadmap (roles, price, media, tenancy) mutates live business data on Supabase; the consultation makes this evidence capture a hard gate before any data migration, and it resolves ten of the fourteen 'unknowns' in the audit.

### Repository evidence

- Consultation Section 9 lists Postgres version, extensions, exposed schemas, API-role grants, RLS state, deployed env settings, user/role quality, and production data snapshots all as not-tested
- scripts/production-e2e-smoke.ts exists as a read-only DB/API smoke check but captures none of the required inventory artifacts
- No .github directory or CI exists to archive such artifacts (verified: 'NO .github')

### Acceptance criteria

- [ ] Archived, timestamped read-only outputs exist for: Postgres version and extensions, exposed schemas, API-role grants, RLS state and policies, user role distribution, media/imageUrl inventory, and publish/inventory status distributions
- [ ] A sanitized deployment-settings matrix (key presence, non-secret values) is captured and compared against .env.example without exposing secrets
- [ ] Backup existence and a restore procedure are verified and documented
- [ ] No write occurred against production during capture

## F003 — Admin-only Node 22 CI and release harness (WP-00A)

**Classification:** `not_implemented`  
**User outcome:** Every change is proven by a reproducible pipeline — install, style guard, typecheck, lint, focused tests, build — before it can ship, instead of relying on local runs that the audit could not even start offline.  
**Business value:** The consultation classified TypeScript and ESLint as blocked-by-sandbox and found no test framework, CI workflow, or test script; without this harness, no later feature's acceptance criteria are mechanically enforceable.

### Repository evidence

- package.json:7-27 — scripts contain build/lint/migrate/seed/smoke but no unit, integration, contract, or security test command and no CI entry point
- No .github directory exists (verified live)
- npm run check:admin-styles passes (consultation runtime-verified), providing the one existing gate to wire in
- scripts/production-e2e-smoke.ts:98,409 — read-only DB/API smoke exists but targets production, not an ephemeral CI database

### Acceptance criteria

- [ ] A clean checkout on Node 22 runs install, style guard, typecheck, lint, focused tests, and production build as required CI checks, all passing
- [ ] The security tests from F001 run against an ephemeral or authorized staging database — never production
- [ ] CI artifacts (logs, build output, test reports) are retained and linkable
- [ ] Documentation states what CI does and does not prove (no browser, no Storefront, no tenant fixtures yet)

## F004 — Vehicle raw/public/preview boundary contract (WP-01B)

**Classification:** `partially_implemented`  
**User outcome:** Anonymous visitors can see exactly the published, non-sold, approved-media vehicle data intended for the storefront — and nothing else — through frozen, tested DTO contracts.  
**Business value:** Locks in the substantial e9484c9 hardening with regression proof so the vehicle boundary cannot silently reopen, and gives the Storefront a stable versioned contract to build against.

### Repository evidence

- src/collections/Vehicles.ts:243-248 — raw vehicle reads now require authentication; mutations require inventory roles
- src/services/publicVehicleCatalog.ts:206-210 — public queries enforce publishStatus=published and inventoryStatus!=sold; bounded DTO fields defined at :10-77
- src/app/(payload)/api/public/vehicles/preview/[id]/route.ts:12 — preview requires requireCmsRole
- src/app/(payload)/api/[...slug]/route.ts:14-19 and src/app/(payload)/api/graphql/route.ts — raw REST and GraphQL remain mounted, so the boundary depends on per-collection access rules that only tests can keep honest

### Acceptance criteria

- [ ] Anonymous requests to raw REST and GraphQL for vehicles, vehicle-collections, and vehicle-media-assets are denied, with tests
- [ ] Public list/detail/collection/preview DTO snapshots are frozen and any field addition or removal fails CI
- [ ] Unpublished, sold, and unapproved-media content is proven absent from every public path
- [ ] Preview endpoints return 401/403 for anonymous and roleless users and succeed for permitted roles

## F005 — Content and reference collection access policies (WP-01C)

**Classification:** `partially_implemented`  
**User outcome:** Internal operational data — dealership internal notes, site configuration writes, page mutations, media and tag management — is readable and writable only by the roles that need it.  
**Business value:** Closes the remaining always-true and Payload-default boundaries the audit enumerated, eliminating public exposure of internal notes and unguarded global/collection writes.

### Repository evidence

- src/collections/Pages.ts:30-35 — read: () => true with mutations guarded by canManageContent (mutations done, public read of drafts/all fields remains)
- src/collections/Dealerships.ts:5-7 — access declares only read: () => true; create/update/delete fall to Payload defaults, and internalNotes (:57-63) is publicly readable
- src/globals/SiteConfig.ts:10-12 — only read: () => true; no update policy declared
- src/collections/Media.ts:7-12 — public read with canManageMedia mutations; acceptable for served assets but must be ratified in the matrix
- src/collections/AnalyticsEvents.ts:8-9 — any authenticated user may update/delete raw analytics events

### Acceptance criteria

- [ ] internalNotes (and any other internal-only fields) are not readable anonymously via REST, GraphQL, or public routes
- [ ] SiteConfig updates require an explicit content-management role; anonymous and viewer-role writes are denied with tests
- [ ] Dealerships/Pages/Media/VehicleTags mutations are explicitly role-guarded — no collection relies on Payload defaults
- [ ] AnalyticsEvents update/delete require admin; the full per-collection allow/deny matrix passes in CI

## F006 — Lead and analytics ingestion hardening (WP-01D / P0-6)

**Classification:** `not_implemented`  
**User outcome:** Sales managers see leads and dashboard metrics that reflect real customer actions: one submission equals one lead, events cannot be spoofed or replayed, and management fields cannot be set by the public.  
**Business value:** Leads are the commercial output of the entire platform; today anyone on the internet can create arbitrary leads and analytics rows, poison metrics, or pre-set pipeline stages, making the dashboard untrustworthy for decisions.

### Repository evidence

- src/collections/Leads.ts:7-12 — create: () => true over the full schema; management fields stage/assignedTo/contactedBy/notes (:80-97) are client-settable on create
- src/collections/AnalyticsEvents.ts:5-10 — anonymous create over the full event schema; no idempotency, rate limiting, or server timestamps
- src/components/AnalyticsDashboard.tsx:107,123 — dashboard aggregates raw rows with a configurable ~300-row cap rather than trusted rollups
- No rate-limit or body-limit middleware exists on any public route (consultation static-analysis, consistent with live route files)

### Acceptance criteria

- [ ] Public raw create on leads and analytics-events collections is denied; only the narrow ingestion endpoints accept submissions
- [ ] A staging fixture journey produces exactly one lead and one conversion; replaying the identical request is idempotent
- [ ] Management fields (stage, assignedTo, contactedBy, notes) cannot be set through public ingestion and require sales-manager/admin roles to change
- [ ] Oversized bodies and burst traffic are rejected per configured limits, with tests
- [ ] Dashboard figures reconcile against a rollup/aggregation source rather than a row-capped raw scan

## F007 — Pages-only draft/version publishing proof (WP-04A)

**Classification:** `not_implemented`  
**User outcome:** Content editors can save a page as a draft, preview it while logged in, publish it deliberately, roll back to a previous version, and unpublish — with anonymous visitors never seeing unpublished work.  
**Business value:** Establishes the platform's first real publishing model on the lowest-risk entity, creating the pattern (and the earned confidence) for the higher-stakes homepage and vehicle-content models in M09.

### Repository evidence

- No versions/drafts configuration exists in any collection or global config — grep across src matches only a legacy vehicles migration's table names and unrelated UI labels
- src/collections/Pages.ts:28-48 — config has livePreview/preview URLs but ends without versions; status is a plain field, and read is public
- Consultation F4 — WP-04 as written mixes three publishing models plus an absent Storefront dependency; Pages must be proven first and alone

### Acceptance criteria

- [ ] A Page saved as draft is invisible to anonymous readers on every public path while remaining previewable to an authenticated editor
- [ ] Publishing makes exactly the approved version public; unpublishing removes it; rollback restores a prior version — each covered by tests
- [ ] The versions migration applies cleanly to staging and is reversible
- [ ] Existing published pages remain publicly visible and unchanged through the migration

## F008 — Tenant identity foundation (P0-7)

**Classification:** `requires_product_decision`  
**User outcome:** Each dealership group operates in its own isolated space — its users, vehicles, media, leads, and site configuration are invisible to and untouchable by other tenants.  
**Business value:** This is the platform bet: without a tenant boundary the product remains single-customer. The consultation blocks tenant-scoped media keys, seeded multi-tenant fixtures, and per-tenant publishing until this identity contract exists.

### Repository evidence

- src/payload.config.ts:107-123 — registered collections and globals contain no tenant model; plugins: [] at :167 (no multi-tenant plugin)
- Repository-wide search for tenant/Tenant across src returns no matches (verified live)
- Consultation F3 — tenant-dependent acceptance in WP-00/WP-02 is sequenced before tenant identity exists, forcing either temporary identities or remigration

### Acceptance criteria

- [ ] A written tenant contract (identity, membership, host resolution, backfill and rollback plan) is approved via D02 before schema work
- [ ] All existing data is assigned to the GBE tenant by a reversible, idempotent migration
- [ ] Tenant A cannot read or mutate tenant B's vehicles, media, leads, analytics, pages, or site config through any API path — proven by an A/B isolation test matrix in CI
- [ ] Host-derived tenant resolution selects the correct tenant context for public routes

## F009 — Durable media storage adapter and canonical write path (WP-02A)

**Classification:** `blocked_by_prerequisite`  
**User outcome:** Images uploaded through the CMS survive every redeploy and restart, and every new upload lands in exactly one canonical durable location.  
**Business value:** Vehicle photos are the product's core asset; local-filesystem uploads on serverless hosting are silently lost, and the parallel Supabase sync script leaves two competing sources of truth.

### Repository evidence

- src/collections/Media.ts:28 — upload: true with no storage adapter
- src/payload.config.ts:167 — plugins: [] confirms no storage plugin is configured
- scripts/sync-vehicle-images.mjs:321 — the out-of-band Supabase sync path treats direct vehicle URL updates as a legacy exception, evidencing the split contract
- Consultation F3 — tenant-derived object keys require tenant identity (F008/D02) first to avoid remigrating every object

### Acceptance criteria

- [ ] A file uploaded through Payload is retrievable byte-identical (hash-compared) after a full redeploy/restart
- [ ] Deleting the Media document removes or tombstones the stored object per the documented lifecycle
- [ ] All new vehicle imagery flows through the canonical Media relationship — no new direct imageUrl writes
- [ ] Object keys follow the agreed scheme from D02/D05

## F010 — Legacy media inventory, backfill, and cutover (WP-02B)

**Classification:** `blocked_by_prerequisite`  
**User outcome:** Every existing vehicle image is accounted for: legacy imageUrl values resolve to canonical durable media, nothing is lost in migration, and the old path is retired.  
**Business value:** Completes the single-source-of-truth media contract; until backfill reconciles, the storefront depends on unmanaged URLs that the CMS cannot govern, review, or guarantee.

### Repository evidence

- scripts/sync-vehicle-images.mjs — existing upload/verify/db-only modes demonstrate the legacy URL population that must be reconciled
- Consultation P0-2 remaining proof — 'reconcile every imageUrl/storage path to a canonical Media relationship' after adapter durability is proven
- F002's media inventory unknowns (unresolved imageUrl vs Media relations) are prerequisites for a verifiable reconciliation

### Acceptance criteria

- [ ] A reconciliation report accounts for 100% of legacy imageUrl values (migrated, already-canonical, or documented-orphan)
- [ ] Public and admin reads resolve imagery through canonical Media relationships
- [ ] The legacy direct-URL write path is removed or hard-deprecated with a guard
- [ ] Rollback plan exists and the backfill is idempotent

## F011 — Numeric pricing migration and backfill (WP-03A)

**Classification:** `not_implemented`  
**User outcome:** Vehicle prices are real numbers with a currency: sorting by price is correct, ranges filter accurately, and malformed price text can no longer reach the storefront.  
**Business value:** Price is the primary purchase-decision datum; text storage makes priceAsc/priceDesc lexicographic and blocks price filters and facets entirely (consultation P0-5).

### Repository evidence

- src/collections/Vehicles.ts:603-609 — price is type 'text' accepting numbers or ranges ('398900 or 599000 - 798500')
- src/collections/Vehicles.ts:300-302 — beforeValidate reformats price through formatMXN, still as text
- src/services/publicVehicleCatalog.ts:166-169 — priceAsc/priceDesc sort on the text column
- scripts/sanity-format-mileage.mjs (untracked) — evidence of ongoing numeric-formatting concerns in adjacent fields

### Acceptance criteria

- [ ] Every vehicle has priceAmount/currency populated or an explicit documented-null state; the backfill reconciliation report covers all rows
- [ ] Price sort and range filters over the numeric field return correct order for fixtures including 99,000 vs 100,000-style cases
- [ ] Publish gating requires a valid numeric price; malformed input is rejected at the API with tests
- [ ] Migration is idempotent, reversible, and never run against production during build-plan work

## F012 — Complete public catalog API: filters, sorts, facets, and collection parameters (WP-03B)

**Classification:** `partially_implemented`  
**User outcome:** Storefront shoppers can filter by price and color, sort by year ascending or true price, page through facet-counted results, and collection pages honor caller filters — all with deterministic results.  
**Business value:** The catalog is the storefront's engine; missing filters and silently-fallback sorts mean shoppers see wrong orderings today, and the Storefront cannot build honest UI controls against the current contract.

### Repository evidence

- src/services/publicVehicleCatalog.ts:79-101 — typed options cover brand/model/year/mileage/body/fuel/etc. but omit price and color
- src/services/publicVehicleCatalog.ts:164-181 — no yearAsc; mostViewed/mostClicked/mostLeads silently map to -createdAt
- src/app/(payload)/api/public/collections/[slug]/route.ts:22-25 — collection detail accepts only page/limit, ignoring all catalog filters
- src/services/publicVehicleCatalog.ts:206-228 — a solid typed where-builder foundation exists to extend

### Acceptance criteria

- [ ] Price range, color, and yearAsc are accepted and correct across list and collection endpoints, with fixture tests
- [ ] Facet counts match filtered result sets for every filterable dimension
- [ ] Collection detail honors the same filter/sort contract as the list endpoint
- [ ] Smart ranks are either removed or backed by trusted rollups per D04 — no silent fallback remains
- [ ] The expanded DTO/contract snapshot is frozen in CI

## F013 — Homepage and SiteConfig draft publishing (WP-04B)

**Classification:** `requires_product_decision`  
**User outcome:** Editors can stage homepage changes, preview them, and publish deliberately — hidden sections persist, and saving no longer instantly changes the live site.  
**Business value:** The homepage is the brand's front door; today every save publishes immediately and section visibility state evaporates on reload, making iteration on the live site risky.

### Repository evidence

- src/components/views/HomeBuilder.tsx:22-33 — saves POST directly to /api/globals/site-config; subtitle states 'Los cambios se publican al guardar' (:38)
- src/globals/SiteConfig.ts:7-23 — global has no versions/drafts and no update access policy
- src/components/admin-ui/SectionBuilder.tsx — hidden-section state is React-only (consultation-verified; component present live)
- Consultation F4 — SiteConfig needs the tenant-singleton representation decision (D02) before its publishing spike

### Acceptance criteria

- [ ] Saving homepage sections creates a draft that anonymous visitors do not see; publish is a separate explicit action
- [ ] Hidden-section state persists across reloads and sessions in the stored document
- [ ] Rollback restores a previous published homepage; unpublish falls back to defined behavior
- [ ] Editor UI copy no longer claims save-equals-publish

## F014 — Versioned vehicle presentation content (WP-04C)

**Classification:** `requires_product_decision`  
**User outcome:** Marketing content for a vehicle's landing page can be drafted, previewed, and rolled back independently of the vehicle's operational inventory state.  
**Business value:** Vehicle detail pages are the conversion surface; coupling their content to the live inventory record means every content edit is instantly live and unversioned, with no rollback after mistakes.

### Repository evidence

- src/collections/Vehicles.ts — landing/presentation fields live on the operational vehicle record; no versions config exists on the collection
- src/app/(payload)/api/public/vehicles/preview/[id]/route.ts:12 — authenticated preview of current (unversioned) data already works
- Consultation F4 — vehicle detail content 'currently shares the live inventory record'; D03 must decide its home before versioning

### Acceptance criteria

- [ ] Vehicle presentation content supports draft, authenticated preview, publish, and rollback without altering operational inventory state
- [ ] Publish-completeness enforcement (critical-issue blocking) continues to hold for the published surface
- [ ] The migration (if D03 chooses extraction) is reversible and reconciled against all existing vehicles

## F015 — Optimistic concurrency for vehicle workspace edits

**Classification:** `not_implemented`  
**User outcome:** Two editors working on the same vehicle can no longer silently overwrite each other; the second writer gets a conflict and the newer revision is preserved.  
**Business value:** Client-side dirty guards protect against accidental navigation but not against concurrent sessions or direct API writes — a real data-loss vector as the editing team grows (consultation F5).

### Repository evidence

- src/components/views/VehicleWorkspaceTab.tsx:781-796 — dirty-state and publish guards are client-side checks before the request
- PATCH requests carry no expected-version or If-Match value (consultation-verified request shape; save path at :750-779)
- src/collections/Vehicles.ts:358-363 — server-side publish gating exists and is a genuine but separate boundary

### Acceptance criteria

- [ ] A two-session stale-write test returns a conflict and preserves the newer revision
- [ ] Direct API writes without the precondition are rejected or explicitly exempted by documented policy
- [ ] The workspace UI surfaces conflicts with a recovery path instead of silent overwrite

## F016 — Admin style architecture isolation (P0-4 residual)

**Classification:** `partially_implemented`  
**User outcome:** Admin UI styling changes are safe and local: editing one view's styles cannot break another's, and visual regressions are caught by automated browser checks.  
**Business value:** The immediate duplicate-selector failure is fixed (style guard passes), but 8,721 lines of global CSS with partial guard coverage remain a regression engine that taxes every UI change; the consultation reclassifies this as staged architectural debt to pay after contracts stabilize.

### Repository evidence

- npm run check:admin-styles passes (consultation runtime-verified); scripts/check-admin-styles.mjs:25,92 guards only selected selector owners
- src/app/(payload)/custom.scss is 8,721 lines (verified live via wc -l), imported globally at src/app/(payload)/layout.tsx:10
- No *.module.css/scss files exist under src (consultation-verified)
- Uncommitted working-tree changes touch custom.scss and PrismaCMSLogo.tsx, showing the global file still accretes

### Acceptance criteria

- [ ] Style guard coverage extends to all admin view selector namespaces, passing in CI
- [ ] A measurable, sustained reduction of custom.scss (agreed target per phase) with view styles moved to scoped modules
- [ ] Browser visual-regression checks pass at the supported breakpoints for key admin views
- [ ] No new global selectors are added for new components (enforced by guard or lint rule)

## F017 — Storefront cross-repository contract gate

**Classification:** `blocked_by_prerequisite`  
**User outcome:** The storefront's filters, URL state, block rendering, live preview, and analytics emission verifiably match the Admin's contracts, so shoppers experience what editors configured.  
**Business value:** Every storefront-facing contract in this roadmap (catalog, DTOs, preview, analytics idempotency) is currently accepted only on the producer side; consumer mismatches would surface in production without this gate.

### Repository evidence

- Consultation Section 9 — Storefront catalog/filter behavior, analytics double-counting, and block/live-preview compatibility are all not-tested; GBECMS repository is absent from this workspace
- src/collections/Pages.ts:40-47 and src/globals/SiteConfig.ts:13-23 — livePreview/preview point at NEXT_PUBLIC_FRONTEND_URL, a contract only the Storefront can honor
- Consultation F7 — WP-03 controls/URL state cross the missing Storefront boundary

### Acceptance criteria

- [ ] GBECMS is captured at an exact SHA and its clean checks pass in the shared gate
- [ ] Every registered block type renders (and unknown blocks degrade safely) under shared contract fixtures
- [ ] A storefront fixture journey produces exactly one lead and reconciled analytics rows via idempotency IDs
- [ ] Storefront filter/URL state round-trips match the frozen catalog contract
