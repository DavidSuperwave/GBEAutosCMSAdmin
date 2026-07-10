# F019 — Staging, backup/restore, and migration-rehearsal runbook

**Status: runbook authored; staging not yet provisioned, restore not yet
exercised.** The completion checklist at the end tracks what remains before
F019's acceptance criteria are met. Until every box is checked, no roadmap
migration (F001 roles, F011 price, F010 media, F013 legacy-home retirement)
may be applied to production.

Production project: Supabase `bdnvgbdmqmbzemllqngs` — **live business data**
(~1,391 vehicles). Nothing in this runbook is ever executed against it except
the explicitly marked production-apply step, inside a maintenance window,
after a staging rehearsal has passed.

## 1. Staging provisioning (one-time, operator with Supabase org access)

1. Create a new Supabase project in the same organization/region, named
   `gbe-autos-staging`. Record its project ref, host, and connection string.
2. Create one Storage bucket matching the production bucket name
   (`vehicle-images`) with the same visibility and MIME/size restrictions
   (exact production restrictions come from the F002 capture; until then,
   mirror what `scripts/sync-vehicle-images.mjs` assumes).
3. Create staging credentials and store them **only** in local
   `.env.staging` files and the CI secret store — never committed:
   - `DATABASE_URI` (staging Postgres)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (staging project)
   - `PAYLOAD_SECRET` (fresh random value, not the production secret)
4. Record the mapping in this file's environment table (section 6).

## 2. Sanitized seeding from production

Seeding uses a production snapshot with person-identifying data stripped.
Run from a machine with authorized read access, inside the same window the
backup is taken so the snapshot is consistent:

```powershell
# 1. Dump production (read-only; requires the production connection string)
pg_dump "$env:PROD_DATABASE_URI" --format=custom --no-owner --no-privileges `
  --file "gbe-prod-$(Get-Date -Format yyyyMMddTHHmmss).dump"

# 2. Restore into staging
pg_restore --clean --if-exists --no-owner --no-privileges `
  --dbname "$env:STAGING_DATABASE_URI" .\gbe-prod-<timestamp>.dump
```

3. Sanitize in staging (never in production). Minimum set:

```sql
BEGIN;
-- Staff accounts: neutralize credentials and emails
UPDATE users SET
  email = 'staging-user-' || id || '@example.invalid',
  hash = NULL, salt = NULL,
  reset_password_token = NULL, reset_password_expiration = NULL;
-- Leads: strip person data, keep shape/volume for realistic rehearsal
UPDATE leads SET
  first_name = 'Lead', last_name = 'Staging ' || id,
  email = 'lead-' || id || '@example.invalid',
  phone = '0000000000', message = NULL, notes = NULL;
-- Dealership internal fields
UPDATE dealerships SET sales_rep_name = NULL, internal_notes = NULL,
  email = 'dealer-' || id || '@example.invalid';
COMMIT;
```

4. Create one known staging admin via `payload` locally against staging, or
   an `INSERT`/`payload.create` scripted step, and record it in the evidence
   pack. Storage objects: copy only the objects needed for the rehearsal at
   hand (media rehearsals) using the Supabase CLI or Storage API — never with
   direct writes to the Storage metadata tables.

## 3. Backup and verified restore

A backup that has never been restored is not a rollback plan. The procedure:

1. `pg_dump --format=custom` of the target database (production before any
   apply; staging before any rehearsal). Name:
   `gbe-<env>-<UTC timestamp>.dump`. Compute and record its SHA-256.
2. Restore it into a scratch database (a second staging DB or local
   Postgres for the shape check):
   `pg_restore --clean --if-exists --dbname <scratch-uri> <dumpfile>`.
3. Verify the restore:
   - `payload_migrations` row count and names match the source
   - Row counts match on: `users`, `vehicles`, `dealerships`, `leads`,
     `analytics_events`, `media`, `site_config`, `pages`
   - `npm run dev` against the restored DB boots and `/admin` login works
     with the known staging admin
4. Archive the dump hash, row-count table, and boot evidence under
   `docs/product/evidence/backups/<date>/`.

The first fully-exercised restore closes the "restore proven" checklist item.

## 4. Migration rehearsal procedure (per migration)

Every roadmap migration follows this sequence. The named-owner placeholders
are filled in per work package before rehearsal starts.

| Role | Placeholder |
| --- | --- |
| Release owner (go/no-go, production apply) | _TBD per migration_ |
| Rehearsal operator (staging run, evidence) | _TBD per migration_ |
| Data reviewer (D02 mapping / D03 content / price classification) | _TBD per migration_ |

1. **Pre-rehearsal:** staging freshly re-seeded from a current sanitized
   snapshot; staging backup taken (section 3); migration merged on a branch
   passing the full CI slice (`check:migrations` included).
2. **Rehearse:** `npm run migrate` against staging only. Capture full stdout,
   duration, and any warnings.
3. **Verify:** the migration's own acceptance checks (e.g. for F001: no user
   row outside admin/general/sales, abort proven on an unmapped fixture user;
   for F011: reconciliation report row counts) plus an application boot and
   smoke pass against staging.
4. **Rollback rehearsal:** exercise the down path (`payload migrate:down`)
   or the documented restore, then prove re-apply is idempotent.
5. **Evidence:** archive command logs, before/after aggregates, and the
   reconciliation report under
   `docs/product/evidence/rehearsals/<migration-name>/<date>/`.
6. **Production apply (release owner only):** inside an announced
   maintenance window — fresh production backup (section 3, including the
   scratch-restore verification), apply, run the same verification queries,
   and keep the window open until abort thresholds are cleared.

### Abort thresholds and rollback triggers

Abort the apply (and execute rollback) if any of these occur:

- The migration errors, or affects a row count differing from the rehearsed
  count by more than 1% without an explained cause
- Any post-apply verification query returns unexpected rows (e.g. a user
  with a role outside the target enum; a vehicle losing its published state
  unexpectedly)
- `/admin` login or the public `/api/public/vehicles` list fails after apply
- The apply exceeds 3× its rehearsed duration
- Rollback trigger after the window: any staff lockout or storefront outage
  traced to the migration → restore the pre-apply backup per section 3 and
  re-open the work package

## 5. CI and test-suite wiring

- CI (`.github/workflows/ci.yml`) runs with dummy DB credentials and never
  touches production or staging. When F003's security suites land, they
  target an **ephemeral Postgres service container** in CI, or staging via
  explicitly configured secrets — never `bdnvgbdmqmbzemllqngs`.
- F009's durability proof (upload → redeploy → hash-compare) runs against
  the staging project only.
- `scripts/production-e2e-smoke.ts` remains a production **read** smoke for
  release verification; it is not a rehearsal tool.

## 6. Environment mapping

| Environment | Database | Storage | Credentials location | Status |
| --- | --- | --- | --- | --- |
| Local dev | ⚠ currently the **production** Supabase DB via `.env` | production bucket | local `.env` | Live risk: dev runs touch real data; switch local dev to staging once provisioned |
| Staging | _TBD at provisioning_ | _TBD_ | `.env.staging` + CI secrets | Not yet provisioned |
| CI | dummy credentials (no DB) | none | workflow env | Active |
| Production | `bdnvgbdmqmbzemllqngs` | `vehicle-images` | deployment platform env | Deploy binding owner TBD (F017) |

## 7. Completion checklist (F019 acceptance)

- [ ] Staging Supabase project + bucket provisioned and recorded above
- [ ] Sanitized seeding executed at least once; procedure corrections folded
      back into section 2
- [ ] Backup taken and a full restore exercised and verified (section 3),
      evidence archived
- [ ] Local development switched off the production database
- [ ] One real migration rehearsal executed end-to-end with archived
      evidence (the first candidate is the F001 role migration on staging)
- [ ] CI security/durability suites pointed at ephemeral/staging targets
