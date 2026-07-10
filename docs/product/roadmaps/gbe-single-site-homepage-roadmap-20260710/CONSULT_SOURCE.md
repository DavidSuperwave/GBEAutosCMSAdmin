# F002 Operations Truth-Capture Audit

**Project:** `bdnvgbdmqmbzemllqngs`  
**Audit date:** 2026-07-10  
**Mode:** Strictly read-only  
**Gate result:** **Partially captured; F002 remains open**

Evidence labels:

- **[MCP-live-verified]** — observed from the configured Supabase MCP project.
- **[repository-static]** — observed in the supplied documents or current repository.
- **[unknown]** — unavailable through the permitted read-only MCP capabilities.

## Bottom line

The configured MCP endpoint is live and matched project `bdnvgbdmqmbzemllqngs`. It verified a populated Payload-shaped Supabase database, installed extensions, migration registries, RLS enablement, advisor findings, Storage presence, live enum definitions, and safe table-level row estimates.

F002 is not fully satisfied because every `execute_sql` request was cancelled by the MCP layer before execution, including the version-only retry. Consequently, exact Postgres version, table byte sizes, forced-RLS state, policy/grant inventory, privileged-function inventory, exact row counts, role distributions, and completeness aggregates remain **[unknown]**.

The most important conclusions are:

- **[MCP-live-verified]** The live role enum is exactly the legacy six-role set: `admin`, `inventory_manager`, `content_editor`, `sales_manager`, `media_editor`, `viewer`. It has neither `general` nor `sales`.
- **[repository-static]** Missing roles currently resolve to `admin`. This conflicts directly with the confirmed fail-closed decision and keeps F001 critical.
- **[MCP-live-verified]** All 93 `public` tables report RLS enabled, but the security advisor identifies 35 RLS-enabled tables with no policies.
- **[MCP-live-verified]** No public tenant table or tenant-named column was found, and the `tenant`/`tenants` schema table lookup returned none. Tenancy is unnecessary and F008 should be removed.
- **[MCP-live-verified]** Both a legacy `home` model and the registered `site_config` model contain live rows. The homepage therefore has a real competing source-of-truth problem.
- **[MCP-live-verified]** Storage reports one bucket row and 277 object rows, while Payload `media` reports 42 rows. Bucket identity, visibility, restrictions, bytes, and object-to-Media reconciliation remain unknown.
- **[repository-static]** Payload still uses local filesystem uploads with no storage adapter; an out-of-band script independently writes Supabase Storage and can update legacy vehicle image columns.
- No live evidence blocks Supabase Storage. It remains the preferred durable-media choice.
- Catalog evidence does not prove that deployed Payload routes, Storefront routes, or GraphQL/REST endpoints enforce the intended rules.

No mutation, RPC, migration, configuration action, secret read, identity read, or row-level PII read was performed.

## Safe capability summary

| Capability | Result | Evidence |
|---|---|---|
| Confirm configured project | Matched requested ref | **[MCP-live-verified]** |
| Read six required local inputs completely | Completed | **[repository-static]** |
| List tables, extensions, migrations, advisors | Completed | **[MCP-live-verified]** |
| Generate schema types without rows | Completed | **[MCP-live-verified]** |
| Read user identities, contact data, lead messages, object names, URLs, or secrets | Not performed | Audit invariant |
| Execute mutations, DDL, RPCs, auth/storage/config changes | Not performed | Audit invariant |
| Use `.env`, `psql`, direct clients, or local credentials for live facts | Not performed | Audit invariant |
| Execute catalog/aggregate SQL | MCP returned `user cancelled MCP tool call` | **[unknown]** |
| Establish F002 as passed | No | Required exact aggregates and security catalog remain unavailable |

## Live database and storage findings

### Postgres and extensions

Exact Postgres version and `server_version_num`: **[unknown]**. The version `SELECT` was cancelled twice before execution. PostgREST `14.5` was visible in generated API types, but that is not the Postgres server version.

Installed extensions:

| Extension | Version | Schema |
|---|---:|---|
| `pgcrypto` | 1.3 | `extensions` |
| `plpgsql` | 1.0 | `pg_catalog` |
| `uuid-ossp` | 1.1 | `extensions` |
| `pg_stat_statements` | 1.11 | `extensions` |
| `supabase_vault` | 0.3.1 | `vault` |

**[MCP-live-verified]** Only extension metadata was read. No Vault records or secrets were accessed.

### Schemas and tables

MCP-reported table summary:

| Schema | Tables | RLS enabled | RLS disabled | Reported row total |
|---|---:|---:|---:|---:|
| `public` | 93 | 93 | 0 | 2,062 |
| `auth` | 23 | 16 | 7 | 77 |
| `storage` | 8 | 8 | 0 | 339 |

These are MCP table-level reported counts/estimates, not exact `COUNT(*)` results. The seven RLS-disabled objects are Supabase-managed `auth` tables; the advisors did not classify them as application findings.

Important application objects:

| Object | Reported rows | Notes |
|---|---:|---|
| `public.vehicles` | 1,391 | Text price; several overlapping status fields; canonical and legacy image fields |
| `public.dealerships` | 22 | No external-site URL column |
| `public.users` | 3 | Payload users; no identity fields read |
| `public.media` | 42 | Payload Media metadata |
| `public.vehicle_media_assets` | 13 | Approval/provenance metadata |
| `public.vehicle_tags` | 8 | Tag definitions |
| `public.vehicle_collections` | 8 | Smart/manual collection definitions |
| `public.analytics_events` | 408 | Counts remain operationally untrusted pending F006 |
| `public.leads` | 0 | No lead rows or PII read |
| `public.pages` | 0 | Child block rows nevertheless exist |
| `public.site_config` | 1 | Registered homepage/global model |
| `public.home` | 1 | Legacy competing homepage model |
| `public.home_stats` | 3 | Legacy homepage children |
| `public.home_brands` | 8 | Legacy homepage children |
| `public.payload_migrations` | 17 | Separate from Supabase migration registry |
| `public.import_jobs` | 1 | Operational import history |
| `public.workshop_jobs` | 13 | Later agent/media workflow |
| `public.image_templates` | 2 | Later agent/media workflow |

Exact table sizes in bytes are **[unknown]** because the `pg_total_relation_size` query was cancelled.

### Homepage and page structures

Nonzero homepage/navigation child-table reports:

| Object | Rows |
|---|---:|
| `site_config_navigation_main_links` | 6 |
| `site_config_navigation_footer_links` | 2 |
| `site_config_navigation_legal_links` | 1 |
| `site_config_blocks_hero` | 1 |
| `site_config_blocks_brands` | 1 |
| `site_config_blocks_inventory_search` | 1 |
| `site_config_blocks_trust_steps` | 1 |
| `site_config_blocks_trust_steps_steps` | 3 |

`pages` reports zero rows, while `pages_blocks_hero` and `pages_blocks_cta` each report one row. **[MCP-live-verified]** This warrants an orphan/stale-child integrity check; it is not proof of corruption because exact foreign-key state and counts were not queried.

### Migration history

The Supabase migration registry contains five entries:

1. `20260609120954` — `gbe_inventory_workflow_upgrade`
2. `20260609121018` — `gbe_inventory_workflow_collections`
3. `20260609121041` — `gbe_inventory_workflow_workshop`
4. `20260609133605` — `gbe_add_new_collection_rels_columns`
5. `20260609150205` — `20260609_180000_image_templates`

Separately:

- **[MCP-live-verified]** `public.payload_migrations` reports 17 rows.
- **[repository-static]** The repository documents 15 registered Payload migrations.

These are different migration registries, but the 17-versus-15 difference still requires a safe name-only live capture before migration planning.

### Storage

| Finding | Result |
|---|---|
| Bucket rows | 1 |
| Object rows | 277 |
| RLS on `storage.buckets` | Enabled |
| RLS on `storage.objects` | Enabled |
| Bucket ID/name | **[unknown]** |
| Public/private | **[unknown]** |
| File-size limit | **[unknown]** |
| Allowed MIME types | **[unknown]** |
| Exact object count/bytes | **[unknown]** |
| Object-to-Payload-Media reconciliation | **[unknown]** |

No object name, path, URL, or signed URL was accessed.

The 277 Storage metadata rows and 42 Payload Media rows are not directly comparable without bucket and relationship aggregates. They may represent legacy objects, multiple objects per Media record, or unrelated content; no orphan conclusion is justified yet.

Supabase documents that Storage metadata tables should be treated as read-only and object changes should go through the Storage API: [Storage schema guidance](https://supabase.com/docs/guides/storage/schema/design).

### Backend source of truth and competing paths

The approved source-of-truth contract should be:

1. Supabase-hosted Postgres project `bdnvgbdmqmbzemllqngs` for Payload data.
2. Registered `site_config` plus its block/navigation tables for the main GBE homepage and global presentation configuration.
3. Payload `media` relationships for canonical asset identity.
4. Supabase Storage behind the canonical Payload Media service for durable bytes.
5. Bounded published DTOs for Storefront consumption.

**[MCP-live-verified]** The project contains the current Payload-shaped schema and populated operational data. **[repository-static]** Payload uses the Postgres adapter through `DATABASE_URI`. The deployed application’s actual connection target remains **[unknown]** because configuration and secrets were deliberately not accessed.

Competing or legacy paths requiring retirement or containment:

- Live `home`, `home_stats`, and `home_brands`, plus unregistered `src/globals/Home.ts`, compete with `site_config.home`.
- Old flat `site_config` columns coexist with the newer `general_*` fields.
- Homepage edits save directly to the live SiteConfig value without a durable publishing boundary.
- Payload Media writes to local filesystem storage because `plugins: []` and `upload: true` are configured without a durable adapter.
- `scripts/sync-vehicle-images.mjs` is an independent Supabase Storage write path and can optionally update vehicle rows directly.
- `vehicles.image_url`, `image_path`, and `image_filename` coexist with `image_id`.
- `vehicles.status` coexists with `inventory_status`; `_status` coexists with `publish_status`.
- `source_dealer_name`/city fallback behavior competes with the `dealership_id` relationship.
- Raw Payload REST and GraphQL are competing public-integration surfaces beside bounded public DTO endpoints.
- Smart analytics sorts remain a competing but misleading path while they silently behave like “newest”.
- Seed/demo content and direct-database operational scripts must not become runtime sources of truth.
- Any separate Storefront hard-coded homepage, inventory, media, or dealership path found during F017 must be retired.

## Security findings

### RLS and exposed objects

- **[MCP-live-verified]** All 93 `public` tables report RLS enabled.
- Forced-RLS state is **[unknown]**.
- Exact policy inventory and predicates are **[unknown]**.
- Grants to `anon`, `authenticated`, and `service_role` are **[unknown]**.
- Configured Data API exposed schemas are **[unknown]**.
- Generated public API types report no public views and no public functions.
- Catalog-wide views, materialized views, and `SECURITY DEFINER` functions outside the generated public API schema remain **[unknown]**.
- No function body was requested or read.

RLS-enabled-with-no-policy is normally deny-by-default for API roles, subject to grants, but it does not constrain a table owner or bypass role. It is therefore neither proof of exposure nor proof of safe deployed Payload behavior.

### Supabase advisors

The advisor run returned no `ERROR` or `WARN` findings. All findings were `INFO`.

| Severity | Category | Count | Direction |
|---|---|---:|---|
| INFO | RLS enabled with no policy | 35 | Either add explicit least-privilege policies for intended Data API use, or remove/revoke Data API access and keep access behind Payload |
| INFO | Unindexed foreign key | 5 | Validate query/delete workload, then add covering indexes where justified |
| INFO | Unused index | 153 | Review workload and statistics window before removal; do not bulk-drop generated indexes |
| ERROR/WARN | — | 0 | Absence of advisor findings is not a complete route or grant audit |

The 35 RLS-without-policy objects are:

`public.image_templates`, `public.import_jobs`, `public.import_jobs_errors`, `public.vehicle_collections`, `public.vehicle_collections_rels`, `public.vehicle_image_searches`, `public.vehicle_media_assets`, `public.vehicle_tags`, `public.vehicles_rels`, `public.workshop_jobs`, `public.workshop_jobs_input_images`, `public.workshop_jobs_messages`, `public.workshop_jobs_outputs`, `public.site_config_navigation_footer_links`, `public.site_config_navigation_legal_links`, plus the `pages_blocks_*` and `site_config_blocks_*` city-inventory, inventory-collection, promo-banner, testimonials, trust-steps, and video-tips table families.

Advisor remediation: [RLS-enabled-without-policy linter](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

The five unindexed foreign keys are:

- `vehicle_media_assets_approved_by_id_users_id_fk`
- `vehicle_media_assets_created_by_id_users_id_fk`
- `workshop_jobs_created_by_id_users_id_fk`
- `workshop_jobs_input_images_image_id_media_id_fk`
- `workshop_jobs_outputs_image_id_media_id_fk`

Advisor remediation: [unindexed foreign-key linter](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

The 153 unused-index notices span 71 objects. The principal object groups are:

- Core: `analytics_events`, `dealerships`, `leads`, `pages`, `users`, `vehicles`, `vehicle_collections`, `vehicle_media_assets`, `vehicle_tags`, `image_templates`, `import_jobs`.
- Payload internals: `payload_locked_documents*`, `payload_migrations`, `payload_preferences*`.
- Legacy homepage: `home_brands`, `home_stats`.
- Page blocks: city inventory, inventory collection/search, promo banner/strip, testimonials, trust steps, and video tips.
- SiteConfig blocks/navigation: the corresponding city-inventory, inventory-collection/search, promo-banner, testimonials, trust-steps, video-tips, footer, and legal objects.
- Vehicle presentation: badges, gallery, custom fields, features, landing sections, and all vehicle block families.
- Workshop: `workshop_jobs` and its input, message, and output children.

Advisor remediation: [unused-index linter](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). These notices should be treated as review candidates, not deletion instructions.

### Repository-static security risks

- `getRoles()` grants `admin` to an authenticated user with no resolved role.
- Public reads exist for full Media, Pages, Dealerships, and SiteConfig objects.
- Dealership records combine visitor-facing data with internal/person-related fields.
- Anonymous lead and analytics creation is configured at broad collection boundaries.
- Raw REST and GraphQL routes remain mounted.
- SiteConfig has public read but no explicit update access declaration.
- The out-of-band image sync uses a privileged client and can bypass the canonical Payload path.

These are code findings, not proof that a particular deployed commit or infrastructure rule exposes them.

## Aggregate data-quality findings

| Area | Verified evidence | Required aggregate still unknown |
|---|---|---|
| Roles | 3 user rows reported; live enum is legacy six-role set | Exact count by role, null/blank/invalid counts |
| Vehicles | 1,391 rows; price is text; image relationship and legacy columns coexist | Publish/inventory distributions, price quality, image matrix, required-field completeness |
| Dealerships | 22 rows; relationship exists; no external URL column | Active/location completeness and vehicle coverage |
| Pages | 0 parent rows; two child block rows reported | Exact counts, visibility/status distribution, orphan confirmation |
| Homepage | `site_config` 1; legacy `home` 1; known nonzero SiteConfig blocks/navigation | Field/media/CTA completeness and canonical-content reconciliation |
| Media | 42 Payload rows; 277 Storage object rows | Bytes, MIME distribution, missing alt/URL/filesize, object reconciliation |
| Leads | 0 rows reported | Exact stage/source distributions |
| Analytics | 408 rows reported | Exact event-type distribution and linkage/session completeness |
| Tags/collections | 8 tags and 8 collections; `vehicles_rels` reports 0 | Exact tag assignment and collection membership/use |

### Role compatibility

The live role enum is:

- `admin`
- `inventory_manager`
- `content_editor`
- `sales_manager`
- `media_editor`
- `viewer`

Compatibility with the confirmed target:

| Target | Live support |
|---|---|
| `admin` | Present |
| `general` | Absent |
| `sales` | Absent |

`viewer` is the live database default and is not a valid target role. The current schema cannot implement the confirmed role model without a reviewed migration. No legacy role can be automatically mapped to `general` or `sales`; that mapping is a private human decision.

### Vehicle prices and statuses

Live schema verification found:

- `price` is `character varying`.
- Inventory-style fields include legacy `status` and newer `inventory_status`.
- Publishing-style fields include Payload `_status` and workflow `publish_status`.
- `publish_status` supports `draft`, `needs_review`, `published`, and `archived`.
- `inventory_status` supports `available`, `reserved`, and `sold`.

Null, blank, numeric, range, ambiguous, invalid, and published-with-invalid-price counts are **[unknown]**.

### Vehicle images

Live schema contains:

- Canonical relationship: `image_id`.
- Legacy fields: `image_url`, `image_path`, `image_filename`.
- Workflow field: `image_status`.
- Separate `vehicle_media_assets` approval/provenance rows.

Relationship-present versus legacy-URL-present counts, approved-asset completeness, and Media/Storage reconciliation are **[unknown]**.

### Dealership completeness

Vehicles have `dealership_id`, and collections can filter by dealership. The live dealership table has no approved external URL column. Therefore:

- Location/tag completeness can be measured after aggregate SQL is available.
- External-link completeness cannot yet be represented in the current schema.
- Dealerships should remain GBE location/inventory metadata, not tenants or websites.

## Product-decision reconciliation

### Roles

Replace the live six-role enum and code model with exactly `admin`, `general`, and `sales`. Null, blank, stale, or invalid roles must yield no privileges. Complete a private human mapping before changing fail-open behavior.

### Single GBE site

No tenant-named public table or column was found, and no tables were returned for `tenant` or `tenants`. This aligns with the confirmed single-site model.

Do not add tenant memberships, host resolution, tenant domains, tenant media prefixes, isolated dealership workspaces, separate themes, or dealership site builders.

### Homepage

The registered `site_config` global should become the single homepage source of truth. The live legacy `home` family must be reconciled and retired. Homepage publishing should follow the role/access foundation and minimum CI harness, ahead of generic Pages publishing.

### Supabase Storage

No live incompatibility was found. Use Supabase Storage behind the canonical Payload Media service with a stable single-site key convention. Do not use direct Storage public URLs or legacy vehicle image columns as durable identity.

### Storefront

The current repository root redirects to `/admin`; the main GBE website is elsewhere. F017 remains mandatory for homepage, navigation, inventory, media, dealership link, preview, and analytics verification against a pinned Storefront commit.

## Revised blueprint impact

| Feature | Required disposition |
|---|---|
| F001 | **Revise; critical.** Migrate from the verified live six-role enum to `admin/general/sales`; remove fail-open fallback; privately map all three current user rows; add invalid/null negative tests. |
| F002 | **Keep open.** Built-in MCP truth capture succeeded, but exact version, sizes, grants, policies, privileged functions, Storage restrictions, and aggregates remain blocked. |
| F003 | **Keep and prioritize.** Establish minimum Node 22 CI, focused security tests, typecheck/lint, and build immediately after F001. |
| F004 | **Revise.** Prove raw/public/preview vehicle contracts using the three target roles and reconcile duplicate status/image paths. |
| F005 | **Revise and pull forward where homepage-related.** Close SiteConfig, Media, Pages, Dealerships, and reference access; add a bounded dealership DTO and approved external URL. |
| F006 | **Keep high priority.** Harden lead/analytics inputs, field ownership, limits, and rollups; hide smart ranks until trustworthy. |
| F007 | **Keep but resequence after homepage.** Pages draft/version proof should not delay the primary homepage. |
| F008 | **Remove.** Tenancy is outside the confirmed product and absent from the live application schema. |
| F009 | **Unblock.** Remove F008 dependency; implement canonical Payload Media writes to Supabase Storage using single-site keys. |
| F010 | **Keep after F009.** Reconcile 42 Media rows, the Storage inventory, vehicle relationships, and legacy image fields; then retire legacy reads/writes. |
| F011 | **Keep.** Replace text price with numeric amount/currency after human-reviewed classification of ambiguous source values. |
| F012 | **Revise.** Use numeric deterministic sorts and complete filters/facets; remove smart rankings until trusted rollups exist. |
| F013 | **Unblock and prioritize.** After F001, F003, and the relevant F005 access closure, deliver SiteConfig homepage draft, preview, publish, unpublish, rollback, and concurrency. |
| F014 | **Keep separately gated.** Vehicle presentation versioning remains a product decision and must not block homepage work. |
| F015 | **Keep.** Add optimistic concurrency to vehicle editing and homepage publishing. |
| F016 | **Keep later.** Style isolation follows access, homepage, media, and catalog foundations. |
| F017 | **Retain as a release gate.** Verify the main GBE Storefront at a pinned SHA, including homepage, published inventory, media, approved dealership redirects, preview isolation, and analytics deduplication. |

Recommended sequence:

1. Complete the blocked F002 manual captures.
2. F001 three-role fail-closed foundation.
3. F003 minimum CI/security harness.
4. Homepage-relevant F005 access closure.
5. F013 homepage publishing.
6. Remaining F004–F006 boundary work.
7. F009–F010 Supabase Storage and media cutover.
8. F011–F012 catalog correctness.
9. F007, F014 if approved, and F015.
10. F016.
11. F017 Storefront verification before public acceptance.

AGIREAL runtime patterns remain reference-only until authorization, CI, homepage publishing, durable media, ingestion integrity, and catalog correctness are established. Tenant-oriented AGIREAL rules should be translated to server-derived actor, role, approval, and single-GBE-site context.

## Unknowns and safe manual captures

An authorized operator should rerun the following through the same Supabase MCP project and return only catalog or aggregate output.

### Version, sizes, and forced RLS

```sql
begin;
set transaction read only;

select
  current_setting('server_version') as server_version,
  current_setting('server_version_num') as server_version_num;

select
  n.nspname as schema_name,
  c.relname as object_name,
  c.reltuples::bigint as estimated_rows,
  pg_total_relation_size(c.oid) as total_bytes,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'auth', 'storage')
  and c.relkind in ('r', 'p', 'v', 'm')
order by n.nspname, c.relname;

commit;
```

### Policies, grants, views, and privileged functions

```sql
begin;
set transaction read only;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select table_schema, table_name, grantee, privilege_type, is_grantable
from information_schema.table_privileges
where table_schema in ('public', 'storage')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_schema, table_name, grantee, privilege_type;

select
  n.nspname as schema_name,
  c.relname as view_name,
  c.relkind,
  pg_get_userbyid(c.relowner) as owner_role,
  c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('v', 'm')
  and n.nspname in ('public', 'storage')
order by n.nspname, c.relname;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_userbyid(p.proowner) as owner_role,
  p.proconfig as function_settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef
  and n.nspname not in ('pg_catalog', 'information_schema')
order by n.nspname, p.proname;

commit;
```

Do not return function bodies. Redact any unexpected literal found in a policy predicate.

### Storage aggregate

```sql
begin;
set transaction read only;

select
  b.id as bucket_id,
  b.name as bucket_name,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types,
  count(o.id) as object_count,
  coalesce(sum(
    case
      when coalesce(o.metadata ->> 'size', '') ~ '^[0-9]+$'
        then (o.metadata ->> 'size')::numeric
      else 0
    end
  ), 0) as total_object_bytes
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
group by b.id, b.name, b.public, b.file_size_limit, b.allowed_mime_types
order by b.id;

commit;
```

### Roles and content aggregates

```sql
begin;
set transaction read only;

select
  coalesce(nullif(btrim(role::text), ''), '<null-or-blank>') as role_value,
  count(*) as user_count
from public.users
group by 1
order by 1;

select publish_status, count(*) from public.vehicles group by publish_status order by publish_status;
select inventory_status, count(*) from public.vehicles group by inventory_status order by inventory_status;

select
  count(*) as total_vehicles,
  count(*) filter (where nullif(btrim(price), '') is null) as missing_price,
  count(*) filter (
    where nullif(btrim(price), '') is not null
      and price ~ '[0-9][[:space:]]*[-–—][[:space:]]*[0-9]'
  ) as range_or_ambiguous_price,
  count(*) filter (
    where nullif(btrim(price), '') is not null
      and price !~ '[0-9][[:space:]]*[-–—][[:space:]]*[0-9]'
      and price !~* '^[[:space:]]*\$?[[:space:]]*[0-9][0-9,]*(\.[0-9]{1,2})?[[:space:]]*(MXN)?[[:space:]]*$'
  ) as invalid_price_candidate,
  count(*) filter (where image_id is not null) as related_image_present,
  count(*) filter (where nullif(btrim(image_url), '') is not null) as legacy_url_present,
  count(*) filter (
    where image_id is not null and nullif(btrim(image_url), '') is not null
  ) as both_image_paths,
  count(*) filter (
    where image_id is null and nullif(btrim(image_url), '') is not null
  ) as legacy_only,
  count(*) filter (
    where image_id is null and nullif(btrim(image_url), '') is null
  ) as neither_image_path,
  count(*) filter (where dealership_id is null) as missing_dealership
from public.vehicles;

select is_active, count(*),
  count(*) filter (where nullif(btrim(city), '') is null) as missing_city,
  count(*) filter (where coordinates_lat is null or coordinates_lng is null) as missing_coordinates
from public.dealerships
group by is_active
order by is_active;

select status, is_visible, count(*)
from public.pages
group by status, is_visible
order by status, is_visible;

select count(*) as site_config_rows,
  count(*) filter (where general_logo_id is null) as missing_logo
from public.site_config;

select
  count(*) as media_rows,
  coalesce(sum(filesize), 0) as aggregate_media_bytes,
  count(*) filter (where nullif(btrim(alt), '') is null) as missing_alt,
  count(*) filter (where nullif(btrim(url), '') is null) as missing_url,
  count(*) filter (where filesize is null) as missing_filesize
from public.media;

select mime_type, count(*), coalesce(sum(filesize), 0)
from public.media
group by mime_type
order by mime_type;

select stage, count(*) from public.leads group by stage order by stage;
select event_type, count(*) from public.analytics_events group by event_type order by event_type;

commit;
```

A private, separate human process must perform per-user role mapping. Its identity-level output must not be added to this audit.

## Evidence ledger

### MCP calls

| ID | Tool/query | Result | Safe proof |
|---|---|---|---|
| MCP-01 | `get_project_url` | Success | Project URL contained the requested ref; URL not reproduced |
| MCP-02 | `list_tables(public, auth, storage, compact)` | Success; repeated for validation | Schema/table counts, RLS flags, reported rows |
| MCP-03 | `list_tables(public, verbose)` | Success | Relevant columns, keys, relationships, no tenant columns |
| MCP-04 | `list_tables(public, storage, verbose)` | Success | Storage schema shape and RLS flags |
| MCP-05 | `list_tables(tenant, tenants, verbose)` | Success | Zero tables returned |
| MCP-06 | `list_extensions` | Success; repeated once | Five installed extensions and versions |
| MCP-07 | `list_migrations` | Success; repeated once | Five Supabase migration entries |
| MCP-08 | `get_advisors(security)` | Success; repeated for parsing/verification | 35 INFO RLS-without-policy notices |
| MCP-09 | `get_advisors(performance)` | Success; repeated for parsing/verification | 5 unindexed-FK and 153 unused-index notices |
| MCP-10 | `generate_typescript_types` | Success; repeated once for focused extraction | Exact live role enum, PostgREST 14.5, no exposed public views/functions |
| MCP-11 | `search_docs` for RLS, views, advisors, Storage | Success | Current official RLS and Storage documentation |
| MCP-12 | `search_docs` for bucket restrictions | Success | Current bucket/Storage documentation |
| MCP-13 | Version `SELECT` in initial SQL batch | Cancelled before execution | No version fact returned |
| MCP-14 | Object size/RLS-forced catalog `SELECT` | Cancelled before execution | Unknown |
| MCP-15 | Column catalog `SELECT` | Cancelled before execution | Replaced safely by verbose table discovery |
| MCP-16 | Policy catalog `SELECT` | Cancelled before execution | Unknown |
| MCP-17 | API-role grants `SELECT` | Cancelled before execution | Unknown |
| MCP-18 | View catalog `SELECT` | Cancelled before execution | Public API types provide partial evidence only |
| MCP-19 | SECURITY DEFINER metadata `SELECT` | Cancelled before execution | Unknown |
| MCP-20 | Version-only `SELECT` retry | Cancelled before execution | Retry limit reached; classified unknown |

One documentation call succeeded at MCP level but its first local result extraction used the wrong response wrapper; the same query was safely re-read without changing project state.

### Repository-static evidence

Completely read:

- `HUMAN_PRODUCT_DECISIONS_20260710.md`
- `PRODUCT_BLUEPRINT.md`
- `FEATURE_ROADMAP.md`
- `HUMAN_REVIEW.md`
- `AGIREAL_REUSE_MATRIX.md`
- `SUPABASE_LIVE_READONLY_AUDIT_20260710.md`

The earlier blocked audit was treated only as historical/static context; none of its old live unknowns were reused as current evidence.

Additional current repository evidence included:

- `src/payload.config.ts`
- `src/access/roles.ts`
- `src/collections/Media.ts`
- `src/globals/SiteConfig.ts`
- `src/globals/Home.ts`
- `scripts/sync-vehicle-images.mjs`
- `src/app/(frontend)/page.tsx`
- `package.json`

No file was modified.