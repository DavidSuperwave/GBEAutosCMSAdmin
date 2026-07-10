# Human product decisions — 2026-07-10

These decisions supersede conflicting assumptions in the current Fable blueprint
and must be used in its next revision or build planning.

## Confirmed decisions

### Roles

The product has exactly three business-facing roles:

- `admin`
- `general`
- `sales`

The current six-role code model is not the target. A per-user mapping and the exact
permission matrix still require review before any migration. Missing or invalid roles
must grant no privilege.

### One GBE site, not a multi-tenant dealership platform

This is a single GBE platform and main website. Do not build tenant accounts,
tenant-specific pages, tenant domains, tenant switching, or isolated dealership
workspaces.

Dealerships are inventory/location metadata used to:

- tag which location or group a vehicle belongs to;
- filter inventory, such as showing Seminuevos inventory;
- help visitors identify the nearest relevant location; and
- route visitors to an external dealership website when appropriate.

Those external websites are outside GBE's control. GBE only stores an approved
off-site link and directs traffic there. It does not render or manage separate
dealership websites.

### Product priority

The main priority is building the primary GBE homepage and ensuring that its content,
inventory, navigation, dealership/location metadata, and media all come from the
backend source of truth.

### Backend and storage direction

Supabase is the authoritative hosted backend. The live Supabase project should be
audited read-only before migrations or roadmap approval. Supabase Storage is the
preferred durable media direction unless the audit proves a blocking incompatibility.

## Blueprint implications

1. Remove the tenant-foundation feature and all tenant-dependent acceptance criteria.
2. Durable media no longer waits for a tenant identity decision; use a stable
   single-site object-key convention.
3. Homepage/SiteConfig publishing no longer waits for a tenant-singleton decision.
4. Replace the six-role roadmap assumptions with `admin`, `general`, and `sales`.
5. Preserve Dealerships as reference/location records with safe public fields and an
   approved external URL. Internal notes and management fields remain private.
6. Make the homepage publishing flow a higher priority after access control and the
   minimum release/test harness are safe.
7. Do not create dealership-specific page builders, domains, themes, onboarding, or
   site deployments.
8. Storefront verification is still required for the main GBE website because it is
   the consumer of the backend homepage and inventory contracts.

## Still requiring a decision

- Exact permission matrix for `admin`, `general`, and `sales`.
- Human-reviewed mapping of every existing user to one of those roles.
- Whether vehicle-specific presentation content should be versioned separately from
  operational inventory fields; this is not required to prioritize the homepage.
- Whether untrustworthy smart rankings should be removed until analytics rollups are
  reliable (recommended: remove or hide them temporarily).
- Exact pinned Storefront repository SHA for cross-repository verification.
