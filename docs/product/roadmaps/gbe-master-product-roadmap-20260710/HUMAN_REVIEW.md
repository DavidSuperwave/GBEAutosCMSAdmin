# Human Review Gate

**Current gate status:** `needs_decision`

No feature or layer is approved for implementation by this document.

## Decisions required

### D01 — What is the exact permission matrix for the three target roles admin, general, and sales?

The confirmed model has exactly three roles, but capability today is spread across six legacy roles (src/access/roles.ts:60-86: canManageInventory, canManageContent, canManageMedia, MEDIA_REVIEW_ROLES, canManageLeads). Every collection access rule, field rule, custom route guard, import endpoint, media review gate, and AI studio gate must be rewritten against the approved matrix; engineering cannot infer which of general/sales inherits inventory, content, media review, or lead management.

- Approve a written per-collection/per-operation matrix for admin, general, and sales before F001 implementation starts
- Map general = all current non-admin operational capabilities and sales = lead/analytics management only, then refine after launch
- Defer any capability change and only rename/collapse roles 1:1 (not recommended — leaves the matrix ambiguous)

### D02 — What is the private per-user mapping of every existing user to admin, general, or sales?

The live enum is the legacy six-role set and public.users reports 3 rows with unknown per-user values (the aggregate SQL was cancelled). getRoles currently treats roleless users as admins (src/access/roles.ts:38), so the fail-closed migration must abort on unmapped users. The audit states no legacy role can be automatically mapped; this is a private human decision executed through a runbook, with identity-level output kept out of the audit trail.

- Run the safe role-distribution capture, then privately review and sign off a mapping for every user before the migration
- Default all three users to admin explicitly and downgrade later (ratifies over-privilege but preserves access)
- Default unmapped users to no role (fail-closed immediately; risks locking out active staff)

### D03 — Which legacy homepage content is retained in site_config: the registered site_config rows, the legacy home/home_stats/home_brands rows, or a hand-picked merge?

Both models contain live rows (MCP-live-verified), so making site_config the single source of truth requires a business content decision about what migrates before the legacy home family and unregistered src/globals/Home.ts are retired. Content value judgments belong to the business, not engineering.

- Review both contents side by side and hand-pick what migrates into site_config before retiring the legacy family
- Declare current site_config content canonical as-is and archive/drop the legacy rows after a backup export
- Migrate everything from home into site_config mechanically and edit down afterwards

### D05 — Which Storefront repository commit (pinned SHA) is the baseline for early contract capture (F020) and the final release gate (F017)?

The repository root redirects to /admin (src/app/(frontend)/page.tsx:4); the main GBE website lives in a separate repository and consumes the homepage, navigation, inventory, media, dealership-link, preview, and analytics contracts. The alignment audit notes the repository is already known, so this is largely an evidence-pinning task — but the exact SHA and its lockfile hash must be recorded before Storefront baseline capture, modernization scoping (F028/F029), or the cross-repository gate can start.

- Pin the current Storefront main-branch SHA now, run F020 baseline capture early, and keep F017 as the final release gate
- Accept Admin-side API contract tests as the acceptance boundary and defer Storefront verification (weakens the release gate; not recommended)

### D06 — Who executes the blocked read-only SQL captures, and through which channel, to close F002?

Every execute_sql request was cancelled by the MCP layer, leaving Postgres version, sizes, forced-RLS, policy/grant inventory, SECURITY DEFINER functions, Storage bucket restrictions, role distribution, and all exact aggregates unknown. The verified audit ships the exact read-only transactions; an authorized operator must run them and archive catalog/aggregate output only. Per the consultation, this blocks only the migrations that require its outputs — not clean-repository CI, source pinning, documentation, design-system inventory, or Storefront baseline capture.

- An authorized operator reruns the audit's read-only SQL through the same Supabase MCP project with execute_sql approved, archiving outputs beside the audit
- Run the same SQL via the Supabase dashboard SQL editor read-only and archive sanitized outputs
- Accept the unknowns and gate each dependent feature on its own just-in-time capture (slower, repeats risk)

### D07 — Does vehicle presentation content live in a separate versioned related model (preferred) or directly on Vehicles?

Safe vehicle presentation editing is now a required capability, not optional — the open decision is only its shape. Presentation fields share the live vehicle record (src/collections/Vehicles.ts) with no versions config, so enabling Payload versions on Vehicles would version operational churn (inventoryStatus, publishStatus) together with marketing content. The consultation states separation is preferred and this decision must not block homepage work.

- Extract presentation content into a separate versioned collection related to Vehicles (preferred)
- Enable versions/drafts on Vehicles as-is and accept mixed inventory/content history

### D08 — What is the primary conversion strategy: GBE lead form, dealership/city-aware WhatsApp handoff, approved off-site redirect — and what rules choose among them per vehicle/dealership/city?

The consultation keeps the exact balance a human conversion-strategy decision. The schema already stores WhatsApp numbers per site and dealership (src/globals/SiteConfig.ts:35,44; src/collections/Dealerships.ts:34) and validates routing completeness at publish (src/services/vehicleWorkflow.ts:188-189), but approved external links must remain supplemental routing, not an automatic replacement for GBE-owned measurable conversion flows — sending traffic off-site by default would bypass GBE's own lead and measurement system.

- GBE lead form plus WhatsApp handoff as the primary journey everywhere; approved off-site links shown only as secondary options
- WhatsApp-first with the GBE lead form as fallback; off-site links only where a dealership explicitly requests them
- Per-dealership policy field deciding form/WhatsApp/redirect priority, with a platform default of GBE-owned capture

### D09 — What route/deployment boundary hosts the dedicated operator console, and what is the migration cadence for moving workflows out of Payload Admin?

The console must live outside the stock Payload Admin layout and its 8,722-line global CSS boundary (src/app/(payload)/custom.scss). Candidate boundaries differ in operational cost: a new route group in this Next.js app, a separate app in the same repository, or a separately deployed application. The cadence decision controls how long the interim CSS containment (F016) must hold and which workflow migrates first.

- New isolated route group (e.g. /console) inside this Next.js app with its own layout, design tokens, and zero Payload Admin CSS imports — lowest operational overhead
- Separate app in the same repository (pending the D10 workspace decision) deployed independently
- Separately hosted operator application consuming the same APIs (highest isolation, highest operational cost)

### D10 — When does the shared-package/monorepo migration happen, and how far does it go?

Public DTOs, catalog options, block schemas, renderer expectations, and analytics event types currently live only inside this repository (src/services/publicVehicleCatalog.ts, src/blocks/SiteSections.ts) while the Storefront consumes them by convention. The consultation requires one source for these contracts and a bounded migration decision — but a large repository move must not block urgent security, homepage, or media fixes, and Admin/platform and Storefront must remain independently deployable.

- Publish a versioned shared contracts package first (types, block schemas, fixtures) consumed by both repositories; defer any monorepo restructure until after launch
- Adopt a workspace monorepo (Admin + Storefront + shared packages) at a scheduled point after the security and media milestones
- Keep contracts in-repo and enforce parity with cross-repository drift checks only (lowest cost, weakest guarantee)

### D11 — Which AI providers, budgets, quotas, moderation policy, and approval owners govern the AI Media Studio and agent features?

Generation currently calls OpenRouter with a Grok image model chosen by env default (src/app/(payload)/api/cms/workshop/generate/route.ts:13-18) with no cost ledger, quota, or moderation. The provider abstraction, cost reservation/ledger, per-role quotas, safety/moderation policy, and named approval owners are business commitments that must be decided before cost-bearing AI endpoints are hardened and exposed to the operator team.

- Approve a provider list with monthly budget caps, per-user/per-role quotas, a moderation policy, and named approval owners before F030 implementation
- Start with a single approved provider and conservative hard caps, expanding after the cost ledger proves spend visibility
- Keep the AI studio behind its feature flag until a full provider/budget policy exists (delays capability G)

## Review checklist

- [ ] Product outcome is correct.
- [ ] Feature boundaries are correct.
- [ ] Repository classifications are supported by evidence.
- [ ] Recommended routes and dependencies are acceptable.
- [ ] Risks and unresolved decisions are understood.
- [ ] Select exactly one feature for build planning.

## Verification notes

- Live repository inspected at branch codex/admin-workflow-updates, HEAD d6d505f, on 2026-07-10; the working tree additionally carries uncommitted modifications (.claude/launch.json, src/app/(frontend)/vehicle-preview/[id]/page.tsx, src/app/(payload)/custom.scss, src/components/PrismaCMSLogo.tsx) and untracked artifacts including docs/product/, review documents, run scripts, and src/utils/
- Repository-static facts verified by direct file read and search this session: fail-open six-role model (src/access/roles.ts:12-40; src/services/cmsRequestAuth.ts:40); plugins: [] with local Media uploads (src/payload.config.ts; src/collections/Media.ts:28); publish-on-save HomeBuilder (src/components/views/HomeBuilder.tsx:23-38) against an unversioned SiteConfig; commit-only import pipeline with declared-but-unwritten job states (src/app/(payload)/api/cms/import/run/route.ts; src/collections/ImportJobs.ts:42-55,82-87); client-side CSV/XLSX parsing (src/components/admin-ui/VehicleImportModal.tsx:44-118) with csv-parse unused; completeness scoring and publish gating (src/collections/Vehicles.ts:257-270,356-363,687-697; src/services/vehicleWorkflow.ts:89-236) with no aging/exposure fields; durable WorkshopJobs with synchronous flag-gated OpenRouter generation lacking queue/retry/timeout/cancellation/idempotency/cost/quota/moderation (src/collections/WorkshopJobs.ts:33-202; src/app/(payload)/api/cms/workshop/generate/route.ts:13-18,204-421); reviewer-gated media approval pipeline (src/collections/VehicleMediaAssets.ts:69-84; src/app/(payload)/api/cms/vehicle-media-assets/review/route.ts, assign/route.ts); the unreachable MediaWorkspaceView/Manager (absent from src/payload.config.ts:59-104 and importMap.js); lead fields without inbox/SLA/dedup/UTM (src/collections/Leads.ts:7-96); analytics taxonomy without idempotency/UTM/consent/bot filtering and 300-row raw dashboard reads (src/collections/AnalyticsEvents.ts:5-72; src/components/AnalyticsDashboard.tsx:123-159); WhatsApp numbers and routing contract without link generation (src/globals/SiteConfig.ts:35,44; src/collections/Dealerships.ts:34; src/collections/Vehicles.ts:645-652; src/services/vehicleWorkflow.ts:188-189; src/seed/seed.ts:288); Payload-default auth with conditional SMTP and the invite route (src/collections/Users.ts:32; src/payload.config.ts:29-35,129-143; src/app/(payload)/api/users/invite/route.ts:29-73); no rate limiting and no middleware.ts anywhere; the 8,722-line custom.scss with zero CSS modules; admin-kit and SectionBuilder primitives (src/components/admin-ui/kit.tsx, SectionBuilder.tsx); 14 homepage block types (src/blocks/SiteSections.ts); in-repo-only DTO contracts (src/services/publicVehicleCatalog.ts) with no packages/ or workspace tooling; no .github directory, no test or typecheck script, engines node 22.x
- Live-database facts (role enum, 93 RLS-enabled tables, 35 no-policy tables, home vs site_config rows, 277 Storage objects vs 42 media rows, 1,391 vehicles, 22 dealerships, 0 leads, 408 analytics rows, migration registries) are accepted from docs/product/inputs/SUPABASE_LIVE_READONLY_AUDIT_20260710_VERIFIED.md, whose gate result is 'Partially captured; F002 remains open'; they are labeled MCP-live-verified where cited and are not independently reproducible from this repository — their remaining unknowns are exactly what F002/D06 close
- Remaining unknowns labeled honestly: everything the cancelled execute_sql calls cover (versions, sizes, policies, grants, privileged functions, Storage restrictions, exact aggregates, per-user roles), the Storefront repository's actual state (F028/F029 are current_state unknown until the D05 pin and F020 capture), and the live deploy/environment-to-database binding
- The preserved stabilization blueprint (docs/product/roadmaps/gbe-single-site-homepage-roadmap-20260710/BLUEPRINT.json) maps into this master roadmap as follows: F001-F007 and F009-F017 retain their identifiers and substance with these consultation-directed revisions — F003 is re-scoped to the expanded security harness while the new F018 carries the baseline CI slice that now precedes F001 (sequencing correction 1); F009/F011 gain the F019 staging dependency; F012 absorbs the smart-rank removal as an engineering default; F013 notes that builder mechanics precede media reconciliation while launch does not (correction 3); F014 is upgraded from optional to required capability with only its model shape open under D07; F016 is reframed as interim containment with the operator console as destination; F017 gains F009/F010/F020/F028/F029 dependencies as the launch gate (correction 4); its former milestones M01-M11 fold into master milestones M01-M04 and M09
- F008 (tenant identity foundation) is deliberately absent from the features array per the consultation's sequencing correction 5: the rejected tenancy decision is preserved in the decision log only (docs/product/inputs/HUMAN_PRODUCT_DECISIONS_20260710.md and the prior blueprint's F008 disposition record); no active or deferred tenant feature exists anywhere in this roadmap, and the alignment audit's tenant-restoration recommendation is explicitly rejected while its omission/sequencing findings are adopted as F014's upgrade, F018-F038, and the dependency corrections
- The prior blueprint's D04 (smart-rank removal) is retired from decisions_required per the consultation's instruction not to elevate engineering defaults into blocking business decisions; the default (remove until F036 trusted rollups) is embedded in F012/F024/F036 acceptance criteria. Decision IDs D01-D03 and D05-D07 carry forward with their established meanings; D08-D11 are new (conversion strategy, console boundary/cadence, monorepo timing, AI providers/budgets)
- AGIREAL appears only as selective reference input per docs/product/inputs/AGIREAL_REUSE_MATRIX.md (pinned commit 902c3ce975606c222358d1730e3f621e1baa1d1a): candidate patterns are cited in F023/F026/F030/F031/F032/F033 routes with the matrix's mandatory adaptation rules (durable approval, role-aware domain services, fail-closed limiting, canonical media provenance, no demo providers or client-only persistence); no feature depends on AGIREAL for its foundation
- This session performed static inspection only: no installs, builds, tests, migrations, or live-database access were executed, and no application code, configuration, or Git state was modified; the only file written is this blueprint JSON under .fable-5/blueprints/
- gate_status is needs_decision because the roadmap cannot proceed past M01 without human input: D01/D02 gate the critical F001 migration, D05 gates Storefront capture and everything downstream of it, D06 gates the F002 closure feeding four migrations, and D08-D11 gate the console, conversion, contracts, and AI workstreams; M01's baseline work (F018/F019/F038 start) is safe to begin upon human review of this blueprint, but implementation authorization remains one bounded layer at a time and this blueprint grants none
