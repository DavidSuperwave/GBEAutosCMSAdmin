# F020 Storefront baseline capture and contract drift check

## Scope

This record inventories everything the Storefront consumes from this Admin
backend, captured empirically from the Storefront source at the pinned F018
baseline. It is the scoping baseline for F028/F029 modernization and the
F017 release gate, and it feeds the CI drift check
(`scripts/check-storefront-contract.mjs` against
`contracts/storefront-consumption.json`).

- Storefront repository: `https://github.com/DavidSuperwave/GBEautos.git`
- Pinned SHA: `d0e8fd019aefba8ef3a760e93bd09ca67a3d72ae`
  (branch `codex/ultra-f018-storefront-baseline`, sibling checkout `../GBE Autos`)
- `package-lock.json` SHA-256: `fcc815de313e47200ca128ed28697c2dedd4d92a6579a8d129b056153b83ab45`
- Recorded clean-check status at the pin (from F018 L001 proof history):
  lint passed, standalone `tsc --noEmit` passed, `next build` passed.
- Capture date: 2026-07-10. Method: static read of the Storefront source at
  the pinned SHA. No network calls, no Storefront execution, no database access.

## A. Bounded public DTO routes consumed

Consumer plumbing: `lib/cms.ts` (base URL from `CMS_URL`/`NEXT_PUBLIC_CMS_URL`,
3.5 s timeout, strict mode via `CMS_STRICT_MODE`; all failures degrade to
hardcoded fallback content unless strict).

| Admin endpoint | Consumer | Notes |
| --- | --- | --- |
| `GET /api/public/vehicles` | `lib/vehicles.ts` (`fetchPublicVehicles`) | Query params sent: `page`, `limit`, `sort`, `keyword`, `brand`, `model`, `city`, `bodyType`, `fuel`, `transmission`, `yearMin`, `yearMax`, `mileageMax`, `condition`, `inventoryStatus`. Sorts sent: `newest`, `priceAsc`, `priceDesc`, `yearDesc`, `mileageAsc` (`yearAsc`/`recent` collapse to `newest` client-side). Facets are built client-side by paging up to 25×100 docs into memory. |
| `GET /api/public/vehicles/[slug]` | `lib/vehicles.ts` (`getVehicleBySlug`) | Detail DTO. |
| `GET /api/public/vehicles/preview/[id]` | `app/cars/preview/[id]/page.tsx` | Authenticated preview (cookie pass-through). |
| `GET /api/public/collections` | `lib/vehicles.ts` (`fetchPublicCollections`) | `page`, `limit` only. |
| `GET /api/public/collections/[slug]` | `lib/vehicles.ts` (`fetchPublicCollection`) | `page`, `limit` only — the Storefront never sends catalog filters here today. |

DTO fields consumed (mirrored in `lib/vehicles.ts` as `PublicVehicleCardDTO` /
`PublicVehicleDetailDTO` / `PublicCollectionDTO`): every field of the Admin's
`PublicVehicleCard` including `stats`, plus detail fields `description`,
`features`, `gallery`, `landing`, `specs`, `templateOverrides`. Landing block
types rendered: `imageText`, `gallery`, `highlightList`, `featureGrid`, `cta`
(unknown landing block types are dropped safely by `normalizeLandingBlock`).

Declared-but-not-served: the Storefront's `PublicVehicleDetailDTO` also
declares optional `sourceMeta`, which the Admin detail DTO does not serialize.
It is optional and guarded (`"sourceMeta" in vehicle`), so this is drift-safe
today; it is recorded here rather than in the enforced fixture.

## B. Raw Payload REST endpoints consumed (critical constraint)

The Storefront consumes these **raw collection/global endpoints**, not bounded
DTOs. Any access-rule hardening (F005), draft/versions migration (F013, F007),
or field retirement on these surfaces is a Storefront-breaking change until
the consumer is migrated to bounded DTOs:

| Admin endpoint | Consumer | Fields consumed |
| --- | --- | --- |
| `GET /api/globals/site-config?depth=2` (also `&draft=true`) | `lib/site.ts` (`getSiteConfig`) | `general.*` (siteName, companyName, slogan, logo, phone, whatsapp, email, address, socialLinks), `navigation.*` (mainLinks, footerLinks, legalLinks, cta), `home.sections`, `templates.seminuevos`, `templates.vehicleDetail` |
| `GET /api/pages?where[showInNavigation]…&where[isVisible]…` and `where[slug]` | `lib/site.ts` (`getSiteConfig`, `getPageBySlug`) | `title`, `slug`, `status`, `isVisible`, `showInNavigation`, `navLabel`, `navParent`, `seo`, `sections` |
| `GET /api/dealerships?where[isActive][equals]=true` | `lib/dealerships.ts`, `app/api/leads/route.ts` | `id`, `brandName`, `displayName`, `city`, `state`, `address`, `phone`, `whatsapp`, `email`, `hours`, `defaultForCity`, `isActive` — today this also exposes `salesRepName`/`internalNotes` publicly (the F005 finding); the Storefront does not read them |
| `POST /api/leads` | `app/api/leads/route.ts` (server-side proxy) | Writes: `firstName`, `lastName`, `email`, `phone`, `city`, `agency`, `vehicle`, `vehicleLabel`, `whatsappNumber`, `whatsappOpenedAt`, `source`, `leadSource`, `sourcePage`, `sourceSection`, `message`, `stage` (sets `stage: "whatsapp_opened"`) |
| `POST /api/analytics-events` | `app/api/analytics-events/route.ts` (proxy for `components/AnalyticsTracker.tsx`) | Writes: `eventType`, `pagePath`, `pageTitle`, `targetLabel`, `vehicle`, `vehicleLabel`, `agency`, `city`, `brand`, `condition`, `collectionId`, `leadId`, `sourceSection`, `durationSeconds`, `sessionId`, `visitorId` |

Analytics event types emitted: `page_view`, `vehicle_view`, `vehicle_click`,
`whatsapp_form_open`, `whatsapp_form_submit`, `whatsapp_open`,
`collection_view`, `filter_used`, `cta_click`, `page_duration` — the full
Admin taxonomy.

## C. Homepage/site section block types rendered

The Storefront renders `home.sections` and page `sections` against these block
types (`lib/site.ts` `SiteSection` union): `hero`, `promoStrip`,
`featuredVehicles`, `inventoryCollection`, `inventorySearch`, `cityInventory`,
`promoBanner`, `trustSteps`, `testimonials`, `videoTips`, `brands`,
`agencies`, `mediaText`, `cta` — all 14 registered Admin block types.

The Storefront additionally accepts a `campaignImage` alias alongside
`promoBanner` that the Admin registry does not define; it is consumer-side
tolerance, not an Admin contract.

## D. WhatsApp routing behavior duplicated consumer-side

`app/api/leads/route.ts` re-implements dealership/city WhatsApp routing
(vehicle dealership → brand+city match → city default → site fallback) with
hardcoded fallback `brandGroups` tables in `lib/dealerships.ts`. F034's
server-side routing service should absorb this so routing logic exists once,
behind the Admin API.

## E. Fallback/demo-content posture (F029 input)

Unless `CMS_STRICT_MODE` is set, every failed CMS request silently falls back
to hardcoded demo inventory (8 vehicles in `lib/vehicles.ts`), hardcoded
navigation, and hardcoded dealership tables. `hasCMSConfig()` is also forced
false during production build (`NEXT_PHASE === "phase-production-build"`), so
statically rendered paths bake fallback content at build time. This is the
"plausible demo inventory" the consultation prohibits in production — direct
F029 scope.

## F. Drift check

`npm run check:contracts` (wired into CI) runs
`scripts/check-storefront-contract.mjs`, which statically parses the Admin
contract sources and fails when anything in
`contracts/storefront-consumption.json` — route files, DTO type fields,
landing block types, site-section block slugs, collection/global slugs and
field names, analytics event types, sort/query-param literals — is no longer
declared. Verified both directions on 2026-07-10: passes on the current tree;
fails (exit 1) when fed a probe fixture containing a removed field, block
slug, and event type.

Limits: the check proves declaration presence, not runtime serialization
behavior or response shapes; it cannot detect semantic changes (e.g. a field
kept but repurposed). Runtime verification belongs to F017's cross-repository
gate under shared fixtures.

## G. Explicit limitations

No Storefront execution, no live HTTP verification, and no analytics/lead
journey was exercised. The capture reflects the pinned SHA only; if the
Storefront moves its baseline, recapture and update the fixture. F002 remains
untouched by this work.
