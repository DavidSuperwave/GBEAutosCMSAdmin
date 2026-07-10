# F002 — Operations Truth Capture (read-only live facts)

**Captured:** 2026-07-10
**Channel:** Supabase MCP (authorized read-only SQL) against project ref `bdnvgbdmqmbzemllqngs` (ACTIVE_HEALTHY, Postgres 17)
**Scope discipline:** aggregate/catalog output only — no user identities, no secrets, no object URLs beyond host-level prefixes. Per-user identity→role mapping (D02) remains a private human process; see note below on why it is trivial today.
**Feeds:** D02 (role mapping), F001 (fail-closed migration), F009 (bucket identity), F010 (media reconciliation), F011 (price quality), F013 (homepage completeness), F034 (WhatsApp routing readiness).

---

## 1. Roles (feeds D01/D02/F001)

Live role enum values (`enum_users_role`): `admin`, `content_editor`, `inventory_manager`, `media_editor`, `sales_manager`, `viewer` — the six-role model is confirmed live.

| Metric | Value |
| --- | --- |
| Total users | 3 |
| Role distribution | `admin` = 3 |
| Users with NULL/missing role | 0 |
| Users with values outside the enum | not possible (enum-typed column) |

**Implications:**
- The fail-open fallback in role resolution currently protects **zero** real users: every live user holds a valid `admin` role. Making role resolution fail closed for missing/invalid values **cannot lock out or demote any existing user**. The urgent F001 code slice is therefore safe to land ahead of the D01/D02 three-role enum migration.
- D02's per-user mapping burden is minimal: 3 users, all admin. When D01's target matrix is approved, the migration mapping is `admin → admin` for all current users unless the owner decides otherwise.

## 2. Pricing quality (feeds F011)

| Metric | Value |
| --- | --- |
| Total vehicles | 1,391 |
| `price` NULL or empty | **1,391 (100%)** |
| Parseable formatted values (`$1,234,567`) | 0 |
| Plain numeric values | 0 |
| Other text (e.g. "Consultar") | 0 |

**Implications:** there is **no price backfill problem** — there is a price *absence* problem. F011's numeric price model needs an explicit unknown/consultar state as the default, and the D04-style human review of ambiguous formatted values is moot for current data. The lexicographic-sort defect remains a schema defect but has no user-visible effect until prices are populated.

## 3. Vehicle lifecycle status (feeds F004/F012/F024)

| Field | Distribution |
| --- | --- |
| `publish_status` | draft = 1,389 · published = 2 |
| `inventory_status` | available = 1,391 |
| `image_status` | uploaded = 1,384 · approved = 4 · missing = 3 |
| `status` (legacy) | available = 1,391 |
| `_status` (Payload) | draft = 1,391 |

**Implications:** `publish_status` is the operative field; legacy `status` and Payload `_status` carry no signal (uniform values) and are candidates for the F004 canonical-status reconciliation. Only 4 vehicles have review-approved images — the media approval pipeline is the publishing bottleneck by design.

## 4. Media and storage (feeds F009/F010)

| Metric | Value |
| --- | --- |
| Supabase Storage buckets | 1: `vehicle-images`, **public = true** |
| Objects in `vehicle-images` | 277 |
| Distinct `vehicles.image_path` values | 277 |
| Image paths with a matching storage object | **277 / 277 (no orphans either direction)** |
| Paths shared by more than one vehicle | 135 (stock/press photos reused across trims) |
| Vehicles with direct-storage `image_url` (host `https://bdnvgbdmqmbzemllqngs.supabase.co`) | 1,388 |
| Vehicles with canonical Payload media (`image_id`) | 4 |
| Payload `media` rows | 42, all served via local `/api/media/file/...` (ephemeral on serverless) |
| `vehicle_media_assets` rows | 13 |

**Implications:**
- The dual source of truth is confirmed and quantified: sideloaded storage URLs are the de-facto image system (1,388), canonical Payload media is the exception (4).
- Reconciliation state is clean (every referenced path exists; no orphaned objects), so F010's cutover is a mapping exercise, not a repair job.
- F009 bucket facts: single public bucket `vehicle-images`; new canonical media should use a tenant-ready key convention (e.g. `tenants/gbe/...`) per the master-roadmap correction.
- The 42 Payload media rows on local upload paths are the durability risk: any redeploy can drop those files.

## 5. Homepage/site-config completeness (feeds D03/F013)

| Source | Rows |
| --- | --- |
| `site_config` (singleton) | 1 — with hero, brands, inventory_search, trust_steps (3 steps) blocks, 6 main nav links, 2 footer links, 1 legal link |
| Legacy `home` | 1 |
| Legacy `home_stats` | 3 |
| Legacy `home_brands` | 8 |
| `pages` | 0 (block tables have 3 stray rows: hero ×1, cta ×1 — orphan-check candidate for F007) |

**Implications:** `site_config` is populated and is the live homepage source; the D03 decision is between it and the small legacy `home*` set (1+3+8 rows). Content merge is a minutes-scale task once D03 is decided.

## 6. Leads, analytics, and routing readiness (feeds F006/F034/F036)

| Metric | Value |
| --- | --- |
| `leads` rows | 0 |
| `analytics_events` rows | 408 — page_view 295, page_duration 55, vehicle_view 44, filter_used 5, cta_click 4, collection_view 3, whatsapp_form_open 1, vehicle_click 1 |
| Dealerships | 22, **all 22 with WhatsApp numbers** |
| Vehicles with a dealership assignment | 1,391 / 1,391 (100%) |

**Implications:** analytics volume is small enough that the F006 ingestion redesign has no migration burden; the dealership/WhatsApp routing data needed for F034 is already complete.

## 7. Migrations (name-only listing)

17 applied migrations. Batches 1–12 are the named project migrations from `20260521_060610_site_builder_schema` through `20260611_180000_vehicle_image_sync_columns`, matching the repo's `src/migrations/`. One anomalous entry: **`dev` with batch `-1`** — a Payload dev-mode push marker, meaning at some point dev-mode schema push ran against this database. Flag for F019 rehearsal awareness: schema state may include dev-push artifacts not represented by a named migration.

## 8. Supabase advisors (security)

Only INFO-level `rls_enabled_no_policy` notices (~35 tables): RLS is enabled with no policies. This is expected for a Payload deployment — the app connects via the direct Postgres role (which bypasses RLS) and enforces authorization at the application layer; no PostgREST/anon access path is in use for these tables. No ERROR/WARN-level advisors were reported. Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

---

## Disposition

F002's blocked read-only captures are now complete through the authorized channel (this closes the D06 blocker for evidence purposes; executor = repo owner via Supabase MCP, 2026-07-10). Remaining F002 scope: none for evidence; the private D02 identity mapping is reduced to confirming that all 3 admin users keep admin under the D01 target matrix.
