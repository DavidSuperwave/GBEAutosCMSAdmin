## 1. Bottom line

**Verdict: `revise`.** Primary evidence: `static-analysis`, supplemented by `runtime-verified` preflight.

The roadmap remains directionally useful, but it is not safe to orchestrate as written at the current packet state:

- Later commits materially improved authorization, public/preview DTOs, media review, and vehicle publish enforcement.
- Those fixes remain undermined by the “missing role means admin” fallback and several raw collection/global boundaries.
- `WP-00`, `WP-02`, `WP-03`, and `WP-04` contain cross-repository, tenant-dependent, environment-dependent, or multi-model scope that cannot be completed as one bounded Admin feature.
- The Admin style guard now passes, so the roadmap’s immediate CSS failure is stale; the underlying 8,721-line global styling architecture remains.
- The claimed absence of a reproducible test/release system remains substantially correct.

## 2. Capability preflight summary

| Capability | Result | Classification | Evidence |
|---|---|---|---|
| OS | MINGW64/Windows 10 build 26200 | `works` | `runtime-verified` |
| Python | 3.13.7 | `works` | `runtime-verified` |
| Node | 22.22.2; repository declares `22.x` | `works` | `runtime-verified` |
| npm | 11.8.0 through `npm.cmd`; PowerShell blocks `npm.ps1` | `works` overall; original shim `sandbox-blocked` | `runtime-verified` |
| Lockfile | npm lockfile v3, 17 runtime and 10 development dependencies | `works` | `static-analysis` |
| DNS | `example.com` resolved over A and AAAA | `works` | `runtime-verified` |
| HTTPS egress | TCP connection to `example.com:443` refused before HTTP/TLS | `network-auth` | `runtime-verified` |
| Packet state | 166 files; base `e473521`, HEAD `d6d505f6`, four commits, uncommitted overlay | `works` | `static-analysis` |
| Git metadata | Absent from packet root and `repo/`; supplied diffs are authoritative | `works` | `static-analysis` |
| Admin style guard | Passed | `works` | `runtime-verified` |
| TypeScript | Could not start: `node_modules` absent and package unavailable offline | `missing-dep` | `blocked-by-sandbox` |
| ESLint | Could not start: local `cross-env` absent | `missing-dep` | `blocked-by-sandbox` |
| `git diff --check` | Not applicable without `.git` | `works` | `not-tested` |
| Production build | Deliberately not run per consultation contract | `works` | `not-tested` |
| Browser/visual QA | Deliberately not requested or run | `works` | `not-tested` |

## 3. Roadmap delta matrix

| ID | Status | Roadmap claim | Current repository evidence | Change since `e473521` | Remaining acceptance proof |
|---|---|---|---|---|---|
| **P0-1** | **partially-addressed** | Raw APIs and privileged workflow endpoints expose data or permit unauthorized operations. | Raw Vehicles, Collections, and Vehicle Media Assets now require authentication: `repo/src/collections/Vehicles.ts:243`, `repo/src/collections/VehicleCollections.ts:54`, `repo/src/collections/VehicleMediaAssets.ts:15`. Invite, specs, import, workshop, photo, assignment, review, and preview paths call `requireCmsRole`: `repo/src/app/(payload)/api/users/invite/route.ts:47`, `repo/src/app/(payload)/api/cms/vehicle-specs/route.ts:127`, `repo/src/app/(payload)/api/cms/import/run/route.ts:41`, `repo/src/app/(payload)/api/cms/workshop/generate/route.ts:282`, `repo/src/app/(payload)/api/public/vehicles/preview/[id]/route.ts:12`. Residual unsafe boundaries remain: roleless users become admins at `repo/src/access/roles.ts:31`; Pages are public at `repo/src/collections/Pages.ts:30`; Dealership documents including `internalNotes` are public and mutations use Payload defaults at `repo/src/collections/Dealerships.ts:5` and `:55`; SiteConfig omits update policy at `repo/src/globals/SiteConfig.ts:10`; public Leads creation covers management fields at `repo/src/collections/Leads.ts:7` and `:80`; Analytics creation is public and any authenticated user may update/delete at `repo/src/collections/AnalyticsEvents.ts:5`. Raw REST and GraphQL remain mounted at `repo/src/app/(payload)/api/[...slug]/route.ts:14` and `repo/src/app/(payload)/api/graphql/route.ts:6`. Evidence: `static-analysis`. | Commit `e9484c9` added the shared role guard, protected preview/invite/specs/workshop, and converted three raw reads to authenticated. The base diff also adds field-level media approval protection. | Automated anonymous/roleless/every-role matrix against raw REST, GraphQL, custom endpoints, Local API calls, and public DTO snapshots; runtime body-size/rate-limit tests; staging role migration proof. |
| **P0-2** | **open** | Payload media uses non-durable local uploads while a separate Supabase sync path does not establish one canonical public media contract. | Media remains `upload: true` at `repo/src/collections/Media.ts:28`; Payload has `plugins: []` and no storage adapter at `repo/src/payload.config.ts:149` and `:167`. The sync script explicitly treats direct vehicle URL updates as a legacy exception at `repo/scripts/sync-vehicle-images.mjs:321`. Evidence: `static-analysis`. | No committed or uncommitted storage-adapter change. Later commits strengthened media approval/assignment, not byte durability. | On staging: upload through Payload, record hash/URL, redeploy, retrieve and compare hash, exercise delete, and reconcile every `imageUrl`/storage path to a canonical Media relationship. |
| **P0-3** | **partially-addressed** | Pages, homepage, and vehicle content lack safe draft/version/publish semantics. | No `versions`/`drafts` configuration exists in Pages, SiteConfig, or Vehicles: their configs end without it at `repo/src/collections/Pages.ts:105`, `repo/src/globals/SiteConfig.ts:157`, and `repo/src/collections/Vehicles.ts:249`. Homepage still posts directly to the live global and states that save publishes at `repo/src/components/views/HomeBuilder.tsx:22` and `:38`. Hidden sections remain React-only state at `repo/src/components/admin-ui/SectionBuilder.tsx:232` and `:308`. Vehicle publication is now enforced server-side for merged original/new data at `repo/src/collections/Vehicles.ts:316` and `:358`; the workspace dirty guard is only client-side at `repo/src/components/views/VehicleWorkspaceTab.tsx:781`. Evidence: `static-analysis`. | `e9484c9` added collection-hook publish/media enforcement and authenticated preview. `65ab237` added dirty-state/navigation guards. These do not supply versions, rollback, optimistic concurrency, or page/global drafts. | Separate staging proofs for Pages, tenant SiteConfig, and vehicle content: save draft, anonymous non-visibility, preview, publish, unpublish, rollback, concurrent-edit conflict, and persisted visibility. |
| **P0-4** | **partially-addressed** | Admin styling is unstable because of a huge global stylesheet and a failing duplicate-selector guard. | `npm run check:admin-styles` now passes (`runtime-verified`). However Payload imports the single global stylesheet at `repo/src/app/(payload)/layout.tsx:10`; it is 8,721 lines/188,634 bytes, and no CSS/SCSS module exists. The guard checks selected selector owners rather than the whole stylesheet at `repo/scripts/check-admin-styles.mjs:25` and `:92`. Evidence: `runtime-verified` plus `static-analysis`. | The four commits add substantial UI/CSS work; the immediate duplicate-selector failure is gone. The uncommitted logo adds more global CSS. | Clean Node 22 CI style pass plus component ownership limits; later, scoped-style migration and real-browser regression proof. |
| **P0-5** | **partially-addressed** | Numeric pricing, complete filters, collection controls, and analytics-backed smart ranks are incorrect or missing. | `price` is still text at `repo/src/collections/Vehicles.ts:603`. Public list options omit price and color at `repo/src/services/publicVehicleCatalog.ts:79`; sort still applies text price and maps all three analytics ranks to newest at `:164`; there is no `yearAsc`. Collection detail accepts only page/limit at `repo/src/app/(payload)/api/public/collections/[slug]/route.ts:22`. The public service now consistently enforces published/non-sold visibility at `repo/src/services/publicVehicleCatalog.ts:206` and returns bounded DTO fields at `:10`. Evidence: `static-analysis`. | `e9484c9` consolidated public detail/list/collection serialization, visibility, and approved-media policy. It did not implement numeric price, missing filters, facets, or smart ranks. | Admin API contract tests for numeric migration/backfill, null/range handling, all filters and sorts, facets and pagination. UI/URL reconciliation remains a Storefront dependency and is unknown here. |
| **P0-6** | **open** | Lead and analytics ingestion can be spoofed or double-counted and the dashboard is not based on trustworthy rollups. | The Admin still exposes public raw creation for complete Lead and Analytics schemas at `repo/src/collections/Leads.ts:7` and `repo/src/collections/AnalyticsEvents.ts:5`; management fields remain client-settable at `repo/src/collections/Leads.ts:80`. Dashboard results are capped at a configurable 300-row default at `repo/src/components/AnalyticsDashboard.tsx:107` and `:123`. Evidence: `static-analysis`. | Later commits add dashboard timeouts/concurrency and resilient failure display, not ingestion validation, idempotency, attribution, rate limits, or rollups. | Staging fixture journeys proving one submission equals one conversion, schema/body rejection, replay idempotency, rate limiting, server timestamps, role-scoped management, and rollup reconciliation. Storefront double-counting is carried forward, not revalidated. |
| **P0-7** | **open** | No tenant, membership, domain, quota, or cross-tenant isolation boundary exists. | Registered collections/globals contain no tenant model at `repo/src/payload.config.ts:107`; plugins remain empty at `:167`; repository-wide tenant search found no implementation. Evidence: `static-analysis`. | No tenant-related committed or uncommitted change. | Staging tenant A/B isolation matrix across reads, mutations, relationships, search, media, imports, preview, leads and analytics; host-derived tenant resolution; reversible GBE backfill. |
| **WP-00** | **partially-addressed** | Establish Node 22 CI, builds/checks, seeded staging, route inventory, browser baseline, and corrected documentation. | The runtime is Node 22 and the style guard passes. A read-only DB/API smoke script exists at `repo/scripts/production-e2e-smoke.ts:98` and `:409`, but `repo/package.json:7` has no unit, integration, Playwright, or contract test command; no `.github` workflow or test/config directory is present. Evidence: `runtime-verified` plus `static-analysis`. | The production smoke script was expanded and the style defect was repaired. No CI/test framework was added. | Clean checkout on Node 22: install, typecheck, lint, style, build, focused integration tests and retained artifacts. Seeded tenants must wait for a tenant schema. Storefront build/browser work cannot be accepted from this packet. |
| **WP-01** | **partially-addressed** | Close every authorization and public DTO boundary in one package. | Many custom endpoint and vehicle DTO issues are fixed, but roleless users are still admins and residual Pages/Dealerships/SiteConfig/Leads/Analytics boundaries remain, as documented under P0-1. Evidence: `static-analysis`. | `e9484c9` implements a significant subset of WP-01. | Split into explicit-role migration, vehicle/public contract, remaining collection/global policies, and ingestion hardening; each needs negative REST/GraphQL/runtime tests. |
| **WP-02** | **open** | Install persistent storage, canonicalize media, backfill legacy image URLs, and prove durability and tenant isolation. | No adapter or canonical migration exists: `repo/src/collections/Media.ts:28`, `repo/src/payload.config.ts:167`. Evidence: `static-analysis`. | Media review/assignment policy improved; durability did not. | Adapter proof, new-write cutover, inventory/backfill reconciliation, redeploy/hash/delete test. “Tenant path isolation” cannot be accepted before tenant identity exists. |
| **WP-03** | **partially-addressed** | Add numeric price, typed complete catalog queries, facets, correct collections, controls, and URL state. | The current service is a stronger typed DTO/query foundation, but pricing remains text, price/color/year-ascending are absent, smart ranks fall back, and collection detail does not accept caller filters. Evidence: `static-analysis`. | Public catalog and collection DTO behavior was consolidated in `e9484c9`. | Split Admin schema/backfill from Admin API contract and Storefront UI integration. Only the first two are provable from this repository. |
| **WP-04** | **partially-addressed** | Prove drafts/versions/live preview for homepage, landing page, and vehicle detail in one spike. | Vehicle preview and publish gating improved, but none of the three data models has Payload drafts/versions; homepage still publishes on save and hidden state is not persisted. Evidence: `static-analysis`. | Preview authorization/DTO correctness and vehicle publish enforcement changed in `e9484c9`; client save guards changed in `65ab237`. | Split into three features. Begin with Pages-only draft/version proof; SiteConfig requires the tenant-singleton decision, and Storefront live-preview acceptance requires the missing Storefront repository. |

## 4. Findings

### F1 — Endpoint guards remain fail-open for roleless authenticated users

- **Severity:** High
- **Confidence:** High
- **Evidence type:** `static-analysis`
- **Path(s):** `repo/src/access/roles.ts:31`, `repo/src/services/cmsRequestAuth.ts:35`, affected guarded routes
- **Impact:** A legacy or newly malformed account without a role satisfies admin-only invite, preview, workshop, media-review, and collection policies.
- **Reasoning:** `requireCmsRole` is server-side and correctly centralized, but it delegates to `hasRole`; `getRoles` converts any authenticated roleless user to `['admin']`.
- **Fix:** Transactionally inventory/backfill current users to explicit reviewed roles, then make missing/invalid roles fail closed.
- **Regression test:** A roleless fixture receives 403 for every privileged route and cannot create/update protected fields; explicit admin behavior remains unchanged.

### F2 — P0-1 is stale in both directions

- **Severity:** High
- **Confidence:** High
- **Evidence type:** `static-analysis`
- **Path(s):** `repo/src/collections/Vehicles.ts:243`, `repo/src/app/(payload)/api/public/vehicles/preview/[id]/route.ts:12`, `repo/src/collections/Pages.ts:30`, `repo/src/collections/Dealerships.ts:5`, `repo/src/globals/SiteConfig.ts:10`
- **Impact:** Treating the original claim as wholly open would duplicate completed work; treating WP-01 as nearly done would leave exploitable boundaries.
- **Reasoning:** Vehicle/collection/media raw reads and affected custom endpoints were hardened, while Pages, Dealerships, globals, Lead/Analytics ingestion, role fallback, rate limits and body limits remain.
- **Fix:** Replace monolithic WP-01 with independently provable access features.
- **Regression test:** Generated matrix covering every collection/global operation, REST, GraphQL, Local API and custom endpoint for anonymous, roleless and each explicit role.

### F3 — Tenant-dependent acceptance is sequenced before tenant identity exists

- **Severity:** High
- **Confidence:** High
- **Evidence type:** `static-analysis`
- **Path(s):** `repo/src/payload.config.ts:107`, `repo/src/payload.config.ts:167`
- **Impact:** WP-00 cannot seed tenant A/B, and WP-02 cannot prove tenant media paths, without inventing temporary identities and causing avoidable remigration.
- **Reasoning:** There is no tenant schema, membership, resolver, or tenant-derived object key.
- **Fix:** Establish and migrate the tenant identity/context contract before tenant-scoped media backfill and multi-tenant fixtures.
- **Regression test:** Host/session-derived tenant context and A/B isolation tests must pass before media migration acceptance.

### F4 — WP-04 is three features plus an absent-repository dependency

- **Severity:** High
- **Confidence:** High
- **Evidence type:** `static-analysis`
- **Path(s):** `repo/src/collections/Pages.ts:28`, `repo/src/globals/SiteConfig.ts:7`, `repo/src/collections/Vehicles.ts:241`, `repo/src/components/views/HomeBuilder.tsx:22`
- **Impact:** A single Fable layer would mix migrations, three publishing models, preview protocols, rollback semantics and Storefront rendering.
- **Reasoning:** Pages are records, SiteConfig is a global that later needs tenant-singleton semantics, and vehicle detail content currently shares the live inventory record.
- **Fix:** Prove Pages first; decide tenant SiteConfig representation before its spike; isolate vehicle presentation content before adding versions.
- **Regression test:** Entity-specific draft/publish/rollback suites, with Storefront preview contract tested only when that repository is supplied.

### F5 — Workflow save guards improve UX but are not a concurrency boundary

- **Severity:** Medium
- **Confidence:** High
- **Evidence type:** `static-analysis`
- **Path(s):** `repo/src/components/views/VehicleWorkspaceTab.tsx:732`, `:781`; `repo/src/collections/Vehicles.ts:358`
- **Impact:** The UI prevents accidental local navigation/status changes, but two sessions can still overwrite each other and a direct request bypasses dirty-state checks.
- **Reasoning:** PATCH requests carry neither an expected version nor an `If-Match` value. Server hooks do enforce publish completeness, which is a separate and genuine boundary.
- **Fix:** Preserve the UI guards, but add versioned content or an explicit optimistic-concurrency contract where destructive overwrite matters.
- **Regression test:** Two-session stale-write test returns a conflict and preserves the newer revision; direct publication with critical issues is rejected server-side.

### F6 — The immediate CSS failure is stale; the architecture finding is not

- **Severity:** Medium
- **Confidence:** High
- **Evidence type:** `runtime-verified` and `static-analysis`
- **Path(s):** `repo/src/app/(payload)/layout.tsx:10`, `repo/scripts/check-admin-styles.mjs:25`, `repo/src/app/(payload)/custom.scss:1307`
- **Impact:** Keeping P0-4 worded as a current failing gate misdirects work, while declaring it resolved would encourage further global growth.
- **Reasoning:** The guard passes, but 8,721 global lines remain and the guard owns only selected selectors.
- **Fix:** Reclassify immediate stabilization as resolved and global-style isolation as staged architectural debt.
- **Regression test:** Style guard plus component-level ownership checks; later real-browser regression at supported breakpoints.

### F7 — WP-03 crosses the missing Storefront boundary

- **Severity:** Medium
- **Confidence:** High
- **Evidence type:** `static-analysis`
- **Path(s):** `repo/src/services/publicVehicleCatalog.ts:79`, `:164`, `repo/src/app/(payload)/api/public/collections/[slug]/route.ts:22`
- **Impact:** Admin work can prove schema and API correctness but cannot prove controls, URL state, or collection-page reconciliation.
- **Reasoning:** Those consumers live in `GBECMS`, which is absent.
- **Fix:** Split WP-03 into Admin schema/backfill, Admin catalog API, then a separately reviewed Storefront integration.
- **Regression test:** Admin API fixture suite first; cross-repository contract and browser tests after Storefront capture.

## 5. Corrected Admin/CMS orchestration sequence

1. **Operations gate — staging truth capture.** Capture Postgres/extensions, exposed schemas, grants/RLS, sanitized deployment settings, current user-role inventory, media inventory and backup/restore readiness. No code work proceeds to data migration without this evidence.

2. **WP-01A code — explicit-role fail-closed migration and focused security harness.** Backfill reviewed roles, remove implicit admin fallback, and establish the first negative authorization tests. This is the recommended first feature below.

3. **WP-00A code/CI — Admin-only Node 22 release harness.** Wire style, typecheck, lint, build and focused integration/security tests into required CI. Exclude monorepo creation, Storefront build, seeded tenants and browser baselines from this Admin feature.

4. **WP-01B code — vehicle raw/public/preview boundary.** Freeze public vehicle/collection DTO snapshots, verify published/non-sold and approved-media enforcement, and deny anonymous raw REST/GraphQL reads.

5. **WP-01C/D code — remaining boundaries, in two layers.**
   - Content/reference layer: Pages, Dealerships, Media, Tags and SiteConfig operation/field policies.
   - Ingestion layer: Leads and Analytics narrow endpoints, schemas, body limits, rate limits, idempotency and management-field protection.

6. **WP-04A code — Pages-only publishing proof.** Payload versions/drafts for one Page fixture, authenticated draft preview, anonymous published read, publish/unpublish and rollback. Do not include homepage or vehicle content.

7. **Tenant foundation — decision gate, then bounded code batches.** Define tenant identity, memberships, host resolution and GBE backfill; then scope collections in batches with A/B tests. Domain lifecycle is a later operations/code layer.

8. **WP-02A/B code and operations — durable media.**
   - A: adapter and canonical service for new writes with tenant-derived object keys.
   - B: inventory/backfill, reconciliation and cutover after staging durability proof.

9. **WP-03A/B code — catalog correctness.**
   - A: numeric `priceAmount`/currency migration and reconciliation.
   - B: complete Admin catalog filters, deterministic sorts, pagination and facets. Smart analytics ranks either receive trusted inputs or are removed.
   - Storefront controls and URL state remain a separate cross-repository gate.

10. **WP-04B/C code — remaining publishing models.**
    - Tenant SiteConfig/homepage after tenant-singleton representation is settled.
    - Vehicle presentation content after deciding whether it remains on Vehicles or becomes a versioned content model.

11. **Operator/style work.** Only after access, tenant context, media, catalog and publishing contracts stop moving. Treat the current passing style guard as the stabilization baseline.

## 6. Recommended first Fable feature

### WP-01A — Explicit-role fail-closed migration and authorization proof

**Goal**

Ensure that every authenticated user has an explicit role and that missing, null, malformed or unknown roles grant no privilege. Establish a focused security-test pattern that later WP-01 layers can extend.

**In-scope paths**

- `repo/src/access/roles.ts`
- `repo/src/collections/Users.ts`
- One new Payload migration and `repo/src/migrations/index.ts`
- User seed/fixture code needed for explicit role fixtures
- Focused authorization tests and their minimal test configuration/package script
- Invite plus representative guarded routes only as regression consumers; their behavior should not otherwise be redesigned

**Deliberate exclusions**

- Other collection/global access-policy changes
- Public DTO redesign
- Tenant schema or memberships
- Rate limiting/body limits
- Media storage
- Operator UI redesign
- Storefront changes
- Provider or SMTP live testing

**Security invariants**

- No authenticated roleless or invalid-role identity is treated as admin.
- Only explicit admins may invite users or assign/change role fields.
- Existing users are not silently deleted or locked out during migration.
- The migration never infers least-privilege business roles from activity or names.
- Local API/`overrideAccess` usage cannot bypass the endpoint’s authenticated explicit-role decision.
- Anonymous behavior remains denied.

**Migration/data constraints**

- Run a read-only staging inventory of users and role values first.
- Produce a human-reviewed mapping for every existing user.
- Apply explicit roles transactionally and idempotently; abort if an unmapped user remains.
- Preserve a pre-migration export and documented rollback.
- Only after the post-migration null/invalid count is zero may `getRoles` change to fail closed.
- Do not run this migration against production during blueprint/build-plan work.

**Acceptance criteria**

1. Every staged user has one valid explicit role.
2. Missing/null/unknown role resolves to no roles, never admin.
3. Role field create/update remains admin-only.
4. Roleless fixtures receive 403 from invite, specs, import, workshop, media review and preview.
5. Each explicit role’s representative allow/deny cases match the documented matrix.
6. Migration is idempotent and aborts on an unmapped user.
7. Existing explicit admins retain access.
8. Focused tests, style, typecheck, lint and clean Node 22 build pass.

**Proof commands for clean Node 22 CI/staging**

```bash
npm ci
npm run check:admin-styles
npx tsc --noEmit --incremental false
npm run lint
npm run test:security -- role-boundary
POSTGRES_POOL_MAX=1 npm run migrate
npm run test:security -- role-boundary
npm run build
```

The blueprint must add the currently absent `test:security` command and use an ephemeral or authorized staging database—not production.

## 7. Verified vs static vs blocked

| Category | Conclusions |
|---|---|
| **`runtime-verified`** | OS/runtime versions, Node 22 availability, npm via `npm.cmd`, DNS resolution, HTTPS connection failure, absent `node_modules`, and passing Admin style guard. |
| **`static-analysis`** | All authorization/request-path conclusions; raw REST/GraphQL exposure; DTO shape and visibility; server publish/media enforcement; absence of drafts/storage/tenancy/tests; catalog behavior; workflow guard limits; current/base delta. |
| **`blocked-by-sandbox`** | TypeScript and lint because dependencies were not installed, the filesystem is read-only, and package resolution has no HTTPS egress. |
| **`not-tested`** | Production build by explicit instruction; database migrations/smoke/seed/cleanup; live Supabase, storage, SMTP and providers; browser/visual behavior; Storefront behavior. |

A clean Node 22 environment must run `npm ci`, style, typecheck, lint, focused tests and build before any code-layer acceptance.

## 8. Evidence ledger

| cwd | command | exit code | classification | proof excerpt or artifact path |
|---|---|---:|---|---|
| packet root | `Get-Content -Raw ...\skills\consult\SKILL.md` | 0 | `works` | Loaded Fable consultation contract. |
| packet root | `Get-Content -Raw .\ORIENT.md` | 0 | `works` | Loaded classifications/evidence rules. |
| packet root | `Get-Content -Raw .\CONSULT.md` | 0 | `works` | Confirmed `plan-audit` contract. |
| packet root | `Get-Content -Raw .\PRIOR_CONTEXT.md` | 0 | `works` | Output truncated; followed by complete chunk reads. |
| packet root | `$lines=Get-Content PRIOR_CONTEXT.md; $lines[0..279]` | 0 | `works` | Roadmap through P0-7. |
| packet root | `$lines=Get-Content PRIOR_CONTEXT.md; $lines[280..559]` | 0 | `works` | Architecture through Wave 2. |
| packet root | `$lines=Get-Content PRIOR_CONTEXT.md; $lines[560..end]` | 0 | `works` | Remaining waves, WP-00..04 and decision record. |
| packet root | Parallel `uname -a`; `python3 --version`; `node --version`; `npm --version` | 1 | `sandbox-blocked` | `npm.ps1` blocked by PowerShell execution policy. |
| packet root | `uname -a` | 0 | `works` | `MINGW64_NT-10.0-26200`. |
| packet root | `python3 --version` | 0 | `works` | Python 3.13.7. |
| packet root | `node --version` | 0 | `works` | Node v22.22.2. |
| packet root | `npm.cmd --version` | 0 | `works` | npm 11.8.0. |
| packet root | `Resolve-DnsName example.com` | 0 | `works` | A and AAAA answers returned. |
| packet root | `curl.exe -sSI https://example.com` | 1 | `network-auth` | TCP connect to port 443 failed after 42 ms. |
| packet root | `Get-ChildItem -Force ...` | 0 | `works` | Packet root inventory. |
| packet root | `Get-Content -Raw .\CONTENTS.md` | 0 | `works` | 166 files, npm/package-lock packet. |
| packet root | `Get-Content -Raw .\manifest.json` | 0 | `works` | Full capture manifest. |
| packet root | `Get-ChildItem -Recurse -Force .\review` | 0 | `works` | Located commit log, base diff, diffstat, uncommitted diff. |
| packet root | `Get-Content -Raw .\REVIEW_META.md` | 0 | `works` | Base/HEAD/four commits/uncommitted overlay. |
| packet root | `Get-Content -Raw .\review\commit_log.txt` | 0 | `works` | Four workflow commits. |
| packet root | `Get-Content -Raw .\review\diffstat.txt` | 0 | `works` | 45 changed files, +3,614/-868. |
| packet root | `Get-Content -Raw .\review\uncommitted.diff` | 0 | `works` | Launch config, mileage formatter, logo/CSS changes. |
| packet root | `Test-Path .\.git; Test-Path .\repo\.git` | 0 | `works` | Both false. |
| packet root | `rg --files .\repo` | 0 | `works` | Inspected complete captured tree. |
| `repo` | `Get-Content -Raw .\package.json` | 0 | `works` | Node 22; scripts and dependency declarations. |
| `repo` | PowerShell `ConvertFrom-Json` lockfile summary | 0 | `sandbox-blocked` | PowerShell parser rejected a package-lock property; Node retry used. |
| `repo` | `Get-Content package-lock.json -TotalCount 80` | 0 | `works` | Lockfile v3/root declarations. |
| `repo` | `node -e "...require('./package-lock.json')..."` | 0 | `works` | Lockfile v3, Node 22, 17/10 dependencies. |
| `repo` | `Test-Path .\node_modules` | 0 | `works` | False. |
| `repo` | `npm.cmd run check:admin-styles` | 0 | `works` | “Admin style guard passed.” |
| `repo` | `npx.cmd tsc --noEmit --incremental false` | 124 | `missing-dep` | Timed out attempting dependency resolution. |
| `repo` | `npm.cmd exec --offline -- tsc ...` | 1 | `missing-dep` | `ENOTCACHED`; no local TypeScript executable. |
| `repo` | `npm.cmd run lint` | 1 | `missing-dep` | `cross-env` not found. |
| `repo` | `rg -n "access:|requireCmsRole|overrideAccess|..." ...` | 0 | `works` | Access/route inventory. |
| `repo` | `rg -n "." roles/cms auth/Users/Vehicles/Collections` | 0 | `works` | Role fallback and collection policies. |
| `repo` | Numbered `Vehicles.ts` lines 240–390 | 0 | `works` | Server publish and media enforcement. |
| `repo` | `rg -n` public catalog symbols/filters/sorts | 0 | `works` | Catalog behavior map. |
| `repo` | Numbered public catalog ranges 1–240, 480–720 | 0 | `works` | DTO, visibility, filters, collection behavior. |
| `repo` | `rg -n "."` public vehicle/preview routes and preview page | 0 | `works` | Request paths and DTO use. |
| `repo` | `rg -n` auth/body/rate patterns across custom routes | 0 | `works` | Invite/specs/import/workshop/media authorization. |
| `repo` | `rg -n` media policy/review/assignment patterns | 0 | `works` | Approval/rights/assignment/demotion boundary. |
| `repo` | `rg -n` drafts/publish/save/preview patterns | 0 | `works` | Publishing model inventory. |
| `repo` | `rg -n "."` Pages/SiteConfig/Home/HomeBuilder | 0 | `works` | Direct-save and absent versions. |
| `repo` | Numbered `SectionBuilder.tsx` ranges | 0 | `works` | React-only hidden state and preview messaging. |
| `repo` | Numbered `VehicleWorkspaceTab.tsx` lines 732–819 | 0 | `works` | Client save/status guard and PATCH shape. |
| `repo` | Count/size `custom.scss` | 0 | `works` | 8,721 lines; 188,634 bytes. |
| `repo` | `rg --files src \| rg "\.module\.(css\|scss)$"` | 1 | `works` | No scoped CSS/SCSS modules found. |
| `repo` | Test/CI/config file and framework search | 0 | `works` | No test framework/config/workflow; only false-positive code matches. |
| `repo` | `rg -n` production smoke behavior | 0 | `works` | DB/API smoke, not browser E2E. |
| `repo` | `rg -n` media/storage/SMTP/Supabase config | 0 | `works` | No Payload storage adapter; separate sync path. |
| `repo` | Numbered Media and Payload config ranges | 0 | `works` | `upload:true`, Postgres/email config, `plugins:[]`. |
| `repo` | Price/currency field search | 0 | `works` | Only text `price`; no `priceAmount`/currency. |
| `repo` | Numbered `Vehicles.ts` lines 590–620 | 0 | `works` | Text price schema. |
| `repo` | `rg -n "."` Analytics/Leads/dashboard files | 0 | `works` | Public ingestion and capped dashboard queries. |
| `repo` | Repository tenant/domain search | 1 | `works` | No matches. |
| `repo` | Numbered Payload registrations 100–124 | 0 | `works` | No tenant collection/global. |
| `repo` | `rg -n "."` public collection routes/media/dealerships | 0 | `works` | DTO collection route and residual raw policies. |
| packet root | `rg -n` relevant base-diff hunks | 0 | `works` | Located authorization/DTO/media/publish changes. |
| packet root | Numbered selected `current.diff` ranges | 0 | `works` | Verified exact base-to-HEAD changes. |
| `repo` | `rg -n "." scripts/check-admin-styles.mjs` | 0 | `works` | Guard ownership scope. |
| `repo` | `rg -n "."` raw REST/GraphQL routes | 0 | `works` | Raw APIs remain mounted. |
| `repo` | Layout/global-style import and selector search | 1 | `works` | Proved `custom.scss` import and representative global selectors; final no-match status caused exit 1. |

## 9. Unknowns and cross-repository limits

| Unknown | Evidence status | Exact resolving query, capture, or experiment |
|---|---|---|
| Live Postgres version | `not-tested` | `select version(); show server_version;` |
| Installed extensions | `not-tested` | `select extname, extversion from pg_extension order by extname;` |
| Data API exposed schemas | `not-tested` | Capture Supabase **API Settings → Exposed schemas** and compare with PostgREST configuration. |
| Grants to API roles | `not-tested` | `select table_schema, table_name, grantee, privilege_type from information_schema.role_table_grants where grantee in ('anon','authenticated','service_role') order by 1,2,3,4;` |
| RLS state and policies | `not-tested` | `select schemaname, tablename, rowsecurity, forcerowsecurity from pg_tables where schemaname not in ('pg_catalog','information_schema');` plus `select schemaname, tablename, policyname, roles, cmd, qual, with_check from pg_policies order by 1,2,3;` |
| Deployed environment settings | `not-tested` | Export a sanitized Vercel Preview/Production key-presence matrix and nonsecret values for URLs, flags, pool limits and provider enablement; do not expose secrets. Compare it to `.env.example`. |
| Current users and role quality | `not-tested` | `select role, count(*) from users group by role order by role;` and an approved identity-to-role mapping for null/invalid values. |
| SMTP behavior | `not-tested` | In staging with a sandbox inbox, request invite and password reset; verify exactly one message, sender, link host, token single-use/expiry and failure logging. |
| RapidAPI/CarsXE/OpenRouter behavior | `not-tested` | Use staging keys and capped quotas; capture success, 401/403/429, timeout, malformed payload, oversized media and retry behavior. Do not use production quotas for blueprint verification. |
| Persistent object durability | `not-tested` | Upload a uniquely hashed fixture through Payload, redeploy/restart, retrieve and hash-compare it, then delete and verify metadata/object lifecycle. |
| Current production data | `not-tested` | Read-only snapshot of collection counts, publish/inventory status distributions, null/invalid prices, unresolved `imageUrl` versus Media relations, duplicate source/stock IDs and null roles; archive the query output with timestamp/environment identifier. |
| Storefront catalog/filter behavior | `not-tested` | Capture `GBECMS` at an exact SHA, run its clean checks, and trace its request/URL/UI paths against the versioned Admin catalog contract. |
| Storefront analytics double-counting and fallback data | `not-tested` | With the Storefront repository, execute one fixture journey and reconcile emitted HTTP events, Lead creation and resulting analytics rows by event/idempotency ID. |
| Cross-repository block/live-preview compatibility | `not-tested` | Provide Storefront block renderer/types and run shared contract fixtures for every registered block and unknown-block behavior. |

All Storefront conclusions in the supplied roadmap are **carried-forward or unknown**, not revalidated. This packet proves only the Admin/CMS producer side and its embedded authenticated preview page.

## 10. Next steps

Run `/fable:blueprint` for **WP-01A — Explicit-role fail-closed migration and authorization proof**, using the feature contract in Section 6 as the sole first feature.