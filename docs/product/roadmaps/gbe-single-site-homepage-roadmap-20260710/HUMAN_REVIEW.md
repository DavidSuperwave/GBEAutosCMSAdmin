# Human Review Gate

**Current gate status:** `needs_decision`

No feature or layer is approved for implementation by this document.

## Decisions required

### D01 — What is the exact permission matrix for the three target roles admin, general, and sales?

The human decisions doc confirms exactly three roles but states the permission matrix still requires review. The code currently spreads capability across six roles (canManageInventory, canManageContent, canManageMedia, MEDIA_REVIEW_ROLES, canManageLeads in src/access/roles.ts:60-86), and every guard, field access rule, and custom route must be rewritten against the new matrix. Engineering cannot infer which of general/sales inherits inventory, content, media review, or lead management.

- Approve a written per-collection/per-operation matrix for admin, general, and sales before F001 implementation starts
- Map general = all current non-admin operational capabilities and sales = lead/analytics management only, then refine after launch
- Defer any capability change and only rename/collapse roles 1:1 (not recommended — leaves the matrix ambiguous)

### D02 — What is the explicit per-user role mapping for the three existing user rows (including any null/blank/legacy values)?

The live enum has six roles and public.users reports 3 rows, but exact role values per user are unknown (the aggregate SQL was cancelled) and the audit states no legacy role can be automatically mapped to general or sales. getRoles currently treats roleless users as admins (src/access/roles.ts:38), so the fail-closed migration must not run until a human signs off who holds which target role. This mapping is a private human process whose identity-level output stays out of the audit trail.

- Run the safe role-distribution capture, then privately review and sign off a mapping for every user before the migration
- Default all three users to admin explicitly and downgrade later (ratifies over-privilege but preserves access)
- Default unmapped users to no role (fail-closed immediately; risks locking out active staff)

### D03 — Which content wins the homepage reconciliation: the registered site_config rows or the legacy home/home_stats/home_brands rows?

Both models contain live rows ([MCP-live-verified]), so making site_config the single source of truth (confirmed direction) requires deciding whether any legacy home content must be migrated into site_config blocks before the home family and unregistered src/globals/Home.ts are retired. Content value judgments belong to the business, not engineering.

- Review both contents side by side and hand-pick what migrates into site_config before retiring the legacy family
- Declare current site_config content canonical as-is and archive/drop the legacy rows after a backup export
- Migrate everything from home into site_config mechanically and edit down afterwards

### D04 — Remove or temporarily hide the smart analytics sort ranks (mostViewed/mostClicked/mostLeads) until trusted rollups exist?

src/services/publicVehicleCatalog.ts:174-179 silently maps all three ranks to -createdAt, and analytics ingestion is publicly spoofable (src/collections/AnalyticsEvents.ts:6), so the public contract is currently misleading. The human decisions doc recommends removing or hiding them temporarily but leaves the choice open.

- Remove them from the public contract until F006 ingestion hardening plus a rollup layer exist (recommended)
- Hide them in the UI but keep API acceptance with documented newest fallback
- Keep them and fast-track trusted rollups as a dependency of F012

### D05 — Which Storefront repository commit (pinned SHA) is the verification target for F017?

The repository root redirects to /admin (src/app/(frontend)/page.tsx:4); the main GBE website lives elsewhere and consumes the homepage, navigation, inventory, media, dealership-link, preview, and analytics contracts. F017 cannot start without the exact consumer capture, and all Storefront conclusions so far are carried forward, not verified.

- Supply the GBECMS Storefront repository at a pinned SHA and wire a cross-repository contract-test gate
- Accept Admin-side API contract tests as the acceptance boundary and defer Storefront verification (weakens the release gate)

### D06 — Who executes the blocked read-only SQL captures, and through which channel, to close F002?

Every execute_sql request was cancelled by the MCP layer before execution, leaving Postgres version, table bytes, forced-RLS, policy/grant inventory, SECURITY DEFINER functions, Storage bucket restrictions, and all exact aggregates unknown. The audit ships the exact read-only transactions to run; an authorized operator must run them and archive catalog/aggregate output only. Role-distribution output feeds D02 and migration planning; policy/grant output determines how much of the 35 RLS-without-policy surface matters.

- An authorized operator reruns the audit's read-only SQL through the same Supabase MCP project with execute_sql approved, archiving outputs beside the audit
- Run the same SQL via the Supabase dashboard SQL editor read-only and archive sanitized outputs
- Accept the unknowns and gate each dependent feature on its own just-in-time capture (slower, repeats risk)

### D07 — Should vehicle presentation content be versioned separately from operational inventory fields (F014)?

Landing/presentation fields share the live vehicle record (src/collections/Vehicles.ts) with no versions config, so enabling Payload versions on Vehicles would version operational churn (inventoryStatus, publishStatus) together with marketing content. The human decisions doc explicitly leaves this open and states it must not block homepage work.

- Extract presentation content into a separate versioned collection related to Vehicles
- Enable versions/drafts on Vehicles as-is and accept mixed inventory/content history
- Keep vehicle content unversioned and rely on the existing publish gating (skip F014)

## Review checklist

- [ ] Product outcome is correct.
- [ ] Feature boundaries are correct.
- [ ] Repository classifications are supported by evidence.
- [ ] Recommended routes and dependencies are acceptable.
- [ ] Risks and unresolved decisions are understood.
- [ ] Select exactly one feature for build planning.

## Verification notes

- Live repository inspected at branch codex/admin-workflow-updates, HEAD d6d505f, on 2026-07-10; consultation evidence paths were re-verified against the live tree rather than trusted
- Re-verified by direct file read this session: six-role model and fail-open fallback (src/access/roles.ts:12-40), requireCmsRole delegation (src/services/cmsRequestAuth.ts:30-44), plugins:[] and Postgres adapter and SiteConfig-only globals registry (src/payload.config.ts:107-167), Media local upload with public read (src/collections/Media.ts:7-28), SiteConfig public-read-only access without versions (src/globals/SiteConfig.ts:7-23), unregistered legacy Home global (src/globals/Home.ts), root redirect to /admin (src/app/(frontend)/page.tsx:4), text price and overlapping status/image fields (src/collections/Vehicles.ts:604-643,743-771), Pages manual status without drafts (src/collections/Pages.ts:30-79), Dealerships public read with internal fields and no external URL (src/collections/Dealerships.ts:5-65), anonymous Leads/AnalyticsEvents creation (src/collections/Leads.ts:7-12, src/collections/AnalyticsEvents.ts:5-10), admin-only role field with viewer default (src/collections/Users.ts:44-56), mounted raw REST and GraphQL (src/app/(payload)/api/[...slug]/route.ts, src/app/(payload)/api/graphql/route.ts), bounded public DTO routes (src/app/(payload)/api/public/*), catalog option/sort gaps and smart-rank fallback (src/services/publicVehicleCatalog.ts:79-181), legacy-role preview guard (src/app/(payload)/api/public/vehicles/preview/[id]/route.ts:12-16), publish-on-save HomeBuilder (src/components/views/HomeBuilder.tsx:23-38), and the service-role sync script with bucket 'vehicle-images' and direct-DB-update flag (scripts/sync-vehicle-images.mjs:22-39)
- Re-verified by search/command: no versions/drafts config anywhere under src (grep matches only a 2026-05-21 migration's generated table names); no tenant model under src; no .github/workflows directory; package.json has no test or typecheck script and pins node 22.x; src/migrations holds 15 registered migration modules (17 entries including index.ts and a schema JSON), consistent with the audit's 15-vs-17 reconciliation requirement
- Live-database claims ([MCP-live-verified] role enum, 93 RLS-enabled tables, 35 no-policy tables, home vs site_config rows, 277 Storage objects vs 42 media rows, migration registries, advisor findings) are accepted from the consultation's evidence ledger; they are not independently reproducible from this repository and their remaining unknowns are exactly what F002/D06 exist to close
- This session performed static inspection only: no installs, builds, tests, migrations, or live-database access were executed, and no application code, configuration, or Git state was modified
- Feature IDs F001-F017 preserve the numbering of the prior blueprint (docs/product/roadmaps/gbe-platform-roadmap-20260710/BLUEPRINT.json) with the consultation's revised dispositions applied: F008 removed (obsolete_or_duplicate/no_build_needed), F009 and F013 unblocked with F013 pulled ahead of F007, F001 revised to the three-role enum migration, and F002 kept open pending the D06 captures
- gate_status is needs_decision because the first buildable feature (F001) is gated on the D01 permission matrix and D02 per-user mapping, and F002's closure requires the D06 capture authorization; no feature should start implementation before those decisions
