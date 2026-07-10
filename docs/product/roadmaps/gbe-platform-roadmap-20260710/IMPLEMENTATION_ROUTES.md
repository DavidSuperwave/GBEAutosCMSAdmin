# Implementation Routes

## F001 — Explicit-role fail-closed migration and authorization proof (WP-01A)

### Recommended route

Per consultation Section 6: (1) read-only staging inventory of users and role values; (2) human-reviewed mapping for every existing user (decision D01); (3) a transactional, idempotent Payload migration that applies explicit roles and aborts if any user remains unmapped, with a pre-migration export and documented rollback; (4) only after the post-migration null/invalid count is zero, change getRoles to return no roles for missing/invalid values; (5) add a minimal focused security-test harness (new test:security script) with roleless/each-role fixtures asserting 403 from invite, specs, import, workshop, media review, and preview routes. Scope is limited to roles.ts, Users.ts, one migration, fixtures, and tests; guarded routes are regression consumers only. Never run the migration against production during blueprint/build work.

### Rejected alternatives

- Flip getRoles to fail-closed immediately without migration — rejected: would lock out every legacy roleless account, violating the 'no silent lockout' invariant
- Infer least-privilege roles from user activity or names — rejected: explicitly forbidden by the consultation's migration constraints
- Bundle this with all remaining WP-01 boundary fixes — rejected: consultation finding F2 shows monolithic WP-01 mixes done and undone work; independent provability requires the split

**Dependencies:** F002  
**Risk:** `critical`  
**Confidence:** `high`

## F002 — Operations gate — staging and production truth capture

### Recommended route

Run the consultation's exact resolving queries read-only against staging (and production where read-only): version()/pg_extension, information_schema.role_table_grants for anon/authenticated/service_role, pg_tables rowsecurity plus pg_policies, sanitized Vercel key-presence matrix compared to .env.example, select role, count(*) from users group by role, media/imageUrl inventory counts, and a documented backup/restore readiness check. Archive timestamped outputs in the repo or run directory as the baseline evidence pack feeding D01 and D05.

### Rejected alternatives

- Skip straight to the role migration and discover the user inventory during it — rejected: the migration must abort on unmapped users, so the inventory must exist first
- Capture production state by running mutating smoke tests — rejected: consultation and project memory both flag the DB as live production data; all capture must be read-only

**Dependencies:** None  
**Risk:** `medium`  
**Confidence:** `high`

## F003 — Admin-only Node 22 CI and release harness (WP-00A)

### Recommended route

Add a GitHub Actions (or equivalent) workflow on Node 22: npm ci, check:admin-styles, tsc --noEmit --incremental false, lint, the focused test suite introduced by F001 against an ephemeral/authorized staging Postgres, and next build, with retained artifacts. Scope is Admin-repo-only per the consultation: exclude monorepo creation, Storefront builds, seeded tenant fixtures (blocked on F008), and browser baselines from this feature.

### Rejected alternatives

- Full WP-00 as written (monorepo, seeded tenants, browser baseline, Storefront builds) — rejected: consultation shows tenant seeding is impossible before a tenant schema and Storefront work cannot be accepted from this repository
- Adopt a heavy E2E browser framework first — rejected: the immediate need is typecheck/lint/security-test enforcement; browser regression is sequenced with style work (F016)

**Dependencies:** F001  
**Risk:** `medium`  
**Confidence:** `high`

## F004 — Vehicle raw/public/preview boundary contract (WP-01B)

### Recommended route

Freeze public vehicle/collection DTO snapshots as contract tests; add negative tests proving anonymous raw REST and GraphQL reads are denied for vehicles, collections, and media assets; verify published/non-sold and approved-media enforcement across list, detail, collection, and preview paths; assert the preview route denies anonymous and roleless users. Build on the F001 test harness and F003 CI.

### Rejected alternatives

- Unmount raw REST/GraphQL entirely — rejected for this feature: the admin UI consumes the REST API (e.g. HomeBuilder fetches /api/globals/site-config); disabling GraphQL alone may be considered as a follow-up hardening toggle, but the boundary must be proven at the access layer regardless
- Treat P0-1 as fully resolved based on e9484c9 — rejected: consultation F2 shows residual boundaries and the untested fail-open fallback made prior claims unverifiable

**Dependencies:** F001, F003  
**Risk:** `high`  
**Confidence:** `high`

## F005 — Content and reference collection access policies (WP-01C)

### Recommended route

Define and test an explicit operation/field policy per collection and global: Dealerships gain role-guarded mutations and a field-level restriction (or public-DTO split) for internalNotes; SiteConfig gains an explicit canManageContent update policy; Pages public read is scoped to published documents (coordinating with F007's draft model); AnalyticsEvents update/delete become admin-only; every policy lands with allow/deny matrix tests over REST, GraphQL, and Local API.

### Rejected alternatives

- One monolithic access-policy commit across all collections without tests — rejected: repeats the unverifiable-boundary pattern the audit flagged; each layer needs negative tests
- Making Dealerships fully private — rejected: the storefront needs dealership contact/routing data; the fix is field-level protection or a public DTO, not blanket denial

**Dependencies:** F001, F003  
**Risk:** `high`  
**Confidence:** `high`

## F006 — Lead and analytics ingestion hardening (WP-01D / P0-6)

### Recommended route

Replace public raw-collection creation with narrow ingestion endpoints: strict schemas that whitelist submitter-settable fields only, server-assigned timestamps/source, idempotency keys to make replays no-ops, body-size limits, and rate limiting; deny public create on the raw collections; restrict management-field mutation to sales roles; then base the dashboard on server-side aggregation/rollups instead of capped raw reads. Prove with staging fixture journeys (one submission → exactly one lead/conversion; replay → no duplicate).

### Rejected alternatives

- Add a captcha only — rejected: does not address replays, management-field injection, schema abuse, or authenticated-user analytics tampering
- Keep raw public create and filter garbage at read time — rejected: poisoned data would still occupy the collection and the audit requires ingestion-time validation and idempotency

**Dependencies:** F001, F003, F005  
**Risk:** `high`  
**Confidence:** `high`

## F007 — Pages-only draft/version publishing proof (WP-04A)

### Recommended route

Enable Payload versions with drafts on the Pages collection only, including the required migration; scope public read to published versions; wire authenticated draft preview through the existing livePreview/preview URLs; add tests for draft non-visibility, publish, unpublish, rollback, and version history. Explicitly exclude homepage/SiteConfig and vehicle content (sequenced in F013/F014 behind decisions D02/D03).

### Rejected alternatives

- One WP-04 spike across Pages, homepage, and vehicle detail — rejected: consultation F4 shows this mixes migrations, three publishing models, preview protocols, and a missing repository
- Custom draft flags instead of Payload versions — rejected: Payload's native versions provide rollback, autosave, and draft-preview semantics the platform needs without bespoke maintenance

**Dependencies:** F003, F005  
**Risk:** `medium`  
**Confidence:** `high`

## F008 — Tenant identity foundation (P0-7)

### Recommended route

Resolve D02 first. If multi-tenancy proceeds: define the tenant collection, user memberships, host/session-derived tenant resolution, and a reversible backfill assigning all existing data to the GBE tenant; then scope collections in bounded batches, each with tenant A/B isolation tests (reads, mutations, relationships, search, media, imports, leads, analytics). Domain lifecycle management is a later layer. If D02 defers tenancy, mark this feature deferred and unblock F009 with non-tenant object keys.

### Rejected alternatives

- Adopt @payloadcms/plugin-multi-tenant wholesale in one pass — rejected as a first step: the audit requires an explicit identity/membership/resolution decision and a reversible GBE backfill before any collection scoping; the plugin remains a candidate implementation inside that contract
- Fake tenancy via a tag/prefix convention on existing collections — rejected: provides no access-boundary enforcement and would require remigration later

**Dependencies:** F001, F003  
**Risk:** `critical`  
**Confidence:** `medium`

## F009 — Durable media storage adapter and canonical write path (WP-02A)

### Recommended route

After D05 selects the provider and D02 settles key scheme implications: install the matching Payload storage adapter, route all new Media writes through it with the agreed (tenant-derived or flat) object keys, make the canonical Media relationship the single write path for vehicle imagery, and prove durability on staging: upload a hashed fixture, redeploy, retrieve and hash-compare, then delete and verify object/metadata lifecycle.

### Rejected alternatives

- Extend the sync-vehicle-images.mjs script as the durability mechanism — rejected: it is out-of-band, legacy-exception-driven, and perpetuates the dual-source-of-truth problem
- Proceed now with flat keys regardless of D02 — rejected by default: the consultation warns this forces object-key remigration if tenancy lands; acceptable only if D02 explicitly defers tenancy

**Dependencies:** F002, F008  
**Risk:** `high`  
**Confidence:** `high`

## F010 — Legacy media inventory, backfill, and cutover (WP-02B)

### Recommended route

Using F002's media inventory: enumerate all legacy imageUrl/storage paths, backfill each to a canonical Media document in the durable store, produce a reconciliation report (matched, migrated, orphaned, failed), cut consumer reads over to the canonical relationship, and retire the legacy write path — only after F009's staging durability proof has passed.

### Rejected alternatives

- Big-bang cutover without a reconciliation report — rejected: unverifiable against live production imagery; the audit demands inventory/backfill reconciliation evidence
- Leaving legacy URLs in place indefinitely alongside canonical media — rejected: preserves the dual-contract problem P0-2 identifies

**Dependencies:** F009  
**Risk:** `high`  
**Confidence:** `high`

## F011 — Numeric pricing migration and backfill (WP-03A)

### Recommended route

Add numeric priceAmount (and priceMax for ranges) plus currency fields; write an idempotent migration parsing existing text prices with a reconciliation report of parsed/ambiguous/null values against F002's null/invalid price snapshot; keep the display string derived rather than authoritative; update publish-completeness checks and admin UI to edit the numeric fields; switch catalog sorts/filters to the numeric column (completed in F012).

### Rejected alternatives

- Parse text price at query time — rejected: cannot index, sort, or facet correctly and leaves malformed data unfixed
- Overwrite the text field in place with numbers — rejected: destroys range/display semantics and complicates rollback; additive migration with derived display is safer

**Dependencies:** F002, F003  
**Risk:** `high`  
**Confidence:** `high`

## F012 — Complete public catalog API: filters, sorts, facets, and collection parameters (WP-03B)

### Recommended route

Extend PublicVehicleListOptions with priceMin/priceMax (numeric, from F011), color, and yearAsc; implement facet counts for the filterable dimensions; thread the full option set through the public collection route; resolve D04 for the smart ranks (remove, or gate behind trusted rollups from F006); freeze the expanded contract with API fixture tests covering every filter, sort, pagination edge, and facet count. Storefront UI/URL-state reconciliation remains a separate cross-repository gate (F017/D06).

### Rejected alternatives

- Implement Storefront controls and URL state in this feature — rejected: consultation F7 — those consumers live in the absent GBECMS repository and cannot be accepted from here
- Keep smart-rank silent fallback — rejected: a public contract that claims analytics ordering while returning newest is misleading; D04 forces an explicit choice

**Dependencies:** F004, F011  
**Risk:** `medium`  
**Confidence:** `high`

## F013 — Homepage and SiteConfig draft publishing (WP-04B)

### Recommended route

After D02 settles whether SiteConfig stays a global or becomes a per-tenant singleton document: enable versions/drafts on the resulting model, persist section visibility in the document schema, convert HomeBuilder to save drafts and publish explicitly, and reuse the draft-preview pattern proven by F007. Include unpublish/rollback and concurrent-edit behavior in tests.

### Rejected alternatives

- Enable versions on the current global before D02 — rejected: if tenancy converts SiteConfig to per-tenant documents, the versions migration would be redone; the audit sequences this behind the tenant-singleton decision
- Client-side staged-save emulation in HomeBuilder — rejected: leaves the raw global endpoint publishing on save; the model, not the UI, must carry draft semantics

**Dependencies:** F007, F008  
**Risk:** `medium`  
**Confidence:** `medium`

## F014 — Versioned vehicle presentation content (WP-04C)

### Recommended route

Resolve D03, then implement the chosen model: either enable versions/drafts on Vehicles with careful separation of operational fields from content fields, or extract presentation content to a versioned related collection with a migration. Reuse F007's publishing test pattern and keep the existing publish-completeness gating intact.

### Rejected alternatives

- Versioning Vehicles without deciding the content/operations split — rejected: would version inventoryStatus/publishStatus churn alongside content, polluting history and complicating rollback semantics
- Skipping vehicle content versioning permanently — viable only if D03 selects that option explicitly; the default roadmap treats it as required for safe content operations

**Dependencies:** F007  
**Risk:** `medium`  
**Confidence:** `medium`

## F015 — Optimistic concurrency for vehicle workspace edits

### Recommended route

Add a version/updatedAt precondition to workspace saves: client sends the revision it loaded; a server hook rejects stale writes with a conflict response; the UI surfaces the conflict and offers reload-and-merge. Scope to the vehicle workspace first (highest concurrent-edit risk), generalizing later if F013/F014 need it.

### Rejected alternatives

- Rely on Payload versions (F014) as the concurrency mechanism — rejected: versions give history, not write-time conflict detection; both are needed and D03 may not version operational fields at all
- Pessimistic locking — rejected: heavier UX and stale-lock cleanup burden for a small editing team; optimistic conflicts fit the workflow

**Dependencies:** F003  
**Risk:** `medium`  
**Confidence:** `high`

## F016 — Admin style architecture isolation (P0-4 residual)

### Recommended route

Deliberately last (consultation sequence step 11): treat the passing style guard as the stabilization baseline; expand guard ownership coverage; then incrementally migrate view-specific styles into scoped CSS modules per component, shrinking custom.scss; add real-browser visual regression at supported breakpoints once CI (F003) exists to host it.

### Rejected alternatives

- Big-bang rewrite of custom.scss — rejected: highest-regression-risk move on a live admin, and the audit explicitly sequences style work after functional contracts stop moving
- Treating P0-4 as fully resolved because the guard passes — rejected: consultation F6 — the architectural debt persists and unguarded selectors still collide silently

**Dependencies:** F003  
**Risk:** `medium`  
**Confidence:** `high`

## F017 — Storefront cross-repository contract gate

### Recommended route

Once D06 supplies GBECMS at a pinned SHA: run its clean checks; add shared contract fixtures for every registered section block plus unknown-block behavior; trace filter/URL-state round-trips against the F012 catalog contract; execute one fixture journey reconciling emitted analytics events and lead creation by idempotency ID against F006's ingestion; wire these as a cross-repository CI gate.

### Rejected alternatives

- Accepting carried-forward Storefront claims as verified — rejected: the audit explicitly marks all Storefront conclusions as not revalidated
- Duplicating storefront rendering inside the Admin repo for testing — rejected: diverges from the real consumer and gives false confidence

**Dependencies:** F004, F006, F012  
**Risk:** `high`  
**Confidence:** `medium`
