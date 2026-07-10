# Feature Roadmap

> Candidate roadmap. Human review is required before build planning or execution.

| ID | Feature | Current state | Dependencies | Risk | Confidence | Status |
|---|---|---|---|---|---|---|
| F001 | Three-role fail-closed migration (admin/general/sales) replacing the live six-role enum | partially_implemented | F002 | critical | high | review |
| F002 | Operations truth capture — complete the blocked read-only live facts | partially_implemented | — | medium | high | review |
| F003 | Minimum Node 22 CI and security-test harness | not_implemented | F001 | medium | high | review |
| F004 | Vehicle raw/public/preview boundary contracts under the three-role model | partially_implemented | F001, F003 | high | high | review |
| F005 | Content and reference access closure with a safe public dealership DTO | partially_implemented | F001, F003 | high | high | review |
| F006 | Lead and analytics ingestion hardening | not_implemented | F001, F003, F005 | high | high | review |
| F007 | Pages draft/version publishing proof (resequenced after homepage) | not_implemented | F003, F005, F013 | medium | high | review |
| F008 | Tenant identity foundation (removed — single GBE site confirmed) | obsolete_or_duplicate | — | low | high | no_build_needed |
| F009 | Durable media: Supabase Storage behind the canonical Payload Media service (unblocked) | not_implemented | F002, F003 | high | high | review |
| F010 | Media reconciliation and legacy image-path retirement | blocked_by_prerequisite | F009 | high | high | blocked |
| F011 | Numeric pricing migration and human-reviewed backfill | not_implemented | F002, F003 | high | high | review |
| F012 | Complete public catalog: filters, deterministic sorts, facets, and parameterized collections | partially_implemented | F004, F011 | medium | high | review |
| F013 | Primary GBE homepage publishing on site_config with legacy home retirement (unblocked, prioritized) | not_implemented | F001, F003, F005 | high | high | review |
| F014 | Versioned vehicle presentation content (separately gated product decision) | requires_product_decision | F007 | medium | medium | blocked |
| F015 | Optimistic concurrency for vehicle workspace and publishing flows | not_implemented | F003, F013 | medium | high | review |
| F016 | Admin style architecture isolation (sequenced last among build features) | partially_implemented | F003 | medium | high | review |
| F017 | Storefront verification release gate at a pinned SHA | blocked_by_prerequisite | F004, F006, F012, F013 | high | medium | blocked |
