# Implementation Routes

## F001 — Three-role fail-closed migration (admin/general/sales) replacing the live six-role enum

### Recommended route

After D01 (matrix) and D02 (per-user mapping) are approved and M01's role-distribution capture is archived: (1) write a reviewed, idempotent, transactional migration that alters the live role enum to admin/general/sales and applies the explicit mapping, aborting if any user remains unmapped, with a pre-migration export and rollback plan — staging first, never production during build work; (2) rewrite src/access/roles.ts to the three-role model with getRoles returning no roles for missing/invalid values; (3) sweep every consumer (roles.ts helpers, cmsRequestAuth callers, collection access, field access, admin UI role options, invite flow) to the new matrix; (4) add focused security tests with roleless/invalid-role/each-role fixtures asserting deny-by-default on invite, import, specs, workshop, media review, and preview routes.

### Rejected alternatives

- Flip getRoles to fail-closed without the enum migration and mapping — rejected: would lock out or silently demote real staff; the audit requires the private human mapping first
- Automatically map legacy roles to general/sales by heuristic — rejected: the audit states no legacy role can be automatically mapped; it is a private human decision
- Keep the six-role model and just remove the fallback — rejected: contradicts the confirmed three-role product decision and would require a second migration later

**Dependencies:** F002  
**Risk:** `critical`  
**Confidence:** `high`

## F002 — Operations truth capture — complete the blocked read-only live facts

### Recommended route

Per D06: an authorized operator reruns the audit's four read-only SQL blocks through the same Supabase MCP project (or dashboard SQL editor), returning catalog/aggregate output only — no identities, object names, URLs, or secrets — plus a name-only payload_migrations listing. Archive timestamped outputs beside the verified audit as the evidence pack feeding D02 (role mapping), F009 (bucket identity/restrictions), F010 (media reconciliation counts), F011 (price quality), and F013 (homepage completeness/orphan checks). The per-user identity mapping happens in a separate private human process.

### Rejected alternatives

- Use local .env/psql credentials for live facts — rejected: the audit's invariants forbid it; capture must stay within the authorized read-only channel
- Proceed to migrations with table-level row estimates only — rejected: the role migration must abort on unmapped users and the price backfill needs exact quality counts; estimates cannot gate either

**Dependencies:** None  
**Risk:** `medium`  
**Confidence:** `high`

## F003 — Minimum Node 22 CI and security-test harness

### Recommended route

Add a GitHub Actions (or equivalent) workflow on Node 22 running npm ci, check:admin-styles, tsc --noEmit, lint, the F001 security suite against an ephemeral or authorized staging Postgres, and next build, with retained artifacts and required-check status. Admin-repo-only scope: no Storefront builds, no browser baselines yet (sequenced with F016).

### Rejected alternatives

- Adopt a heavy browser E2E framework first — rejected: the immediate need is typecheck/lint/security enforcement; browser regression lands with style work (F016)
- Run CI tests against the live Supabase project — rejected: the database is live production data; tests must use ephemeral or explicitly authorized staging infrastructure

**Dependencies:** F001  
**Risk:** `medium`  
**Confidence:** `high`

## F004 — Vehicle raw/public/preview boundary contracts under the three-role model

### Recommended route

After F001/F003: freeze public vehicle and collection DTO snapshots as contract tests; add negative tests proving anonymous raw REST and GraphQL reads are denied for vehicles, collections, and media assets; verify published/non-sold/approved-media enforcement across list, detail, collection, and preview paths; rewrite preview guards to the target roles; and document/pin the canonical status fields (publish_status, inventory_status) while scheduling the legacy status/_status columns for reconciliation alongside F010-style cleanup.

### Rejected alternatives

- Unmount raw REST/GraphQL entirely — rejected for now: the admin UI consumes the REST API (e.g. HomeBuilder fetches /api/globals/site-config); the boundary must be proven at the access layer regardless, with GraphQL disablement a possible follow-up hardening
- Treat the boundary as done based on the current code — rejected: the fail-open fallback made prior claims unverifiable and no tests exist

**Dependencies:** F001, F003  
**Risk:** `high`  
**Confidence:** `high`

## F005 — Content and reference access closure with a safe public dealership DTO

### Recommended route

Prioritize the homepage-relevant closure first (SiteConfig explicit update policy per the D01 matrix, Pages read scoping, dealership field protection and DTO) so F013 can proceed, then complete the rest: add an approved externalUrl field to Dealerships with admin-controlled approval semantics; split public consumption onto a bounded dealership DTO (visitor-safe fields only) and restrict raw reads; declare explicit role-guarded mutations for Dealerships/Pages/Media/VehicleTags; make AnalyticsEvents update/delete admin-only; land every policy with allow/deny matrix tests across REST, GraphQL, and the custom routes.

### Rejected alternatives

- Make Dealerships fully private — rejected: the storefront needs location/contact/routing data; the fix is field-level protection plus a bounded DTO, not blanket denial
- Defer the dealership external URL to a later feature — rejected: it is a confirmed product requirement for visitor routing and belongs with the DTO design, not bolted on after
- One monolithic access commit without tests — rejected: repeats the unverifiable-boundary pattern the audits flagged

**Dependencies:** F001, F003  
**Risk:** `high`  
**Confidence:** `high`

## F006 — Lead and analytics ingestion hardening

### Recommended route

Replace public raw-collection creation with narrow ingestion endpoints: strict whitelisted submitter fields, server-assigned timestamps/source, idempotency keys making replays no-ops, body-size limits, and rate limiting; deny public create on the raw collections; restrict management-field mutation to the D01 sales-capable role; base dashboards on server-side rollups instead of capped raw scans. Prove with fixture journeys (one submission → exactly one lead; replay → no duplicate).

### Rejected alternatives

- Captcha only — rejected: does not address replays, management-field injection, or authenticated tampering
- Filter garbage at read time while keeping raw public create — rejected: poisoned rows would still accumulate; the audit requires ingestion-time validation and idempotency

**Dependencies:** F001, F003, F005  
**Risk:** `high`  
**Confidence:** `high`

## F007 — Pages draft/version publishing proof (resequenced after homepage)

### Recommended route

After F013 establishes the publishing pattern: enable Payload versions with drafts on Pages (with migration), scope public read to published versions, replace the manual status/isVisible fields, wire authenticated draft preview through the existing livePreview URLs, run the orphan-child integrity check from F002's exact counts, and add tests for draft non-visibility, publish, unpublish, rollback, and history.

### Rejected alternatives

- Prove publishing on Pages before the homepage — rejected: the confirmed product priority is the primary GBE homepage; Pages carries lower business value and would delay it
- Custom draft flags instead of Payload versions — rejected: native versions provide rollback and draft-preview semantics without bespoke maintenance

**Dependencies:** F003, F005, F013  
**Risk:** `medium`  
**Confidence:** `high`

## F008 — Tenant identity foundation (removed — single GBE site confirmed)

### Recommended route

No build. Dealerships remain location/inventory reference metadata with an approved external link (delivered in F005). Any future AGIREAL-derived rule referencing tenants must be translated to server-derived actor, role, approval, and single-GBE-site context.

### Rejected alternatives

- Keep tenancy as a deferred feature — rejected: the human decision explicitly removes it and the live schema contains no trace of it; keeping it would perpetuate false dependencies on media keys and homepage publishing

**Dependencies:** None  
**Risk:** `low`  
**Confidence:** `high`

## F009 — Durable media: Supabase Storage behind the canonical Payload Media service (unblocked)

### Recommended route

After F002 captures bucket identity/visibility/restrictions: configure a Payload storage adapter targeting Supabase Storage (S3-compatible or Supabase-specific), route all new Media writes through it under a stable single-site key convention, keep Payload media relationships as canonical asset identity (never direct Storage public URLs), and prove durability on staging: upload a hashed fixture, redeploy, retrieve and hash-compare, then delete and verify lifecycle. Object changes go through the Storage API per Supabase guidance, never direct metadata-table writes.

### Rejected alternatives

- Extend sync-vehicle-images.mjs as the durability mechanism — rejected: out-of-band, service-role-privileged, and perpetuates the dual source of truth
- A different object-storage provider — rejected: Supabase Storage is the confirmed human decision and the audit found no live incompatibility
- Wait for a tenant key-scheme decision — obsolete: tenancy is removed; single-site keys are confirmed

**Dependencies:** F002, F003  
**Risk:** `high`  
**Confidence:** `high`

## F010 — Media reconciliation and legacy image-path retirement

### Recommended route

Only after F009's durability proof and F002's object/relationship aggregates: enumerate all legacy image fields and Storage objects, backfill each to canonical Media documents, produce a reconciliation report (matched, migrated, orphaned, failed), cut consumer reads over to the canonical relationship, retire the legacy columns from write paths, and decommission or fence sync-vehicle-images.mjs behind the canonical service.

### Rejected alternatives

- Big-bang cutover without a reconciliation report — rejected: unverifiable against live production imagery
- Leave legacy URLs indefinitely beside canonical media — rejected: preserves the dual contract and the competing write path

**Dependencies:** F009  
**Risk:** `high`  
**Confidence:** `high`

## F011 — Numeric pricing migration and human-reviewed backfill

### Recommended route

Using F002's price-quality aggregates: add numeric priceAmount (plus priceMax for ranges) and currency fields; run a human-reviewed classification of ambiguous/range/invalid source values before an idempotent backfill migration with a reconciliation report; keep the display string derived, not authoritative; update publish gating and admin UI to the numeric fields; hand the catalog switch to F012.

### Rejected alternatives

- Parse text price at query time — rejected: cannot index, sort, or facet correctly and leaves malformed data unfixed
- Overwrite the text field in place — rejected: destroys range/display semantics and complicates rollback; additive migration is safer
- Automatic classification of ambiguous prices — rejected: the audit requires human-reviewed classification before backfill

**Dependencies:** F002, F003  
**Risk:** `high`  
**Confidence:** `high`

## F012 — Complete public catalog: filters, deterministic sorts, facets, and parameterized collections

### Recommended route

After F011: extend the option set with numeric priceMin/priceMax, color, and yearAsc; implement facet counts for filterable dimensions; thread the full option set through the public collection route; apply D04 (recommended: remove the smart ranks until trusted rollups from F006 exist); freeze the expanded contract with fixture tests covering every filter, sort, pagination edge, and facet count.

### Rejected alternatives

- Implement Storefront UI controls here — rejected: the consumer lives in the separate Storefront repository and is verified via F017
- Keep the silent smart-rank fallback — rejected: a public contract claiming analytics ordering while returning newest is misleading; D04 forces an explicit choice

**Dependencies:** F004, F011  
**Risk:** `medium`  
**Confidence:** `high`

## F013 — Primary GBE homepage publishing on site_config with legacy home retirement (unblocked, prioritized)

### Recommended route

After F001, F003, and the homepage-relevant slice of F005: enable Payload versions/drafts on the SiteConfig global (with migration); convert HomeBuilder and the SiteConfig admin flow to save drafts and publish explicitly with authenticated preview via the existing livePreview URLs; add unpublish/rollback and optimistic-concurrency behavior with tests; reconcile legacy home content per D03, export/backup it, then retire the home/home_stats/home_brands tables and delete the unregistered src/globals/Home.ts; schedule the old flat site_config column cleanup in the same migration series. Homepage publishing precedes generic Pages publishing (F007) by design.

### Rejected alternatives

- Client-side staged-save emulation in HomeBuilder — rejected: leaves the raw global endpoint publishing on save; the model, not the UI, must carry draft semantics
- Register the legacy Home global and merge models — rejected: site_config is the confirmed single source of truth; resurrecting home deepens the conflict
- Wait for a tenant-singleton decision — obsolete: tenancy is removed from the product

**Dependencies:** F001, F003, F005  
**Risk:** `high`  
**Confidence:** `high`

## F014 — Versioned vehicle presentation content (separately gated product decision)

### Recommended route

Resolve D07 first. If approved, implement the chosen model (extraction into a versioned related collection is the safer default) reusing the publishing test pattern from F013/F007, keeping publish-completeness gating intact. If D07 declines, close this feature with the existing publish gating as the accepted behavior.

### Rejected alternatives

- Versioning Vehicles without deciding the content/operations split — rejected: would version operational churn alongside content, polluting history and rollback semantics
- Bundling this into the homepage milestone — rejected: explicitly decoupled by the human decision

**Dependencies:** F007  
**Risk:** `medium`  
**Confidence:** `medium`

## F015 — Optimistic concurrency for vehicle workspace and publishing flows

### Recommended route

Add a version/updatedAt precondition to workspace saves: the client sends the revision it loaded; a server hook rejects stale writes with a conflict response; the UI surfaces the conflict and offers reload-and-merge. Scope to the vehicle workspace first, sharing the mechanism F013 introduces for homepage publishing.

### Rejected alternatives

- Rely on Payload versions as the concurrency mechanism — rejected: versions give history, not write-time conflict detection
- Pessimistic locking — rejected: heavier UX and stale-lock cleanup burden for a small team

**Dependencies:** F003, F013  
**Risk:** `medium`  
**Confidence:** `high`

## F016 — Admin style architecture isolation (sequenced last among build features)

### Recommended route

Treat the passing style guard as the stabilization baseline; expand guard ownership coverage; incrementally migrate view-specific styles into scoped CSS modules per component, shrinking custom.scss; add real-browser visual regression at supported breakpoints once CI (F003) can host it.

### Rejected alternatives

- Big-bang rewrite of custom.scss — rejected: highest-regression-risk move on a live admin, explicitly sequenced last
- Treating the passing guard as full resolution — rejected: unguarded selectors still collide silently

**Dependencies:** F003  
**Risk:** `medium`  
**Confidence:** `high`

## F017 — Storefront verification release gate at a pinned SHA

### Recommended route

Once D05 supplies the Storefront at a pinned SHA: run its clean checks; add shared contract fixtures for every registered homepage/section block plus unknown-block behavior; verify published homepage and navigation rendering from site_config, published-inventory and media resolution through canonical contracts, approved dealership external-link redirects, preview isolation (drafts invisible anonymously), and analytics deduplication via idempotency IDs; wire these as a cross-repository CI gate required before public acceptance.

### Rejected alternatives

- Accepting carried-forward Storefront claims as verified — rejected: all Storefront conclusions are explicitly unvalidated
- Duplicating storefront rendering inside the Admin repo for testing — rejected: diverges from the real consumer and gives false confidence

**Dependencies:** F004, F006, F012, F013  
**Risk:** `high`  
**Confidence:** `medium`
