# Master product roadmap consultation — authoritative synthesis

This is the authoritative scope input for a new Fable **master product blueprint**.
It reconciles the repository audits, verified Supabase evidence, current stabilization
blueprint, AGIREAL component inventory, the roadmap-alignment audit, and the product
owner's latest decisions.

The output must be a complete product roadmap, not merely a stabilization plan. The
existing single-site stabilization blueprint remains valid foundation work and must be
incorporated as the earliest milestones rather than overwritten or discarded.

## 1. Authority and conflict resolution

Use sources in this order when they conflict:

1. The confirmed product-owner decisions in
   `docs/product/inputs/HUMAN_PRODUCT_DECISIONS_20260710.md` and the decisions below.
2. Live/repository evidence in
   `docs/product/inputs/SUPABASE_LIVE_READONLY_AUDIT_20260710_VERIFIED.md`.
3. The revised stabilization blueprint under
   `docs/product/roadmaps/gbe-single-site-homepage-roadmap-20260710/`.
4. Reusable component guidance in
   `docs/product/inputs/AGIREAL_REUSE_MATRIX.md`.
5. Useful product-coverage and sequencing findings from
   `C:/Users/Kecin/Downloads/FABLE_ROADMAP_ALIGNMENT_AUDIT.md`.

The alignment audit's multi-agency and tenant recommendations are explicitly rejected.
Accept its valid omissions and sequencing findings without restoring tenancy or
changing the homepage-first product decision.

## 2. Confirmed product model

- This is one GBE platform and one primary GBE public website.
- Payload remains the CMS, domain workflow, auth, and API foundation.
- Supabase Postgres is the authoritative hosted database.
- Supabase Storage is the target durable byte store behind canonical Payload Media.
- Dealerships are inventory/location references used for filters, nearest-location
  guidance, routing, and approved optional off-site links.
- GBE does not create, manage, theme, host, or control separate dealership websites.
- The three target business roles are `admin`, `general`, and `sales`; missing or
  invalid roles grant no privilege.
- The primary homepage is the first major customer-facing product priority.
- Spanish/Mexico behavior is the product default.

### Explicit non-goals

Do not add tenant accounts, tenant memberships, tenant switching, tenant-specific
pages, tenant domains, tenant themes, tenant storage prefixes, tenant billing,
self-service tenant onboarding, dealership site builders, or multi-agency isolation.
Also avoid expansion into a DMS, financing platform, trade-in platform, VIN system,
or comprehensive vehicle-spec database.

## 3. Foundation work that must be preserved

Preserve and refine the foundation features already established:

- read-only operational truth capture and private user-role mapping;
- fail-closed three-role migration and authorization matrix;
- public DTO and raw REST/GraphQL boundary hardening;
- lead/analytics ingestion protection;
- canonical Supabase Storage-backed Payload Media;
- legacy media reconciliation;
- numeric pricing and catalog query correctness;
- homepage draft/preview/publish/unpublish/rollback/concurrency;
- generic Pages publishing after the homepage;
- vehicle presentation-content decision and concurrency;
- admin style containment;
- pinned Storefront contract and release verification.

Apply these sequencing corrections:

1. Establish a **baseline CI slice before the critical role migration**: clean Node 22
   install, style, typecheck, lint, build, migration/static checks, and a minimal test
   runner. Expand it with role/security fixtures as the role feature lands.
2. The incomplete F002 live SQL capture blocks only migrations that require its
   outputs; it must not block clean-repository CI, source pinning, documentation,
   design-system inventory, or Storefront baseline capture.
3. Homepage builder mechanics may be implemented before media reconciliation, but a
   public launch using uploaded/legacy media requires durable media and reconciliation.
4. The final Storefront release gate must depend on canonical durable media and, where
   existing images are consumed, legacy reconciliation.
5. Remove the obsolete tenant feature from the active feature list. Preserve the
   rejected decision in a decision log only.
6. Pin clean Admin and Storefront SHAs before approving an implementation layer.
   Existing dirty changes must be deliberately reviewed, saved, or discarded first.

## 4. Required master-product capabilities

Every workstream below must appear as explicit features/milestones with bounded
dependencies and acceptance outcomes. Do not hide them under a generic future note.

### A. Reproducible delivery foundation

- Clean, pinned Admin and Storefront baselines.
- Node 22 CI for both applications.
- Shared contract/block drift checks.
- Staging database/storage, backup/restore, migration rehearsal, abort thresholds,
  rollback triggers, evidence paths, and named release ownership placeholders.
- Early Storefront baseline capture plus a final cross-repository release gate.

### B. Security, roles, and authentication operations

- Three-role fail-closed permission matrix and private per-user mapping.
- Negative REST, GraphQL, Local API, and custom-route tests.
- Login, logout, session behavior, password reset request/completion/expiration,
  staged email delivery, invite acceptance/privilege enforcement, and break-glass
  administrator recovery.
- Rate limits, request limits, idempotency, and auditability for cost-bearing and
  commercial endpoints.

### C. Inventory-first operating workflow

- CSV/XLSX imports and agent-assisted imports.
- Column mapping, normalization, duplicate detection, dry run, row errors,
  idempotency, rollback, and human approval before commit.
- Approximately 1,400-vehicle scale characterization.
- Image association and approval, completeness scoring, review queues,
  publish/unpublish lifecycle, inventory aging, and exposure signals.
- Inventory remains the operational spine even though the homepage is the first major
  public-experience priority.

### D. Primary homepage and Builder V2

- `site_config` becomes the sole homepage source of truth after reviewed legacy
  `home/home_stats/home_brands` reconciliation.
- Draft, unsaved/authenticated preview, publish, unpublish, rollback, version history,
  and optimistic concurrency.
- Persisted hide/show and ordering; duplicate/delete; drag/reorder if justified;
  responsive mobile/tablet/desktop preview.
- Reusable sections/templates and media selection.
- One versioned block registry/schema with editor, preview, Storefront renderer,
  migrations, analytics identity, test fixtures, and explicit unknown-block behavior.
- SEO fields, metadata rendering, and page/block/placement analytics identifiers.
- Generic Pages and vehicle presentation content adopt the proven model later.
- Safe vehicle presentation editing is required; the open decision is whether it lives
  in a separate versioned related model or on Vehicles, with separation preferred.

### E. Dedicated operator console

- A dealer/operator product surface outside the stock Payload Admin layout and global
  CSS boundary, using an isolated route/app shell and product-owned design system.
- Navigation, search/commands, breadcrumbs, notifications, loading, empty, error,
  degraded-provider, permission-denied, responsive, keyboard, and accessibility states.
- Incremental migration of inventory, vehicle workspace, import/review, homepage and
  page builder, media, leads, analytics, and AI Studio.
- Native Payload Admin remains available to administrators for data repair, advanced
  support, and fallback operations.
- CSS modules inside Payload are interim containment, not the destination architecture.

### F. Modern main GBE Storefront

- Modern homepage, catalog, and vehicle-detail journeys using shared contracts.
- Dynamic brand/model/location/dealership information from the backend.
- Accurate new/used/Seminuevos navigation and filters, complete deterministic sorts,
  collections/facets, useful no-result states, and shareable URL state.
- Vehicle galleries, condition/trust modules, related inventory, recently added,
  opportunity/availability signals, and mobile conversion behavior.
- Approved external dealership links are supplemental routing, not an automatic
  replacement for GBE-owned measurable conversion flows.
- Real 404s, observable degraded mode, no plausible demo inventory in production,
  accessibility, performance/Core Web Vitals, canonical URLs, dynamic metadata,
  sitemap, robots, JSON-LD, and local SEO.

### G. Durable AI Media Studio

- Port/complete the existing vehicle image workshop and hidden banner/promo/social
  workspace into the operator console.
- Provider abstraction, durable queued jobs, cancellation, timeouts, retries,
  idempotency, concurrency limits, cost reservation/ledger, quotas, safety/moderation,
  provenance, and auditable failure states.
- Text-to-image and image editing, before/after comparison, crop/aspect variants,
  approve/reject, canonical Media save, and proposed attachment to a draft vehicle or
  page block. Never auto-publish.
- Selectively adapt AGIREAL brand/image/artifact/approval components pinned in the
  reuse matrix. Replace demo providers, client-only persistence, simulated execution,
  and permissive rate-limit fallbacks.

### H. Inventory assistant and controlled agents

- Typed orchestrator routing to inventory, merchandising, media, lead, and analytics
  specialists where useful.
- Inventory agent reads an import, maps columns, normalizes data, detects duplicates,
  validates images/pricing, prepares an exact diff, and commits only after durable
  human approval.
- Agent tools call the same role-aware domain services as the operator UI; never raw
  collection writes.
- Approval binds actor, exact proposed action/diff, expiration, and idempotency key.
- No agent publishes automatically or bypasses roles, media policy, or endpoint limits.

### I. Leads, WhatsApp, and sales workflow

- Narrow validated lead ingestion, bot/rate protection, idempotency, server timestamps,
  and management-field protection.
- GBE-owned lead capture and dealership/city-aware WhatsApp handoff, with approved
  external links used where the business chooses.
- Lead inbox, assignment, stage/status, response tracking, response SLA, routing
  outcomes, delivery/handoff logs, and deduplicated conversion.
- The exact balance between GBE capture, WhatsApp, and off-site redirects remains a
  human conversion-strategy decision.

### J. Trusted analytics and dealer-focused reporting

- Separate bounded session and visitor IDs, consent/privacy and retention rules,
  source/UTM/campaign attribution, bot filtering, idempotent events, and trusted rollups.
- Page/section impressions, vehicle-card impressions/clicks by placement,
  search/filter/no-result behavior, vehicle-detail engagement, lead open/submit,
  WhatsApp/off-site handoff, and destination dealership/location.
- Dealer-facing views: visitors/qualified sessions, exposure and click-through,
  leads/WhatsApp conversion, top/underexposed vehicles, conversion by page/block/
  placement/source/city/dealership, no-result demand, inventory aging, and response SLA.
- Smart ranks remain removed/hidden until trusted rollups exist.

### K. Shared contracts and repository architecture

- Establish one source for public DTOs, catalog options, block schemas/migrations,
  renderer registry, analytics event types, and test fixtures.
- Produce a bounded monorepo/shared-package migration decision and route. Do not let a
  large repository move block urgent security, homepage, or media fixes.
- Admin/platform and Storefront remain independently deployable.

## 5. Required roadmap shape

Use a dependency-aware structure resembling:

1. Baseline/source pinning and minimum CI.
2. Operations evidence plus three-role/security closure.
3. Durable media and inventory/catalog integrity foundations.
4. Homepage publishing and Builder V2 foundations.
5. Dedicated operator-console shell and incremental workflow migration.
6. Modern main GBE Storefront.
7. AI Media Studio and inventory assistant/controlled agents.
8. Leads/WhatsApp and trusted analytics product.
9. Operational hardening and launch evidence.

Parallel planning/design tracks may begin early when they do not mutate shared
contracts, but Fable implementation approval remains one bounded layer at a time.

## 6. Human decisions that must remain explicit

- Exact permission matrix for admin/general/sales.
- Private mapping of each current user to a target role.
- Which legacy homepage content is retained in `site_config`.
- Exact Storefront repository and pinned SHA.
- Completion channel/owner for blocked read-only Supabase SQL evidence.
- Vehicle presentation model (separate versioned model preferred).
- Primary conversion strategy: GBE lead form, WhatsApp handoff, approved off-site
  redirect, and the rules for choosing among them.
- Operator-console route/deployment boundary and migration cadence.
- Shared-package/monorepo migration timing.
- AI providers, budgets, moderation policy, and approval owners.

Do not elevate engineering-default choices into blocking business decisions when a
safe default exists. Remove misleading smart ranks until trusted rollups rather than
blocking the roadmap on that choice.

## 7. Evidence and output contract

- Reconcile every material claim against the live repository and supplied evidence.
- Label live-MCP facts, repository-static facts, and remaining unknowns honestly.
- Preserve the current stabilization blueprint as a foundation subset and state how
  its features map into the master roadmap.
- Include explicit product features for operator console, Builder V2, Storefront
  modernization, AI Media Studio, inventory assistant, WhatsApp/leads, analytics,
  authentication operations, and shared contracts.
- Ensure durable media is a dependency of public launch acceptance.
- Ensure baseline CI precedes the critical role migration.
- Ensure no active or deferred tenant feature exists.
- Include AGIREAL only as selective reference inputs with the reuse matrix's safety
  constraints.
- Produce schema-valid Fable blueprint artifacts and stop at human review. This input
  grants no implementation, migration, commit, push, deployment, or production-change
  authorization.
