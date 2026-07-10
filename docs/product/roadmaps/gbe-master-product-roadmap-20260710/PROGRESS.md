# Master Roadmap Execution Log

Tracks in-repo delivery against `FEATURE_ROADMAP.md`. Human decisions live in `HUMAN_REVIEW.md`; live-DB evidence in `docs/product/evidence/`.

## M01 — Reproducible baseline ✅ (2026-07-10)

- **F018** — baseline quality harness + Node 22 CI (`.github/workflows/ci.yml`): style guard, migration checks, contract drift, typecheck, lint, tests, build. Commits `25a1d7b`, `c69a4b5`.
- **F020** — Storefront baseline capture at pinned SHA `d0e8fd0` + drift check (`contracts/storefront-consumption.json`, `scripts/check-storefront-contract.mjs`). Commit `4f31afc`.
- **F019** — staging/backup/migration-rehearsal runbook committed (`docs/product/runbooks/`). Commit `cca33b2`. **Open operator actions:** staging project provisioning, restore proof.
- **F038** — shared contracts module (`src/contracts/`). Commit `b49e2ea`.

## M02 — Operations evidence and security closure 🟡 in progress (started 2026-07-10)

Delivered in-repo:

- **F001 — COMPLETE (2026-07-10).** D01 approved by owner: three-role model admin/general/sales (general = inventory/content/media/imports/AI studio; sales = leads + read-only inventory). D02 trivially satisfied (all 3 users admin→admin). Code sweep across roles.ts and every consumer; migration `20260710_150000_three_role_model` (unmapped-user abort, legacy mapping, default `sales`) applied to the Supabase project via the authorized MCP channel with a role backup table (`_backup_users_role_20260710`) and the Payload tracker row inserted (batch 13). Owner designated this Supabase project as staging (client production not yet provisioned), so direct application was authorized. Verified post-migration: enum = admin/general/sales, 3 admins intact, app boots, login renders, public reads 200, raw anon reads 403. Note: `payload migrate` CLI could not connect through the pooler from this machine (pool-acquire timeout) — applied via Supabase MCP with identical SQL instead; keep tracker parity in mind for future migrations.
- **F002 — complete (evidence).** Read-only captures via authorized Supabase MCP channel archived at `docs/product/evidence/F002_OPERATIONS_TRUTH_CAPTURE_20260710.md`. Headlines: 3 users all valid `admin` (fail-closed flip lockout-safe; D02 mapping trivial); price empty on 100% of 1,391 vehicles; media dual-source quantified (1,388 direct-storage vs 4 canonical, 277/277 paths reconciled, single public bucket `vehicle-images`); `site_config` populated; one `dev` batch −1 migration marker flagged. Commit `a7383b0`.
- **F001 — urgent slice complete.** `getRoles` fails closed (missing/invalid role ⇒ no roles, values validated against the catalog). Deny-by-default matrix tests (`tests/access.test.ts`) run in CI. **Remaining:** three-role enum migration — gated on D01/D02 and staging (F019). Commit `a7383b0`.
- **F003 — in-CI slice complete.** Access-layer negative suite wired into the existing CI `npm test` gate. **Remaining:** REST/GraphQL/custom-route negative harness against ephemeral/staging Postgres — gated on F019 provisioning.
- **F006/F022 — additive slice complete.** Public lead/analytics ingestion guard (`src/services/publicIngestionGuard.ts`): submitter-field whitelists (management-field injection blocked; anonymous lead `stage` limited to `new`/`whatsapp_opened` to match the live Storefront), string caps, duration clamp, per-IP sliding-window rate limits (in-memory, per instance). `analytics-events` update/delete → admin-only. **Remaining:** narrow ingestion endpoints + idempotency keys, in lockstep with the Storefront migration off raw POSTs. Commit `22fbefc`.
- **F005 — slice complete.** Dealership `internalNotes`/`salesRepName` hidden from anonymous reads (contract-checked unconsumed by Storefront); explicit role-guarded mutations on Dealerships; `SiteConfig`/`Home` global update restricted to admin/content_editor. Live-verified: anonymous dealership read omits internal fields and keeps `whatsapp`; anonymous update of site-config → 403; anonymous reads of vehicles/leads/analytics → 403; public site-config/dealership reads intact. **Remaining:** `externalUrl` approved-redirect field (schema change → staging), bounded public dealership DTO endpoint + Storefront cutover. Commit `0993c0a`.

- **F005/F006 — bounded public endpoints live (2026-07-10).** `GET /api/public/dealerships` (safe DTO), `POST /api/public/leads` (replay-window idempotency, one-submission-one-lead proven live), `POST /api/public/analytics` (taxonomy-validated). Contracts exported from `src/contracts/publicIngestion.ts`. **Remaining:** Storefront cutover to these endpoints, then closing anonymous access to the raw collections + `site-config`/`pages` reads.

Blocked until human decisions / operator actions:

| Item | Blocked on |
| --- | --- |
| F001 full three-role migration | D01 matrix, D02 sign-off, F019 staging |
| F002 residual | none — evidence complete; D02 identity mapping reduced to confirming 3 admins |
| F003 full harness | F019 staging Postgres |
| F004 boundary contract tests (runtime) | F019 staging |
| F021 auth ops verification | staging SMTP + operator |
| F009/F010/F011 (M03 migrations) | F019 staging provisioning + restore proof |

**Next up when unblocked:** D01/D02 decision → F001 migration rehearsal on staging; F019 staging provisioning is the single highest-leverage operator action (unblocks F003/F004/F009/F010/F011).
