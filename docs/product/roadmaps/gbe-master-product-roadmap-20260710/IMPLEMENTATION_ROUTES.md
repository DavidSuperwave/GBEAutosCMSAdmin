# Implementation Routes

## F001 — Three-role fail-closed migration (admin/general/sales) replacing the live six-role enum

### Recommended route

After D01 (matrix) and D02 (per-user mapping) are approved, F018's baseline CI exists to host the proof, and M02's role-distribution capture is archived: (1) write a reviewed, idempotent, transactional migration altering the live role enum to admin/general/sales applying the explicit mapping, aborting if any user remains unmapped, with pre-migration export and rollback plan — staging first, never production during build work; (2) rewrite src/access/roles.ts to the three-role model with getRoles returning no roles for missing/invalid values; (3) sweep every consumer (roles.ts helpers, cmsRequestAuth callers, collection and field access, admin UI role options, invite flow, import/workshop/media-review route guards) to the new matrix; (4) add focused security tests with roleless/invalid-role/each-role fixtures asserting deny-by-default.

### Rejected alternatives

- Flip getRoles to fail-closed without the enum migration and mapping — rejected: would lock out or silently demote real staff; the audit requires the private human mapping first
- Automatically map legacy roles to general/sales by heuristic — rejected: the audit states no legacy role can be automatically mapped; it is a private human decision
- Keep the six-role model and just remove the fallback — rejected: contradicts the confirmed three-role product decision and would require a second migration later

**Dependencies:** F002, F018  
**Risk:** `critical`  
**Confidence:** `high`

## F002 — Operations truth capture — complete the blocked read-only live facts

### Recommended route

Per D06: an authorized operator reruns the audit's four read-only SQL blocks through the same Supabase MCP project (or dashboard SQL editor), returning catalog/aggregate output only — no identities, object names, URLs, or secrets — plus a name-only payload_migrations listing. Archive timestamped outputs beside the verified audit as the evidence pack feeding D02 (role mapping), F009 (bucket identity/restrictions), F010 (media reconciliation counts), F011 (price quality), and F013 (homepage completeness). The per-user identity mapping happens in a separate private human process.

### Rejected alternatives

- Use local .env/psql credentials for live facts — rejected: the audit's invariants forbid it; capture must stay within the authorized read-only channel
- Proceed to migrations with table-level row estimates only — rejected: the role migration must abort on unmapped users and the price backfill needs exact quality counts; estimates cannot gate either
- Let F002 block the whole roadmap — rejected: the consultation's sequencing correction limits its blocking scope to migrations that consume its outputs

**Dependencies:** None  
**Risk:** `high`  
**Confidence:** `high`

## F003 — Expanded security-test harness on the baseline CI

### Recommended route

Extend the F018 baseline pipeline with the F001 security suite: role fixtures for each target role plus roleless/invalid fixtures, negative tests across raw REST, GraphQL, Local API, and every custom route (import run, workshop generate, media review/assign, invite, previews), running against an ephemeral or explicitly authorized staging Postgres — never production. Wire as required checks with retained artifacts. Browser regression lands later with F016/F026 work.

### Rejected alternatives

- Adopt a heavy browser E2E framework first — rejected: the immediate need is security enforcement; browser regression is sequenced with style/console work
- Run CI tests against the live Supabase project — rejected: the database is live production data; tests must use ephemeral or explicitly authorized staging infrastructure

**Dependencies:** F001, F018  
**Risk:** `medium`  
**Confidence:** `high`

## F004 — Vehicle raw/public/preview boundary contracts under the three-role model

### Recommended route

After F001/F003: freeze public vehicle and collection DTO snapshots as contract tests; add negative tests proving anonymous raw REST and GraphQL reads are denied for vehicles, collections, and media assets; verify published/non-sold/approved-media enforcement across list, detail, collection, and preview paths; rewrite preview guards to the target roles; document/pin canonical status fields (publish_status, inventory_status) and schedule legacy status/_status reconciliation alongside F010-style cleanup.

### Rejected alternatives

- Unmount raw REST/GraphQL entirely — rejected for now: the admin UI consumes the REST API; the boundary must be proven at the access layer regardless, with GraphQL disablement a possible follow-up hardening
- Treat the boundary as done based on current code — rejected: the fail-open fallback made prior claims unverifiable and no tests exist

**Dependencies:** F001, F003  
**Risk:** `high`  
**Confidence:** `high`

## F005 — Content and reference access closure with a safe public dealership DTO

### Recommended route

Prioritize the homepage-relevant closure first (SiteConfig explicit update policy per the D01 matrix, Pages read scoping, dealership field protection and DTO) so F013 can proceed, then complete the rest: add an approved externalUrl field to Dealerships with admin-controlled approval semantics; split public consumption onto a bounded dealership DTO; declare explicit role-guarded mutations for Dealerships/Pages/Media/VehicleTags; make AnalyticsEvents update/delete admin-only; land every policy with allow/deny matrix tests across REST, GraphQL, and custom routes.

### Rejected alternatives

- Make Dealerships fully private — rejected: the storefront needs location/contact/routing data; the fix is field-level protection plus a bounded DTO
- Defer the dealership external URL to a later feature — rejected: it is a confirmed product requirement for visitor routing and belongs with the DTO design
- One monolithic access commit without tests — rejected: repeats the unverifiable-boundary pattern the audits flagged

**Dependencies:** F001, F003  
**Risk:** `high`  
**Confidence:** `high`

## F006 — Lead and analytics ingestion hardening

### Recommended route

Replace public raw-collection creation with narrow ingestion endpoints: strict whitelisted submitter fields, server-assigned timestamps/source, idempotency keys making replays no-ops, body-size limits, and rate limiting; deny public create on the raw collections; restrict management-field mutation to the D01 sales-capable role; base dashboards on server-side rollups (F036) instead of capped raw scans. Prove with fixture journeys (one submission produces exactly one lead; replay is a no-op).

### Rejected alternatives

- Captcha only — rejected: does not address replays, management-field injection, or authenticated tampering
- Filter garbage at read time while keeping raw public create — rejected: poisoned rows would still accumulate; the audit requires ingestion-time validation and idempotency

**Dependencies:** F001, F003, F005  
**Risk:** `high`  
**Confidence:** `high`

## F007 — Generic Pages draft/version publishing (after the homepage proof)

### Recommended route

After F013 establishes the pattern: enable Payload versions with drafts on Pages (with migration), scope public read to published versions, replace manual status/isVisible fields, wire authenticated draft preview through existing livePreview URLs, run the orphan-child integrity check from F002's exact counts, and add tests for draft non-visibility, publish, unpublish, rollback, and history.

### Rejected alternatives

- Prove publishing on Pages before the homepage — rejected: the confirmed product priority is the primary GBE homepage
- Custom draft flags instead of Payload versions — rejected: native versions provide rollback and draft-preview semantics without bespoke maintenance

**Dependencies:** F003, F005, F013  
**Risk:** `medium`  
**Confidence:** `high`

## F009 — Durable media: Supabase Storage behind the canonical Payload Media service

### Recommended route

After F002 captures bucket identity/visibility/restrictions and F019 provides staging: configure a Payload storage adapter targeting Supabase Storage (S3-compatible or Supabase-specific), route all new Media writes through it under a stable single-site key convention, keep Payload media relationships as canonical asset identity (never direct Storage public URLs), and prove durability on staging: upload a hashed fixture, redeploy, retrieve and hash-compare, then delete and verify lifecycle. Object changes go through the Storage API, never direct metadata-table writes.

### Rejected alternatives

- Extend sync-vehicle-images.mjs as the durability mechanism — rejected: out-of-band, service-role-privileged, and perpetuates the dual source of truth
- A different object-storage provider — rejected: Supabase Storage is the confirmed human decision and the audit found no live incompatibility

**Dependencies:** F002, F018, F019  
**Risk:** `high`  
**Confidence:** `high`

## F010 — Media reconciliation and legacy image-path retirement

### Recommended route

Only after F009's durability proof and F002's object/relationship aggregates: enumerate all legacy image fields and Storage objects, backfill each to canonical Media documents, produce a reconciliation report (matched, migrated, orphaned, failed), cut consumer reads over to the canonical relationship, retire legacy columns from write paths, and decommission or fence sync-vehicle-images.mjs behind the canonical service.

### Rejected alternatives

- Big-bang cutover without a reconciliation report — rejected: unverifiable against live production imagery
- Leave legacy URLs indefinitely beside canonical media — rejected: preserves the dual contract and the competing write path

**Dependencies:** F009  
**Risk:** `high`  
**Confidence:** `high`

## F011 — Numeric pricing migration and human-reviewed backfill

### Recommended route

Using F002's price-quality aggregates and F019's staging: add numeric priceAmount (plus priceMax for ranges) and currency fields; run a human-reviewed classification of ambiguous/range/invalid source values before an idempotent backfill migration with a reconciliation report; keep the display string derived, not authoritative; update publish gating and admin UI to the numeric fields; hand the catalog switch to F012.

### Rejected alternatives

- Parse text price at query time — rejected: cannot index, sort, or facet correctly and leaves malformed data unfixed
- Overwrite the text field in place — rejected: destroys range/display semantics and complicates rollback; additive migration is safer
- Automatic classification of ambiguous prices — rejected: the audit requires human-reviewed classification before backfill

**Dependencies:** F002, F018, F019  
**Risk:** `high`  
**Confidence:** `high`

## F012 — Complete public catalog: filters, deterministic sorts, facets, and parameterized collections

### Recommended route

After F011: extend the option set with numeric priceMin/priceMax, color, and yearAsc; implement facet counts for filterable dimensions; thread the full option set through the public collection route; remove the smart ranks (mostViewed/mostClicked/mostLeads) from the public contract until trusted rollups from F036 exist — per the consultation this is the engineering default, not a blocking business decision; freeze the expanded contract with fixture tests covering every filter, sort, pagination edge, and facet count.

### Rejected alternatives

- Implement Storefront UI controls here — rejected: the consumer lives in the separate Storefront repository and is delivered by F028 and verified via F017
- Keep the silent smart-rank fallback — rejected: a public contract claiming analytics ordering while returning newest is misleading; the consultation directs removal until trusted rollups exist

**Dependencies:** F004, F011  
**Risk:** `medium`  
**Confidence:** `high`

## F013 — Primary GBE homepage publishing on site_config with legacy home retirement

### Recommended route

After F001, the homepage-relevant slice of F005, and F018's CI: enable Payload versions/drafts on the SiteConfig global (with migration); convert HomeBuilder and the SiteConfig admin flow to save drafts and publish explicitly with authenticated preview via existing livePreview URLs; add unpublish/rollback and optimistic-concurrency behavior with tests; reconcile legacy home content per D03, export/backup it, then retire the home/home_stats/home_brands tables and delete the unregistered src/globals/Home.ts; schedule old flat site_config column cleanup in the same migration series. Builder mechanics may proceed before media reconciliation, but any public launch consuming uploaded/legacy media requires F009/F010 (enforced at F017).

### Rejected alternatives

- Client-side staged-save emulation in HomeBuilder — rejected: leaves the raw global endpoint publishing on save; the model, not the UI, must carry draft semantics
- Register the legacy Home global and merge models — rejected: site_config is the confirmed single source of truth
- Block homepage mechanics on media reconciliation — rejected: the consultation permits builder mechanics first, gating only public launch on durable media

**Dependencies:** F001, F005, F018  
**Risk:** `high`  
**Confidence:** `high`

## F014 — Safe versioned vehicle presentation editing (required; model shape per D07)

### Recommended route

Resolve D07 first (separate versioned related collection is the preferred default). Implement the chosen model reusing the publishing test pattern from F013/F007, keeping publish-completeness gating intact and wiring the vehicle workspace and Builder V2 editing surfaces to the versioned model.

### Rejected alternatives

- Treating safe vehicle-page editing as optional — rejected: the consultation requires the capability; only the model shape is open
- Versioning Vehicles without deciding the content/operations split — rejected: would version operational churn alongside content, polluting history and rollback semantics

**Dependencies:** F007  
**Risk:** `medium`  
**Confidence:** `medium`

## F015 — Optimistic concurrency for vehicle workspace and publishing flows

### Recommended route

Add a version/updatedAt precondition to workspace saves: the client sends the revision it loaded; a server hook rejects stale writes with a conflict response; the UI surfaces the conflict and offers reload-and-merge. Scope to the vehicle workspace first, sharing the mechanism F013 introduces for homepage publishing.

### Rejected alternatives

- Rely on Payload versions as the concurrency mechanism — rejected: versions give history, not write-time conflict detection
- Pessimistic locking — rejected: heavier UX and stale-lock cleanup burden for a small team

**Dependencies:** F013, F018  
**Risk:** `medium`  
**Confidence:** `high`

## F016 — Interim admin style containment inside Payload (destination is the operator console)

### Recommended route

Treat the passing style guard as the containment baseline; expand guard ownership coverage to all admin view selector namespaces; migrate styles into scoped CSS modules only where a view will remain inside Payload long-term or where active collisions bite; stop growing custom.scss (guard or lint rule); direct primary styling investment to the operator console design system (F026), retiring each custom.scss section as its workflow migrates (F027).

### Rejected alternatives

- Big-bang rewrite of custom.scss — rejected: highest-regression-risk move on a live admin whose views are scheduled to migrate out anyway
- Treating CSS-module decomposition as the destination architecture — rejected: the consultation designates the isolated operator console as the target; heavy in-Payload investment would be discarded

**Dependencies:** F018  
**Risk:** `medium`  
**Confidence:** `high`

## F017 — Cross-repository release gate: Storefront verification at the pinned SHA with durable-media launch dependencies

### Recommended route

Once D05 supplies the pinned SHA and F020's baseline capture exists: run the Storefront's clean checks; verify published homepage and navigation rendering from site_config under shared block fixtures (unknown blocks degrade safely), published-inventory and media resolution through canonical durable contracts including a storage durability check in the release journey, approved dealership external-link redirects, preview isolation, and analytics deduplication via idempotency IDs; wire these as a cross-repository CI gate with named release ownership, abort thresholds, rollback triggers, and archived evidence paths required before public acceptance.

### Rejected alternatives

- Accepting carried-forward Storefront claims as verified — rejected: all Storefront conclusions are explicitly unvalidated
- Gating launch only on contract tests without durable media — rejected: the consultation makes durable media and legacy reconciliation hard launch dependencies
- Duplicating storefront rendering inside the Admin repo for testing — rejected: diverges from the real consumer and gives false confidence

**Dependencies:** F004, F006, F009, F010, F012, F013, F020, F028, F029  
**Risk:** `high`  
**Confidence:** `medium`

## F018 — Pinned clean baselines and Node 22 baseline CI slice (before the role migration)

### Recommended route

First deliberately review, save, or discard every dirty and untracked change on codex/admin-workflow-updates, then pin the clean Admin SHA (and record the Storefront SHA under D05) with lockfile hashes. Add a Node 22 CI workflow running npm ci, check:admin-styles, tsc --noEmit, lint, next build, a migration/static check (registered migrations parse and index cleanly), and a minimal test runner with one smoke test — no role/security fixtures yet (those expand in F003 as F001 lands). Record deploy/environment mappings. This explicitly does not wait on F002's blocked SQL captures.

### Rejected alternatives

- Sequencing CI after the role migration (the prior blueprint's F001-then-F003 order) — rejected: the consultation's sequencing correction requires the baseline slice first so the critical migration is developed inside the harness
- Blocking baseline CI on F002 — rejected: the consultation states the incomplete SQL capture must not block clean-repository CI, source pinning, or documentation
- Adopting browser E2E in the baseline slice — rejected: keeps the slice minimal and fast; browser coverage lands with later UI features

**Dependencies:** None  
**Risk:** `medium`  
**Confidence:** `high`

## F019 — Staging environment, backup/restore, and migration-rehearsal infrastructure

### Recommended route

Provision a staging Supabase project (database plus Storage bucket) seeded from a sanitized production snapshot; script backup/restore and verify a full restore actually works; define the migration-rehearsal runbook — rehearse on staging, record evidence, then apply to production inside a maintenance window with abort thresholds and rollback triggers; add named release-ownership placeholders to every migration work package; wire the staging database as the target for CI security suites (F003) and durability proofs (F009).

### Rejected alternatives

- Rehearse migrations on a local Postgres only — rejected: local Postgres does not reproduce Supabase RLS, grants, Storage, or extension behavior that the audits flagged as unknowns
- Trust Supabase's automatic backups without a tested restore — rejected: an unverified restore path is not a rollback plan

**Dependencies:** F018  
**Risk:** `high`  
**Confidence:** `high`

## F020 — Early Storefront baseline capture and shared contract/block drift checks

### Recommended route

Once D05 pins the SHA: check out the Storefront at that commit; inventory every Admin API route, DTO field, block type, and analytics event it consumes; record its clean build/check status; add a cross-repository drift check (initially a scripted contract-fixture comparison, upgraded by F038's shared package) that fails when Admin contracts change fields or blocks the Storefront consumes; archive the capture as the baseline for F028/F029 modernization scoping and the F017 gate.

### Rejected alternatives

- Waiting for the final F017 gate to look at the Storefront — rejected: consumer mismatches would surface at launch instead of during development
- Assuming the Storefront consumes contracts as documented — rejected: no consumer-side evidence exists in this workspace; capture must be empirical

**Dependencies:** F018  
**Risk:** `medium`  
**Confidence:** `high`

## F021 — Authentication operations: login, reset, staged email, invites, and break-glass recovery

### Recommended route

After F001 fixes role semantics: configure explicit auth options (login attempt limits, lock time, token expiration); make email delivery a checked precondition in staging with a delivery test; add tests for login/logout/session expiry, reset request/completion/expiration, and invite creation/acceptance proving the invited account receives exactly the intended role and no more; document and rehearse a break-glass administrator recovery procedure (out-of-band, staged); rate-limit login, reset, and invite endpoints under F022's mechanism.

### Rejected alternatives

- Replace Payload auth with an external identity provider — rejected: Payload remains the confirmed auth foundation; the gap is operational proof, not the auth engine
- Keep silent SMTP degradation — rejected: an invite or reset that silently sends nothing is an operational trap for account recovery

**Dependencies:** F001, F003  
**Risk:** `medium`  
**Confidence:** `high`

## F022 — Rate limits, request limits, idempotency, and auditability for cost-bearing and commercial endpoints

### Recommended route

Introduce one server-side limiting/idempotency layer (store-backed, failing closed when the store is unavailable) applied to: AI generation and provider search, import run, invite, auth endpoints (with F021), and the F006 public ingestion routes; add per-route request-size caps; assign idempotency keys to every cost-bearing or state-creating request; write an audit record (actor, route, key, outcome) for privileged and cost-bearing invocations; cover limits and replay behavior with tests.

### Rejected alternatives

- Per-route ad-hoc counters — rejected: inconsistent semantics and no shared audit trail; one policy layer is testable
- A rate limiter that fails open when its backing store is down — rejected: explicitly prohibited by the reuse-matrix adaptation rules for cost-bearing operations

**Dependencies:** F001, F003  
**Risk:** `high`  
**Confidence:** `high`

## F023 — Governed import pipeline: dry run, human approval, idempotency, rollback, and ~1,400-row scale proof

### Recommended route

Refactor to a staged job lifecycle using the already-declared states: upload/parse server-side (retiring the hand-rolled client CSV parser in favor of the declared csv-parse dependency or the xlsx path), validate and normalize into a persisted dry-run report (status validating then ready) with row errors, duplicate detection, and an exact proposed diff; require explicit human approval bound to the job before commit (status importing then completed) under an idempotency key so re-submission cannot double-import; implement rollback from createdVehicleIds plus recorded updates (status rolled_back); characterize a full ~1,400-row import on staging for duration, memory, and error behavior. This service becomes the exact surface the F033 inventory agent drives.

### Rejected alternatives

- Keep client-side parsing and inline commit with a confirmation dialog — rejected: a browser confirm is not a durable approval and leaves no dry-run evidence or idempotency
- Rebuild imports on AGIREAL spreadsheet-artifact components — rejected: the reuse matrix explicitly forbids replacing existing GBE import normalization/mapping/validation services; AGIREAL supplies only preview/grid UI ideas later

**Dependencies:** F001, F003, F019  
**Risk:** `high`  
**Confidence:** `high`

## F024 — Inventory operations: review queues, image association approval, completeness, lifecycle, aging, and exposure signals

### Recommended route

Build on the existing workflow services: add a review queue keyed to import jobs and needs_review status feeding the triage view; keep image association on the proven vehicle-media-assets approval pipeline; add aging fields (listedAt, daysInStock derived) with queue and dashboard surfacing; derive exposure signals (impressions/clicks per vehicle) from trusted analytics rollups once F036 lands — exposure signals are explicitly gated on F036 and ship with placeholder states until then; extend publish/unpublish lifecycle reporting to the operations dashboard.

### Rejected alternatives

- Computing exposure from the current raw analytics events — rejected: ingestion is publicly spoofable and dashboards cap at 300 raw rows; exposure signals built on untrusted data would mislead operators
- A separate queue data model divorced from ImportJobs and publishStatus — rejected: the lifecycle fields already exist; a parallel model would create a second source of truth

**Dependencies:** F001, F003, F023  
**Risk:** `medium`  
**Confidence:** `high`

## F025 — Builder V2: versioned block registry and the complete editor contract

### Recommended route

After F013 proves publishing and F038 establishes the contracts source: define one versioned block registry (schema version per block type) generating the editor library, preview components, Storefront renderer expectations, migration requirements, analytics identity (page/block/placement IDs), and test fixtures; add persisted hide/show and ordering, duplicate/delete, and drag/reorder if usability testing justifies it; implement responsive preview breakpoints in the builder; add reusable sections/templates and a media selector backed by canonical Media; add SEO fields with metadata rendering on the published surface; define explicit unknown-block degradation for both editor and renderer; extend the proven model to generic Pages (F007) and vehicle presentation (F014).

### Rejected alternatives

- Keep hand-mirrored block libraries and serializers — rejected: three parallel definitions of every block already drift today and defeat the single-registry requirement
- Adopt a third-party page-builder product — rejected: the block model is already established in Payload and the Storefront consumes it; a builder product would replace working foundations with a new integration surface

**Dependencies:** F013, F038  
**Risk:** `high`  
**Confidence:** `medium`

## F026 — Dedicated operator console shell with a product-owned design system

### Recommended route

Per the D09 boundary decision (default recommendation: an isolated route group in this Next.js app with its own root layout importing zero Payload Admin CSS): establish the console shell with design tokens, scoped styling (CSS modules or equivalent), navigation, global search/commands, breadcrumbs, and a notification surface; port the admin-ui kit primitives into the owned design system with explicit loading/empty/error/degraded/permission-denied states, responsive breakpoints, keyboard navigation, and accessibility checks; authenticate against the same Payload session with D01 role enforcement; selected AGIREAL chat/artifact/task UI primitives may be evaluated only after this design-system boundary exists, per the reuse matrix.

### Rejected alternatives

- Continuing to build operator features as Payload custom views with CSS modules — rejected: the consultation explicitly marks in-Payload containment as interim, not the destination
- A separately hosted operator application immediately — possible under D09 but not the default: it doubles deployment surface before the console proves itself; the route-group boundary achieves CSS/layout isolation at far lower operational cost

**Dependencies:** F001, F018  
**Risk:** `high`  
**Confidence:** `medium`

## F027 — Incremental workflow migration into the operator console

### Recommended route

Migrate per the D09 cadence, one workflow per bounded layer, each layer moving the UI onto console design-system components backed by the same role-aware domain services and custom routes: recommended order — inventory manager and review queue (highest daily friction), vehicle workspace, import/dry-run/approval flow, homepage/page builder, media library and AI studio (F031), lead inbox (F035), analytics/reporting (F037). Each migration removes the Payload custom view only after console parity is verified, keeps Payload Admin reachable for administrators, and deletes the workflow's custom.scss section per the F016 ledger.

### Rejected alternatives

- Big-bang console cutover — rejected: a live operations team cannot lose its working surface; parity-verified incremental migration is required
- Maintaining both surfaces indefinitely per workflow — rejected: dual maintenance doubles every future change; each layer ends by retiring the Payload view for operators

**Dependencies:** F026  
**Risk:** `medium`  
**Confidence:** `medium`

## F028 — Modern GBE Storefront journeys: homepage, catalog, and vehicle detail

### Recommended route

After D05/F020 establish the baseline and F012/F013/F025 freeze the contracts: implement or modernize the homepage renderer against the versioned block registry (unknown blocks degrade safely); build catalog journeys on the complete filter/sort/facet contract with URL-state round-tripping and honest no-result states; build vehicle detail with galleries from canonical media, condition/trust modules, related and recently-added inventory, and availability signals; render dealership/location data dynamically with approved external links as secondary actions per D08; verify mobile conversion behavior end-to-end. Storefront and Admin remain independently deployable.

### Rejected alternatives

- Treating storefront work as verification-only (the prior blueprint's stance) — rejected: the consultation elevates storefront modernization to an explicit product workstream
- Building the storefront journeys inside this Admin repository — rejected: the consumer is a separate deployable; only contracts and fixtures are shared
- Making external dealership links the primary vehicle CTA — rejected: the consultation requires GBE-owned measurable conversion flows as primary, per D08

**Dependencies:** F012, F013, F020, F025  
**Risk:** `high`  
**Confidence:** `medium`

## F029 — Storefront quality: SEO, accessibility, performance, and honest failure states

### Recommended route

Scoped from the F020 baseline capture: implement real 404 responses for missing vehicles/pages; replace any demo/placeholder inventory fallback with an observable degraded mode; add canonical URLs, dynamic per-page metadata, sitemap and robots generation from published data, vehicle/organization JSON-LD, and local SEO structure for Mexican cities/dealership locations; run accessibility audits on the core journeys; measure and budget Core Web Vitals with regression checks in the storefront's CI.

### Rejected alternatives

- Deferring SEO/quality to post-launch — rejected: canonical URLs, metadata, and honest 404/degraded behavior shape indexing from day one and are cheap to build with the journeys, expensive to retrofit
- Keeping plausible demo inventory as an outage fallback — rejected: the consultation explicitly prohibits it; fake inventory misleads shoppers and corrupts analytics

**Dependencies:** F020, F028  
**Risk:** `medium`  
**Confidence:** `medium`

## F030 — Durable AI job infrastructure: provider abstraction, queue, safety, and cost governance

### Recommended route

After D11 fixes providers/budgets/owners: introduce a provider abstraction (typed request/response with per-provider adapters, OpenRouter first); move execution to a durable queue/worker consuming WorkshopJobs (the collection already models the lifecycle) with bounded timeouts, capped retries, cancellation, and per-job idempotency keys; add a cost ledger with reservation before the provider call and settlement after, enforcing per-user/per-role quotas from D11; run moderation on prompts and outputs per the D11 policy; record provider/model/prompt/cost/safety provenance on every job and output; surface observable failure states in the job record; protect the enqueue endpoint under F022 limits.

### Rejected alternatives

- Keeping synchronous in-request generation with a longer timeout — rejected: ties job survival to the HTTP request and platform function limits; violates the durability and cancellation requirements
- Adopting AGIREAL execution cores wholesale — rejected: the reuse matrix flags their workers as delays/canned outputs; only the job/status UI patterns are candidates
- Building on an external job SaaS before a provider decision — rejected: D11 must fix providers/budgets first; the queue choice follows the deployment reality

**Dependencies:** F003, F009, F022  
**Risk:** `high`  
**Confidence:** `medium`

## F031 — AI Media Studio in the operator console: vehicle workshop and banner/promo/social workspace

### Recommended route

After F030 provides durable jobs and F026 provides the console: port the vehicle image studio and activate the marketing workspace inside the console on the owned design system; run all generation/editing through F030 jobs; add before/after comparison and keep crop/aspect variants, recording every output (including marketing assets) through the approval lifecycle — extend the vehicle-media-assets pattern or a parallel marketing-asset approval record so nothing bypasses review; save exclusively to canonical Media with F030 provenance; implement proposed attachment (an approved asset attaches to a draft vehicle or draft page block as a proposal, published only through the normal publishing gates); selectively adapt the reuse-matrix AGIREAL components with the mandated replacements.

### Rejected alternatives

- Registering MediaWorkspaceView inside Payload Admin now — rejected: it would deepen the surface being migrated; it debuts in the console instead
- Letting marketing outputs continue to land in Media without an approval record — rejected: violates the never-auto-publish and approval-lifecycle requirements
- Building new studio UI from scratch — rejected: substantial working UI exists; the work is porting, activation, and governance, not reinvention

**Dependencies:** F009, F026, F030  
**Risk:** `medium`  
**Confidence:** `medium`

## F032 — Typed agent orchestrator and durable approval framework

### Recommended route

After the security foundation and F022 limits: define typed specialist contracts (inventory, merchandising, media, lead, analytics) and an orchestrator routing layer adapted from the reuse-matrix patterns; implement a durable approvals model (collection) binding actor, exact proposed action/diff, expiration, and idempotency key, with server-side verification at execution time; expose agent tools exclusively as wrappers over the existing role-aware domain services (import pipeline, vehicle workflow, media policy, lead services) — never raw collection writes; enforce that no agent tool can transition anything to published; log every agent action auditably under F022. Choose the LLM provider/SDK under D11 with minimal pinned dependencies per the reuse matrix.

### Rejected alternatives

- Giving agents direct Payload Local API access — rejected: violates the mandatory adaptation rule that tools call the same typed role-aware domain services as the UI
- Client-side approval state (a React flag) as the authorization boundary — rejected: explicitly prohibited; approval must be durable and server-verified
- Adopting AGIREAL's generic research/analysis taxonomy — rejected: the reuse matrix limits reuse to typed routing contracts adapted to GBE's domain specialists

**Dependencies:** F001, F003, F022  
**Risk:** `high`  
**Confidence:** `medium`

## F033 — Inventory import assistant agent

### Recommended route

Build as an F032 inventory specialist whose tools wrap the F023 pipeline services: parse the uploaded file, propose mappings (seeding from suggestFieldForHeader), run normalization and duplicate detection through the dry-run stage, validate image references and price fields, and produce the exact proposed diff as the approval artifact; the operator's durable approval triggers the idempotent F023 commit; rollback remains available. Adapt AGIREAL spreadsheet-artifact preview components for the diff review UI inside the console.

### Rejected alternatives

- A standalone agent with its own import logic — rejected: duplicates the governed pipeline and violates the domain-services rule
- Auto-commit for high-confidence files — rejected: commit requires durable human approval without exception per the consultation and reuse-matrix rules

**Dependencies:** F023, F032  
**Risk:** `medium`  
**Confidence:** `medium`

## F034 — GBE lead capture and dealership/city-aware WhatsApp handoff

### Recommended route

After D08 fixes the strategy and F006 hardens ingestion: implement a server-side routing service that resolves the correct WhatsApp number (vehicle dealership, then city, then site fallback per allowFallbackRouting) and generates wa.me links with prefilled vehicle context; deliver the GBE lead form through the narrow F006 ingestion endpoint; record every handoff as a lead/analytics event pair (whatsapp_open, whatsappOpenedAt) so off-platform conversations remain measurable; render approved external dealership links (F005 externalUrl) strictly per the D08 rules; ship the storefront-side surfaces with F028.

### Rejected alternatives

- Client-side number selection from raw dealership data — rejected: exposes routing internals and drifts from the publish-time validation contract; routing resolves server-side
- Off-site redirect as the default vehicle CTA — rejected: the consultation makes external links supplemental; GBE-owned measurable conversion is primary pending D08

**Dependencies:** F005, F006  
**Risk:** `medium`  
**Confidence:** `high`

## F035 — Lead inbox and sales workflow: assignment, stages, SLA, and routing outcomes

### Recommended route

After F006 makes lead data trustworthy and F026 provides the console: build the inbox as a console workflow (assignment/claiming, stage transitions with server-side validation, response timers computing first-response SLA from server timestamps, notes); add routing-outcome and delivery/handoff log fields written by the F034 handoff events; implement dedup consolidation by normalized phone/email producing one conversion per real contact; scope visibility per the D01 sales-role matrix; feed SLA and conversion measures to F037 reporting from rollups, not raw scans.

### Rejected alternatives

- Building the inbox as another Payload custom view — rejected: new operator workflows debut in the console per the migration strategy
- Adopting an external CRM — rejected: leads are platform-owned commercial data feeding dealer analytics; an external CRM would fragment the trusted-analytics loop

**Dependencies:** F006, F026, F034  
**Risk:** `medium`  
**Confidence:** `high`

## F036 — Trusted analytics: bounded sessions, attribution, consent, bot filtering, idempotent events, and rollups

### Recommended route

On top of F006's hardened ingestion: define bounded session/visitor identity (server-validated format, session windowing) separate from any personal identity; add UTM/source/campaign attribution and placement identity fields aligned with F025's block analytics IDs; implement bot filtering at ingestion (user-agent/behavioral rules) and consent/retention enforcement with documented rules for Mexico; make every event idempotent via client-generated event IDs deduplicated server-side; build a rollup layer (scheduled aggregation into summary records) covering impressions, clicks by placement, search/filter/no-result behavior, detail engagement, lead/WhatsApp funnels, and destination dealership; switch dashboards to rollups; only then restore smart ranks (F012) and exposure signals (F024).

### Rejected alternatives

- Adopting a third-party analytics SaaS as the system of record — rejected: dealer-facing reporting joins against vehicles/dealerships/leads in Postgres, and event trust rules are platform policy
- Computing rollups at read time over raw events — rejected: the 300-row cap exists precisely because raw scans do not scale; aggregation must be materialized

**Dependencies:** F003, F006  
**Risk:** `high`  
**Confidence:** `high`

## F037 — Dealer-facing reporting: exposure, conversion, demand, aging, and SLA views

### Recommended route

After F036 rollups exist and F026 provides the console: build the reporting workspace as a console workflow reading exclusively from rollups: overview (visitors, qualified sessions), exposure (impressions/click-through by vehicle and placement, top/underexposed lists), conversion (leads, WhatsApp handoffs, deduplicated conversion by page/block/placement/source/city/dealership), demand (search/filter and no-result queries), operations (inventory aging from F024, lead-response SLA from F035); scope by dealership/city with role-appropriate visibility under D01; retire the raw-scan admin widgets as the console views reach parity.

### Rejected alternatives

- Extending the existing Payload dashboard widgets — rejected: they read capped raw events inside the surface being migrated; reporting belongs in the console on rollups
- Embedding a BI tool — rejected: the required views join platform entities with role-scoped access; a BI layer would duplicate authorization and delay the product

**Dependencies:** F024, F026, F035, F036  
**Risk:** `medium`  
**Confidence:** `medium`

## F038 — Shared contracts source of truth and the bounded monorepo decision

### Recommended route

Start inside this repository without restructuring: consolidate DTO types, catalog options, block schemas (feeding the F025 registry), analytics event types, and shared fixtures into one exportable contracts module consumed by F020's drift checks. Resolve D10 for the delivery vehicle — recommended default: publish it as a versioned package consumed by both repositories, deferring any monorepo restructure until after launch. Keep Admin and Storefront independently deployable regardless of the D10 outcome, and never sequence this work ahead of security, homepage, or media fixes.

### Rejected alternatives

- An immediate monorepo restructure — rejected: the consultation explicitly forbids letting a large repository move block urgent security/homepage/media work
- Duplicating types into the Storefront by copy — rejected: that is the current implicit state producing the drift risk this feature exists to end

**Dependencies:** F018  
**Risk:** `medium`  
**Confidence:** `high`
