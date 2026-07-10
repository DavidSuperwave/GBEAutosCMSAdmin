# Human Review Gate

**Current gate status:** `needs_decision`

No feature or layer is approved for implementation by this document.

## Decisions required

### D01 — Approve the explicit identity-to-role mapping for every existing user (including null/legacy accounts) before the fail-closed migration runs?

src/access/roles.ts:38 currently grants admin to any authenticated roleless user. Making getRoles fail closed without a human-reviewed mapping could lock out or silently demote real staff; inferring roles from activity is explicitly forbidden by the consultation's security invariants. Only the business owner can say who should hold which role.

- Review the read-only staging user/role inventory and sign off a per-user explicit role mapping before migration
- Default every unmapped legacy user to admin explicitly (preserves today's effective behavior but permanently ratifies over-privilege)
- Default every unmapped legacy user to viewer and handle escalation requests manually (safest, risks workflow disruption)

### D02 — What is the tenant identity and representation contract — and is multi-tenancy actually in scope for this product now?

No tenant model exists (src/payload.config.ts:107-123 registers no tenant collection; repository-wide search finds none). The consultation blocks tenant-scoped media object keys, seeded tenant A/B fixtures, and SiteConfig-per-tenant publishing until identity, membership, host resolution, and GBE backfill semantics are decided. This is a product-direction decision, not an engineering one.

- Commit to multi-tenant: define tenant collection, memberships, host-derived resolution, and a reversible GBE backfill before WP-02 media keying
- Stay single-tenant for now: proceed with media durability using non-tenant object keys and accept a later key-migration cost
- Defer: complete authorization, media durability, catalog, and publishing for GBE only, and revisit tenancy as a separate initiative

### D03 — Where does versioned vehicle presentation content live — on the Vehicles collection or in a separate content model?

Vehicle landing/presentation content currently shares the live inventory record (src/collections/Vehicles.ts landing fields; no versions config). Enabling Payload versions on the whole Vehicles collection would version operational inventory state together with marketing content; splitting requires a migration. The consultation requires this decision before the WP-04C spike.

- Enable versions/drafts on Vehicles as-is and accept mixed inventory/content versioning
- Extract presentation content into a separate versioned collection related to Vehicles
- Keep vehicle content unversioned and rely on the existing publish-gating only

### D04 — Keep or remove the 'smart' analytics-backed sort ranks (mostViewed/mostClicked/mostLeads)?

src/services/publicVehicleCatalog.ts:164-181 silently maps all three analytics ranks to -createdAt, and the underlying analytics ingestion is publicly spoofable (src/collections/AnalyticsEvents.ts:5-10). They must either receive trusted, deduplicated inputs (a real dependency on ingestion hardening and rollups) or be removed from the public contract.

- Remove the smart ranks from the public API until trustworthy rollups exist
- Keep them, sequenced strictly after ingestion hardening (F006) and a rollup layer, with contract tests
- Keep the current silent fallback to newest and document it (not recommended — misleading contract)

### D05 — Which durable object-storage provider backs Payload media?

Media is stored on the local filesystem (src/collections/Media.ts:28, plugins: [] at src/payload.config.ts:167), which does not survive redeploys on serverless hosting. Supabase Storage is already used by the out-of-band sync script (scripts/sync-vehicle-images.mjs) and @supabase/supabase-js is a dependency, but S3-compatible alternatives change the adapter, key scheme, cost, and backfill plan.

- Supabase Storage via an S3-compatible Payload storage adapter (aligns with existing Supabase usage and sync script)
- AWS S3 (or another S3 provider) via @payloadcms/storage-s3
- Vercel Blob via @payloadcms/storage-vercel-blob

### D06 — Will the Storefront repository (GBECMS) be captured at an exact SHA for cross-repository acceptance?

Catalog controls/URL state, live-preview block rendering, and analytics double-counting can only be proven against the consumer. All Storefront conclusions in the roadmap are carried forward, not revalidated; the consultation caps WP-03/WP-04 acceptance at the Admin API boundary until that repository is supplied.

- Capture GBECMS at a pinned SHA and add a cross-repository contract-test gate
- Accept Admin-side API contract tests as the acceptance boundary and defer Storefront verification

## Review checklist

- [ ] Product outcome is correct.
- [ ] Feature boundaries are correct.
- [ ] Repository classifications are supported by evidence.
- [ ] Recommended routes and dependencies are acceptable.
- [ ] Risks and unresolved decisions are understood.
- [ ] Select exactly one feature for build planning.

## Verification notes

- Live repository inspected at branch codex/admin-workflow-updates, HEAD d6d505f (identical to the consultation packet HEAD), with the same uncommitted overlay noted in git status; consultation evidence paths were re-verified against the live tree rather than trusted
- Re-verified by direct file read: roles fallback (src/access/roles.ts:31-40), requireCmsRole delegation (src/services/cmsRequestAuth.ts:30-44), Vehicles access/publish-gating/text-price (src/collections/Vehicles.ts:243-248, 358-363, 603-609), Pages/Dealerships/SiteConfig/Leads/AnalyticsEvents access blocks, Media upload:true, payload.config.ts plugins:[] and collection registry, raw REST route, GraphQL route presence, public catalog options/sorts/where-builder, collection route page/limit-only params, HomeBuilder direct global save, VehicleWorkspaceTab client-side guards, Users.ts admin-only role field
- Re-verified by search/command: no versions/drafts config in any collection or global (grep matches only a legacy vehicles migration and UI labels); no tenant/Tenant match under src; no .github directory; custom.scss is exactly 8,721 lines even with uncommitted changes; package.json has no test framework or test:security script
- Carried forward from the consultation without local re-execution (classification preserved): the passing check:admin-styles run, Node/npm/DNS/HTTPS runtime results, and the blocked typecheck/lint attempts — this session performed static inspection only and ran no installs, builds, tests, or migrations
- Not verifiable from this repository: everything in consultation Section 9 (live Postgres state, RLS/grants, deployed env settings, SMTP/provider behavior, object durability, production data quality, and all Storefront behavior) — F002 and F017 exist to convert these unknowns into evidence
- Feature classifications follow the consultation's delta matrix where the live tree agrees; 'requires_product_decision' is used where the audit gates work behind D01–D06 rather than where code is merely missing
