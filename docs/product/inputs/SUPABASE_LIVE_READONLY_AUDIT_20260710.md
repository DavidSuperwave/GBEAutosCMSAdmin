# F002 Operations Truth-Capture Audit

**Project requested:** `bdnvgbdmqmbzemllqngs`  
**Audit date:** 2026-07-10  
**Mode:** Strictly read-only  
**Result:** **Incomplete / blocked on Supabase MCP availability**

Evidence labels used below:

- **[MCP-live-verified]** — observed through the configured Supabase MCP against the specified project.
- **[repository-static]** — observed in the checked-out repository or supplied product documents.
- **[unknown]** — cannot be established safely without live Supabase MCP access.

## Bottom line

The F002 gate is **not satisfied**. No live database, Storage, RLS, grants, advisor, migration, role, or content aggregate was obtained because the current harness exposes no Supabase MCP server. MCP discovery succeeded but returned no Supabase capability, and the local Codex MCP registry reports that no servers are configured. I did not bypass this with `.env` credentials, `psql`, direct Supabase clients, or network/database CLI calls.

The repository evidence nevertheless changes the blueprint materially:

- **[repository-static]** The product currently implements six roles and treats an authenticated user with no role as `admin`. This directly conflicts with the confirmed three-role, fail-closed decision.
- **[repository-static]** No tenant schema, collection, column, membership, domain, or host-resolution model was found. That aligns with the confirmed single-site product. F008 should be removed.
- **[repository-static]** Homepage content is stored under the registered `site_config` global and saved directly to the live value. A separate `Home` global exists in source but is not registered.
- **[repository-static]** Payload media uses local filesystem uploads with no storage adapter. A separate legacy script uploads to a statically configured Supabase Storage bucket and can optionally update vehicle image columns directly.
- **[repository-static]** Dealerships work as vehicle/location references, but the current schema has no approved external-site URL field and its public-read rule covers internal and person-related fields.
- **[repository-static]** The repository does not contain the main Storefront: its root page redirects to `/admin`. Main-site consumption of homepage, inventory, media, and dealership contracts remains unverified.
- **[unknown]** Supabase may be the live authoritative database operationally, but the live project state and actual deployed enforcement cannot be attested until MCP access is restored.

## Safe capability summary

| Capability | Result | Evidence |
|---|---|---|
| Read all five required product inputs | Completed | **[repository-static]** |
| Inspect repository schema/configuration without secrets | Completed | **[repository-static]** |
| Discover Supabase MCP server | No Supabase server exposed | **[MCP-live-verified]** discovery result |
| Query project `bdnvgbdmqmbzemllqngs` | Not possible in this harness | **[unknown]** |
| Read row-level PII, object names, URLs, credentials, or secrets | Not performed | Audit invariant |
| Run mutations, migrations, RPCs, or configuration changes | Not performed | Audit invariant |
| Use `.env`, `psql`, or direct Supabase database clients | Not performed | Audit invariant |
| Establish F002 as passed | No | Live truth capture is missing |

## Live database/storage findings

### Postgres version and extensions

- Exact Postgres version: **[unknown]**
- `server_version_num`: **[unknown]**
- Installed extension names, versions, and schemas: **[unknown]**

No version or extension should be inferred from Payload, package versions, migration syntax, or Supabase defaults.

### Application schema and tables

**[repository-static]** Payload registers these application collections:

`vehicles`, `vehicle-tags`, `vehicle-collections`, `import-jobs`, `vehicle-media-assets`, `vehicle-image-searches`, `workshop-jobs`, `image-templates`, `pages`, `media`, `leads`, `analytics-events`, `dealerships`, and `users`.

It registers one global: `site-config`.

The generated Drizzle schema contains **84 `pgTable` declarations**, including collection roots, block/array child tables, relationship tables, session tables, the `site_config` global tables, and Payload internals such as:

- `payload_kv`
- `payload_locked_documents`
- `payload_locked_documents_rels`
- `payload_preferences`
- `payload_preferences_rels`
- `payload_migrations`

The generated schema describes `public` application objects only. It does not establish what currently exists in live `auth`, `storage`, `extensions`, `realtime`, or other Supabase-managed schemas.

Live table existence, sizes, estimates, and exact counts: **[unknown]**.

### Migration history

**[repository-static]** Fifteen migrations are registered, spanning 2026-05-21 through 2026-06-11:

1. `20260521_060610_site_builder_schema`
2. `20260521_083000_vehicle_landing_simplification`
3. `20260609_120000_gbe_inventory_workflow_upgrade`
4. `20260609_180000_image_templates`
5. `20260610_090000_vehicle_image_reuse_workspace`
6. `20260610_100000_p0_whatsapp_routing_contracts`
7. `20260610_110000_p1_tags_and_smart_collections`
8. `20260610_120000_p2_pages_nav_and_analytics`
9. `20260610_130000_p3_page_home_block_schema_sync`
10. `20260610_140000_p3_site_config_nav_link_id_sync`
11. `20260611_090000_vehicle_create_preview_template_controls`
12. `20260611_150000_workshop_job_style_fields`
13. `20260611_160000_workshop_job_turn_ids`
14. `20260611_170000_general_media_workspace`
15. `20260611_180000_vehicle_image_sync_columns`

Whether each migration is applied in the hosted project, whether extra dashboard/manual migrations exist, and whether Payload and Supabase migration histories agree: **[unknown]**.

### Storage

**[repository-static]**

- Payload `media` is configured with `upload: true`.
- `payload.config.ts` has `plugins: []`; no durable storage adapter is registered.
- Media records contain local-style metadata such as `url`, `filename`, `mime_type`, and `filesize`.
- `scripts/sync-vehicle-images.mjs` defaults to a bucket named `vehicle-images`, verifies that it exists, uploads JPEGs, and obtains public URLs.
- The script is an out-of-band path, not the canonical Payload Media write path.
- Direct updates to vehicle image columns are disabled by default but can be enabled through `ALLOW_DIRECT_VEHICLE_IMAGE_DB_UPDATE`.
- The script writes legacy `image_url`, `image_path`, `image_filename`, and `image_status` fields when that override is enabled.

Live buckets, public/private state, MIME restrictions, size limits, aggregate object count, and aggregate bytes: **[unknown]**. The static default bucket name is not proof that a live bucket exists.

### Current source-of-truth assessment

The appropriate target source of truth is:

1. Supabase-hosted Postgres for Payload collections and globals.
2. The registered `site_config` global for homepage, navigation, global presentation configuration, and shared media relationships.
3. Payload `media` relationships for canonical asset identity.
4. Bounded custom public DTO endpoints for published inventory and collection data.
5. Supabase Storage behind the canonical Payload Media write path.

Paths that should be retired or contained:

- The unregistered `src/globals/Home.ts` model.
- Local filesystem media as a durable production path.
- Vehicle `imageUrl`, `imagePath`, and `imageFilename` as public/canonical image sources.
- The optional direct database update mode in `sync-vehicle-images.mjs`, except for an explicitly reviewed, one-time backfill.
- The sync script’s public-URL contract once Payload Media owns Storage.
- Raw collection REST/GraphQL as a Storefront integration contract; public consumers should use bounded published DTOs.
- Direct live-on-save homepage publishing once draft/version/rollback support exists.
- Smart analytics rankings that silently resolve to newest.
- Any tenant accounts, tenant pages, domains, themes, workspaces, or dealership-site concepts.
- Seed/demo content as an operational source of truth.
- Any hard-coded or competing Storefront content path discovered during F017.

This is a repository assessment, not proof that the deployed Storefront currently follows these boundaries.

## Security findings

### Live RLS, grants, views, and privileged functions

The following are all **[unknown]**:

- RLS enabled state for exposed tables.
- Forced-RLS state.
- Policy names, commands, roles, `USING`, and `WITH CHECK` clauses.
- Grants to `anon`, `authenticated`, and `service_role`.
- Exposed schemas configured for the Data API.
- Views and whether they use `security_invoker`.
- Materialized views exposed through API roles.
- `SECURITY DEFINER` functions, owners, search paths, and execute grants.
- Whether live objects differ from repository migrations.

**[repository-static]** No `CREATE POLICY`, `ENABLE/FORCE ROW LEVEL SECURITY`, API-role `GRANT`, `CREATE VIEW`, or `SECURITY DEFINER` statements were found in the registered repository migrations. Live dashboard-created objects could still exist.

### Supabase advisors

No advisor result was available, so no live finding or direct object reference is claimed.

| Advisor severity | Findings | Status |
|---|---:|---|
| Critical/error | Unknown | Supabase `get_advisors(type: "security")` unavailable |
| Warning | Unknown | Security and performance advisors unavailable |
| Informational | Unknown | Advisors unavailable |

Required remediation direction after capture:

- Missing RLS on exposed application tables: enable RLS and define explicit least-privilege policies.
- Over-broad API-role grants: revoke unused operations and grant only the required table/operation set.
- Definer views or functions: prefer invoker behavior; otherwise isolate them from exposed schemas, fix `search_path`, enforce caller identity, and constrain `EXECUTE`.
- RLS policy performance findings: wrap stable auth functions in scalar subqueries and index policy predicate columns.
- Missing foreign-key indexes: add indexes only after workload and advisor validation.
- Duplicate/unused indexes: validate production query patterns before removal.
- Mutable function search paths: pin a safe search path.
- Leaked-password protection or Auth advisories: handle through an explicitly authorized configuration change, outside this read-only audit.

### Repository-static security risks

| Priority | Object/reference | Finding |
|---|---|---|
| Critical | `src/access/roles.ts:getRoles` | Authenticated users with no resolved role receive `admin`. Missing/invalid roles therefore fail open. |
| Critical | `users.role` | Repository enum is six-role: `admin`, `inventory_manager`, `content_editor`, `sales_manager`, `media_editor`, `viewer`. It does not contain target `general` or `sales`. |
| High | `pages` | Raw collection read is public and is not filtered by `status` or `isVisible` at the access-rule layer. |
| High | `dealerships` | Public read covers the full record, including internal and person/contact fields; no bounded public dealership DTO is evident. |
| High | `site-config` | Public read is explicit, but no explicit update access rule is present. Deployed behavior must be tested rather than inferred. |
| High | `leads` | Anonymous create is allowed across a schema that also contains management fields such as stage, assignment, and notes. |
| High | `analytics-events` | Anonymous create is allowed; any authenticated user may update or delete events. |
| High | Payload REST/GraphQL routes | Generic REST methods and GraphQL POST remain mounted. Collection access mistakes therefore become directly reachable API mistakes. |
| High | Media | Local uploads have no durable adapter, creating an integrity and availability risk across redeploys. |
| Medium | Homepage builder | Saves directly to the live `site-config` global with no draft/version/rollback boundary. |
| Medium | Smart rankings | `mostViewed`, `mostClicked`, and `mostLeads` silently map to newest while input analytics are spoofable. |

These findings describe repository configuration. They do not prove which commit is deployed or whether infrastructure adds compensating controls.

## Aggregate data-quality findings

No live aggregate was available. The table below separates the required live result from what the repository schema permits.

| Entity | Required live aggregate | Current evidence |
|---|---|---|
| Users/roles | Counts by exact role value; null, blank, invalid, and total | **[unknown]**. **[repository-static]** Six-role enum with nullable role and fail-open code fallback. |
| Vehicles | Total; publish and inventory-status distributions; missing required content; price classes; media relationship/legacy URL matrix; dealership completeness | **[unknown]**. Schema supports these aggregates. |
| Dealerships | Total and active state; location/routing completeness; vehicle-reference coverage; approved external-link completeness | **[unknown]**. Current static schema has no external-site URL field, so link completeness cannot presently be represented. |
| Pages | Total; status and visibility distributions; navigation and section completeness | **[unknown]**. Static statuses are `draft`, `published`, and `archived`. |
| Homepage/site config | Singleton count; section counts/types; navigation, logo, CTA, and template completeness | **[unknown]**. Registered source is `site_config`; standalone `Home` is unused. |
| Media | Total; aggregate bytes; MIME distribution; missing alt/URL/filesize; relationship usage | **[unknown]**. Payload records and Storage objects cannot be reconciled without MCP. |
| Leads | Total; stage/source distributions; aggregate routing and vehicle linkage completeness | **[unknown]**. No identity or message fields should be returned. |
| Analytics | Total; event-type distribution; missing session/visitor/vehicle/dealership links; time range | **[unknown]**. Counts must be treated as untrusted until ingestion hardening. |

### User-role mapping viability

- **[repository-static]** `admin` already exists.
- **[repository-static]** `general` and `sales` do not exist in the current code enum.
- **[repository-static]** Existing legacy values cannot be safely converted by name alone.
- **[unknown]** The live distribution and null/invalid counts are unavailable.
- The current model therefore cannot be declared ready for the three target roles. If live schema matches the repository, a reviewed enum/schema and authorization migration is required.
- No per-user mapping may be inferred from activity, current role name, contact fields, or historical behavior. Aggregate capture should be followed by a separate private human mapping exercise.

### Vehicle price quality

**[repository-static]** `vehicles.price` is `varchar`, the editor explicitly allows a number or range, and public sorting uses that text column. Required live categories are:

- Null or blank.
- Valid single numeric price candidate.
- Range/ambiguous value.
- Invalid/unparseable value.
- Published record with no valid single price.
- Duplicate semantic prices expressed with different formatting.

All counts are **[unknown]**.

### Vehicle media quality

**[repository-static]** Vehicles may contain both:

- Canonical Payload relationship: `image_id`.
- Legacy path: `image_url`, `image_path`, `image_filename`.

Required live cross-tabulation:

- Relationship present / legacy URL present.
- Relationship present / legacy URL absent.
- Relationship absent / legacy URL present.
- Neither present.
- Published vehicle missing an approved related hero asset.
- Related media row missing URL, size, MIME type, or alt text.

All counts are **[unknown]**.

### Dealership tag/link quality

- **[repository-static]** Vehicles have a dealership relationship and reusable tags.
- **[repository-static]** Dealerships hold location and routing metadata.
- **[repository-static]** There is no dealership external URL field.
- Therefore vehicle-to-dealership and location completeness can be measured after MCP access, but approved off-site link completeness first requires a schema feature.

## Product-decision reconciliation

### Three roles

The confirmed target is exactly:

- `admin`
- `general`
- `sales`

The current six-role model must be replaced. Missing, null, blank, stale, or invalid roles must grant no privilege. The permission matrix and individual mapping remain human decisions.

### Single GBE site

No tenant schema or columns were found in the generated schema, registered collections/globals, or migrations. This is desirable under the confirmed single-site model.

Tenant identities, memberships, host resolution, tenant-specific media keys, tenant domains, tenant page builders, tenant themes, and isolated dealership workspaces are not required and should not be introduced.

AGIREAL reuse rules that require tenant context should be revised to require server-derived actor and role context plus the single GBE site context. Tenant-oriented AGIREAL patterns remain reference-only.

### Dealerships

Dealerships should remain reference/location records used for:

- Vehicle tagging and filtering.
- City/location guidance.
- Lead/WhatsApp routing.
- Optional approved off-site redirection.

They should not become sites or tenants. A safe public DTO should expose only approved visitor-facing fields. Internal notes and management/person fields should remain private. The schema needs an explicit approved external URL field before link completeness can be governed.

### Homepage priority

`site_config.home.sections` is already the registered homepage model, so it is the best consolidation point. It currently lacks durable draft/version/rollback behavior and the builder states that changes publish on save.

Homepage publishing should move ahead of generic Pages publishing after the role boundary and minimum CI/security harness are safe.

### Supabase and durable media

Supabase remains the approved hosted backend direction. Supabase Storage should become the canonical durable byte store through the Payload Media service, using a stable single-site key convention. It no longer depends on a tenant decision.

### Storefront/main-site verification

The repository cannot prove Storefront behavior:

- Its root frontend redirects to `/admin`.
- No pinned Storefront SHA was supplied.
- Homepage rendering, public navigation, catalog URL state, dealership redirects, media behavior, analytics duplication, and live preview remain **[unknown]**.

F017 remains mandatory before accepting the public product.

## Revised blueprint impact

| Feature | Required disposition | Revised direction |
|---|---|---|
| F001 | **Revise; critical** | Replace the six-role feature with exact `admin/general/sales` semantics. Missing/invalid roles return no privileges. Require aggregate role capture, private human mapping, permission matrix, and negative tests. |
| F002 | **Keep open** | This audit is only the repository-static portion. F002 passes only after MCP live capture of version, schema, RLS, grants, advisors, Storage, roles, and aggregate data. |
| F003 | **Keep and prioritize** | Minimum Node 22 CI/security harness immediately after F001. It is the safety floor for homepage and authorization changes. |
| F004 | **Revise** | Preserve bounded public vehicle DTOs and authenticated raw access, but rewrite authorization fixtures for three roles. Verify REST, GraphQL, preview, and custom endpoints. |
| F005 | **Revise and prioritize** | Close Pages, SiteConfig, Media, Dealerships, and reference collections. Add a safe public dealership/location DTO and approved off-site URL field. |
| F006 | **Keep high priority** | Harden lead/analytics ingestion, restrict client-settable fields, add rate/body controls and trusted rollups. Hide smart rankings until trustworthy. |
| F007 | **Revise/resequence** | Keep Pages draft/version proof, but it should no longer delay the higher-priority homepage publishing proof. |
| F008 | **Remove** | Tenant identity foundation is outside the confirmed product. Remove its milestone and every dependency on it. |
| F009 | **Unblock and revise** | Remove F008 dependency. Implement Supabase Storage through one canonical Payload Media adapter and stable single-site key convention. |
| F010 | **Keep after F009** | Aggregate legacy inventory, reconcile Payload Media against legacy image columns, backfill through the canonical path, then retire legacy reads/writes. |
| F011 | **Keep** | Numeric amount plus currency migration remains necessary. Distinguish single prices from ranges/ambiguous source text during human-reviewed reconciliation. |
| F012 | **Revise** | Complete filters, facets, collection parameters, deterministic numeric sorts, and color/price ranges. Remove smart ranks until trusted rollups exist. |
| F013 | **Unblock and reprioritize** | Remove F008 dependency. Promote homepage/SiteConfig draft, preview, publish, unpublish, rollback, and concurrency behavior directly after F001/F003/F005. |
| F014 | **Keep gated by product decision** | Vehicle presentation versioning remains undecided but must not block homepage delivery. |
| F015 | **Keep** | Add optimistic concurrency for vehicle editing and extend the same principle to homepage publishing. |
| F016 | **Keep later** | Preserve style isolation work after access, homepage, storage, and catalog correctness. |
| F017 | **Keep as release gate** | Verify the main GBE Storefront at a pinned SHA. Test homepage, navigation, inventory, media, dealership links, preview, and analytics contracts. |

Recommended order:

1. Restore MCP and complete F002.
2. F001 three-role fail-closed foundation.
3. F003 minimum CI/security harness.
4. F004–F006 boundary closure.
5. F013 homepage publishing and SiteConfig source-of-truth consolidation.
6. F009–F010 canonical Supabase Storage and media cutover.
7. F011–F012 catalog correctness.
8. F007, F014 when decided, and F015.
9. F016.
10. F017 Storefront verification before public acceptance.

## Unknowns/manual captures

All captures below must use the Supabase MCP server bound to project `bdnvgbdmqmbzemllqngs`. Do not substitute another project selected by name.

### Required MCP calls

1. `search_docs` for current guidance on RLS, advisors, security-invoker views, and Storage bucket restrictions.
2. `list_extensions`.
3. `list_tables` for `public`, `auth`, and `storage`, using estimates where available.
4. `list_migrations`.
5. `get_advisors` with `type: "security"`.
6. `get_advisors` with `type: "performance"`.
7. `execute_sql` only for the aggregate/catalog queries below.

If the server cannot guarantee a read-only session, use only literal `SELECT` catalog and aggregate queries. Do not call RPCs.

### Version, extensions, tables, and size packet

```sql
begin transaction read only;

select
  current_setting('server_version') as server_version,
  current_setting('server_version_num') as server_version_num;

select
  e.extname as extension_name,
  e.extversion as extension_version,
  n.nspname as schema_name
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by e.extname;

select
  n.nspname as schema_name,
  c.relname as object_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned_table'
    when 'v' then 'view'
    when 'm' then 'materialized_view'
  end as object_type,
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

### RLS, grants, views, and definer-function packet

```sql
begin transaction read only;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
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
  p.prosecdef as security_definer,
  p.proconfig as function_settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef
  and n.nspname not in ('pg_catalog', 'information_schema')
order by n.nspname, p.proname;

select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by routine_schema, routine_name, grantee;

commit;
```

Do not return function bodies. If a policy clause contains an unexpected literal secret, redact the literal and retain only the structural predicate.

### Storage aggregate packet

```sql
begin transaction read only;

select
  b.id as bucket_id,
  b.name as bucket_name,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types,
  count(o.id) as object_count,
  coalesce(
    sum(
      case
        when coalesce(o.metadata ->> 'size', '') ~ '^[0-9]+$'
          then (o.metadata ->> 'size')::numeric
        else 0
      end
    ),
    0
  ) as total_object_bytes
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
group by
  b.id,
  b.name,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types
order by b.id;

commit;
```

This returns no object names or URLs.

### Role and core content aggregate packet

```sql
begin transaction read only;

select
  coalesce(nullif(btrim(role::text), ''), '<null-or-blank>') as role_value,
  count(*) as user_count
from public.users
group by 1
order by 1;

select publish_status, count(*) as vehicle_count
from public.vehicles
group by publish_status
order by publish_status;

select inventory_status, count(*) as vehicle_count
from public.vehicles
group by inventory_status
order by inventory_status;

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
  count(*) filter (where nullif(btrim(image_url), '') is not null) as legacy_image_url_present,
  count(*) filter (where image_id is not null and nullif(btrim(image_url), '') is not null)
    as both_image_paths_present,
  count(*) filter (where image_id is null and nullif(btrim(image_url), '') is not null)
    as legacy_only_image,
  count(*) filter (where image_id is null and nullif(btrim(image_url), '') is null)
    as no_image_path,
  count(*) filter (where dealership_id is null) as missing_dealership
from public.vehicles;

select
  is_active,
  count(*) as dealership_count,
  count(*) filter (where nullif(btrim(city), '') is null) as missing_city,
  count(*) filter (where coordinates_lat is null or coordinates_lng is null) as missing_coordinates,
  count(*) filter (where nullif(btrim(whatsapp), '') is null) as missing_whatsapp
from public.dealerships
group by is_active
order by is_active;

select
  status,
  is_visible,
  count(*) as page_count
from public.pages
group by status, is_visible
order by status, is_visible;

select
  count(*) as site_config_rows,
  count(*) filter (where general_logo_id is null) as missing_logo
from public.site_config;

select
  count(*) as media_rows,
  coalesce(sum(filesize), 0) as aggregate_media_bytes,
  count(*) filter (where nullif(btrim(alt), '') is null) as missing_alt,
  count(*) filter (where nullif(btrim(url), '') is null) as missing_media_url,
  count(*) filter (where filesize is null) as missing_filesize
from public.media;

select mime_type, count(*) as media_count, coalesce(sum(filesize), 0) as aggregate_bytes
from public.media
group by mime_type
order by mime_type;

select stage, count(*) as lead_count
from public.leads
group by stage
order by stage;

select event_type, count(*) as event_count
from public.analytics_events
group by event_type
order by event_type;

commit;
```

A second safe packet should count rows in `site_config_blocks_%` and `pages_blocks_%` tables by table/block type only. It must not return page text, link values, media filenames, or relationship identities.

### Storefront manual capture

Provide the exact Storefront repository and commit SHA, then run read-only contract verification for:

- Homepage loading from `site-config`.
- Published-only inventory visibility.
- Numeric price filtering and sorting.
- Navigation and page visibility.
- Dealership filtering and approved off-site redirects.
- Payload Media/Supabase Storage rendering.
- Preview authentication and draft non-disclosure.
- Analytics event generation and duplicate suppression.

Until then, F017 remains **[unknown]** and blocked.

## Evidence ledger

### MCP ledger

| ID | Tool/query | Result | Aggregate evidence returned |
|---|---|---|---|
| MCP-01 | `list_mcp_resources({})` | Success | Returned available connector/plugin resources; no Supabase MCP server was present. No project data returned. |
| MCP-02 | `list_mcp_resource_templates({})` | Success | Returned zero resource templates. No Supabase query template was available. |
| MCP-03 | Supabase `search_docs`, `list_tables`, `list_extensions`, `list_migrations`, `get_advisors`, `execute_sql` | Not callable | No Supabase tools were exposed, so no live aggregate was returned. |

### Non-MCP availability diagnostics

| ID | Diagnostic | Result |
|---|---|---|
| D-01 | `codex mcp list` through the PowerShell shim | Failed because local PowerShell script execution is disabled. |
| D-02 | `codex.cmd mcp list` | Success; reported: no MCP servers configured. |
| D-03 | Workspace `.mcp*` filename check | No project MCP configuration file found. No file containing credentials was opened. |

### Repository-static evidence

Completely read:

- `docs/product/inputs/HUMAN_PRODUCT_DECISIONS_20260710.md`
- `docs/product/roadmaps/gbe-platform-roadmap-20260710/PRODUCT_BLUEPRINT.md`
- `docs/product/roadmaps/gbe-platform-roadmap-20260710/FEATURE_ROADMAP.md`
- `docs/product/roadmaps/gbe-platform-roadmap-20260710/HUMAN_REVIEW.md`
- `docs/product/inputs/AGIREAL_REUSE_MATRIX.md`

Primary static implementation evidence included:

- `src/payload.config.ts`
- `src/access/roles.ts`
- `src/collections/Users.ts`
- `src/collections/Vehicles.ts`
- `src/collections/Dealerships.ts`
- `src/collections/Pages.ts`
- `src/collections/Media.ts`
- `src/collections/Leads.ts`
- `src/collections/AnalyticsEvents.ts`
- `src/globals/SiteConfig.ts`
- `src/globals/Home.ts`
- `src/payload-generated-schema.ts`
- `src/services/publicVehicleCatalog.ts`
- Payload REST and GraphQL routes
- `src/components/views/HomeBuilder.tsx`
- `scripts/sync-vehicle-images.mjs`
- `src/migrations/index.ts`
- `package.json`

The Supabase skills enforced the most important limitation of this report: live findings were not replaced with repository assumptions once MCP access proved unavailable.