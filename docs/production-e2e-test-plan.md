# GBE Autos Production E2E Test Plan

Use this checklist with the automated smoke script before production cutover.

```bash
npm run test:e2e:production
```

For deployed HTTP API checks, set `E2E_BASE_URL` to the CMS base URL before running the script. The script is read-only; it checks env, database migrations, schema shape, public catalog rules, collection visibility, and core workflow helpers without creating leads, vehicles, or media.

## Automated Smoke Gate

- Run `npm run generate:types`.
- Run `npm run generate:importmap`.
- Run `npm run lint`.
- Run `npm run build`.
- Run `npm run test:e2e:production`.
- Confirm there are zero failures. Warnings are acceptable only when they match intentional launch decisions, such as AI/spec/photo providers not being configured yet.
- Confirm all Payload migrations listed in `src/migrations/index.ts` are applied to the target database.
- Confirm `site_config_navigation_footer_links.id` and `site_config_navigation_legal_links.id` are `varchar`.
- Confirm required env vars are set: `DATABASE_URI`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_FRONTEND_URL`.
- Confirm SMTP vars are set before testing invites/password reset: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`.

## Admin Walkthrough

- Auth: create first admin on a fresh DB, log in/out, request forgot-password, reset password, and invite a user.
- Roles: verify admin, inventory manager, content editor, sales manager, media editor, and viewer permissions against the collections they should and should not mutate.
- Shell: open `/admin`, check dashboard metrics, analytics widgets, sidebar links, and theme toggle states.
- Inventory: open `/admin/inventory`, test search, filters, tabs, pagination, status badges, deep links, create vehicle, edit workspace, and default vehicle-list redirect.
- Vehicle workspace: test summary, specs, images, listing page, review/publish, activity, publish blockers, review metadata, publish metadata, stable slugs, completeness score, status derivation, and price formatting.
- Import: upload CSV/XLSX, verify column suggestions, normalization, duplicate handling, row errors, import job counts, and imported draft vehicles.
- Specs lookup: run makes/models/generations/trims/specs path with provider configured, and verify friendly failure when provider config is absent.
- Media: upload media with alt text, upload hero/gallery from vehicle image studio, create/reuse vehicle media assets, approve/reject images, and open media workspace with `vehicleId`/`referenceId`.
- AI workshop: verify unauthenticated/unauthorized rejection, not-configured response without provider calls, configured generation job lifecycle, output persistence, save destinations, templates, messages, turn IDs, style prompt/reference, and error handling.
- Builders: edit/save/preview home sections, pages, landing pages, vehicle template toggles, protected slugs, status visibility, section ordering, and all section block types.
- Taxonomy: create vehicle tags, manual collections, smart collections, hidden collections, and SEO metadata.
- Sales/analytics: edit dealerships, test routing flags, manage lead stages, and confirm dashboard metrics reflect test events.

## Public Site And API Walkthrough

- CMS API: verify `/api/public/vehicles`, `/api/public/vehicles/:slug`, `/api/public/collections`, and `/api/public/collections/:slug`.
- Filters: test keyword, brand, model, model family, city, dealership, year range, mileage range, body type, segment, vehicle type, fuel, transmission, condition, inventory status, and tags.
- Sorts: test newest, price asc/desc, mileage asc, and year desc.
- Visibility: confirm published available/reserved vehicles appear; sold, draft, archived, hidden collections, and missing slugs do not.
- Detail shape: confirm vehicle detail includes description, features, gallery, landing blocks, specs, source meta, and template overrides.
- Preview: confirm authenticated draft vehicle preview route works.
- Frontend routes: smoke `/`, `/inventario`, `/seminuevos`, `/marcas`, `/colecciones`, one collection detail, one CMS page, and one vehicle detail.
- Responsive: check 390x844 mobile and 1440x900 desktop for no runtime errors, broken media, clipped text, or horizontal overflow.
- No-price case: confirm the public UI renders “Precio a consultar” or the approved equivalent.
- WhatsApp: test direct dealership routing, brand+city routing, city default routing, Culiacan/Culiacán/mojibake normalization, fallback routing, test lead creation, analytics event creation, opened timestamp, and lead stage transition.

## Cutover Notes

- Use safe internal test data for WhatsApp and AI generation.
- Keep or remove `QA_P3` fixtures intentionally; do not leave the decision implicit.
- Verify production media storage before relying on uploaded/generated images at scale.
- Submit one production test lead and remove it after verification.
