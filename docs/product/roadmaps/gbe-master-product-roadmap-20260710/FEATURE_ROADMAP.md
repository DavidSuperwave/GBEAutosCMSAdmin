# Feature Roadmap

> Candidate roadmap. Human review is required before build planning or execution.

| ID | Feature | Current state | Dependencies | Risk | Confidence | Status |
|---|---|---|---|---|---|---|
| F001 | Three-role fail-closed migration (admin/general/sales) replacing the live six-role enum | partially_implemented | F002, F018 | critical | high | review |
| F002 | Operations truth capture — complete the blocked read-only live facts | partially_implemented | — | high | high | review |
| F003 | Expanded security-test harness on the baseline CI | not_implemented | F001, F018 | medium | high | review |
| F004 | Vehicle raw/public/preview boundary contracts under the three-role model | partially_implemented | F001, F003 | high | high | review |
| F005 | Content and reference access closure with a safe public dealership DTO | partially_implemented | F001, F003 | high | high | review |
| F006 | Lead and analytics ingestion hardening | not_implemented | F001, F003, F005 | high | high | review |
| F007 | Generic Pages draft/version publishing (after the homepage proof) | not_implemented | F003, F005, F013 | medium | high | review |
| F009 | Durable media: Supabase Storage behind the canonical Payload Media service | not_implemented | F002, F018, F019 | high | high | review |
| F010 | Media reconciliation and legacy image-path retirement | blocked_by_prerequisite | F009 | high | high | blocked |
| F011 | Numeric pricing migration and human-reviewed backfill | not_implemented | F002, F018, F019 | high | high | review |
| F012 | Complete public catalog: filters, deterministic sorts, facets, and parameterized collections | partially_implemented | F004, F011 | medium | high | review |
| F013 | Primary GBE homepage publishing on site_config with legacy home retirement | not_implemented | F001, F005, F018 | high | high | review |
| F014 | Safe versioned vehicle presentation editing (required; model shape per D07) | requires_product_decision | F007 | medium | medium | blocked |
| F015 | Optimistic concurrency for vehicle workspace and publishing flows | not_implemented | F013, F018 | medium | high | review |
| F016 | Interim admin style containment inside Payload (destination is the operator console) | partially_implemented | F018 | medium | high | review |
| F017 | Cross-repository release gate: Storefront verification at the pinned SHA with durable-media launch dependencies | blocked_by_prerequisite | F004, F006, F009, F010, F012, F013, F020, F028, F029 | high | medium | blocked |
| F018 | Pinned clean baselines and Node 22 baseline CI slice (before the role migration) | not_implemented | — | medium | high | review |
| F019 | Staging environment, backup/restore, and migration-rehearsal infrastructure | not_implemented | F018 | high | high | review |
| F020 | Early Storefront baseline capture and shared contract/block drift checks | requires_product_decision | F018 | medium | high | blocked |
| F021 | Authentication operations: login, reset, staged email, invites, and break-glass recovery | partially_implemented | F001, F003 | medium | high | review |
| F022 | Rate limits, request limits, idempotency, and auditability for cost-bearing and commercial endpoints | not_implemented | F001, F003 | high | high | review |
| F023 | Governed import pipeline: dry run, human approval, idempotency, rollback, and ~1,400-row scale proof | partially_implemented | F001, F003, F019 | high | high | review |
| F024 | Inventory operations: review queues, image association approval, completeness, lifecycle, aging, and exposure signals | partially_implemented | F001, F003, F023 | medium | high | review |
| F025 | Builder V2: versioned block registry and the complete editor contract | partially_implemented | F013, F038 | high | medium | review |
| F026 | Dedicated operator console shell with a product-owned design system | not_implemented | F001, F018 | high | medium | review |
| F027 | Incremental workflow migration into the operator console | not_implemented | F026 | medium | medium | blocked |
| F028 | Modern GBE Storefront journeys: homepage, catalog, and vehicle detail | unknown | F012, F013, F020, F025 | high | medium | blocked |
| F029 | Storefront quality: SEO, accessibility, performance, and honest failure states | unknown | F020, F028 | medium | medium | blocked |
| F030 | Durable AI job infrastructure: provider abstraction, queue, safety, and cost governance | partially_implemented | F003, F009, F022 | high | medium | review |
| F031 | AI Media Studio in the operator console: vehicle workshop and banner/promo/social workspace | partially_implemented | F009, F026, F030 | medium | medium | review |
| F032 | Typed agent orchestrator and durable approval framework | not_implemented | F001, F003, F022 | high | medium | review |
| F033 | Inventory import assistant agent | not_implemented | F023, F032 | medium | medium | blocked |
| F034 | GBE lead capture and dealership/city-aware WhatsApp handoff | requires_product_decision | F005, F006 | medium | high | review |
| F035 | Lead inbox and sales workflow: assignment, stages, SLA, and routing outcomes | partially_implemented | F006, F026, F034 | medium | high | review |
| F036 | Trusted analytics: bounded sessions, attribution, consent, bot filtering, idempotent events, and rollups | partially_implemented | F003, F006 | high | high | review |
| F037 | Dealer-facing reporting: exposure, conversion, demand, aging, and SLA views | partially_implemented | F024, F026, F035, F036 | medium | medium | review |
| F038 | Shared contracts source of truth and the bounded monorepo decision | partially_implemented | F018 | medium | high | review |
