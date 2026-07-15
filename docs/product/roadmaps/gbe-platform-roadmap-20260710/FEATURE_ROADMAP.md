# Feature Roadmap

> Candidate roadmap. Human review is required before build planning or execution.

| ID | Feature | Current state | Dependencies | Risk | Confidence | Status |
|---|---|---|---|---|---|---|
| F001 | Explicit-role fail-closed migration and authorization proof (WP-01A) | partially_implemented | F002 | critical | high | review |
| F002 | Operations gate — staging and production truth capture | not_implemented | — | medium | high | review |
| F003 | Admin-only Node 22 CI and release harness (WP-00A) | not_implemented | F001 | medium | high | review |
| F004 | Vehicle raw/public/preview boundary contract (WP-01B) | partially_implemented | F001, F003 | high | high | review |
| F005 | Content and reference collection access policies (WP-01C) | partially_implemented | F001, F003 | high | high | review |
| F006 | Lead and analytics ingestion hardening (WP-01D / P0-6) | not_implemented | F001, F003, F005 | high | high | review |
| F007 | Pages-only draft/version publishing proof (WP-04A) | not_implemented | F003, F005 | medium | high | review |
| F008 | Tenant identity foundation (P0-7) | requires_product_decision | F001, F003 | critical | medium | blocked |
| F009 | Durable media storage adapter and canonical write path (WP-02A) | blocked_by_prerequisite | F002, F008 | high | high | blocked |
| F010 | Legacy media inventory, backfill, and cutover (WP-02B) | blocked_by_prerequisite | F009 | high | high | blocked |
| F011 | Numeric pricing migration and backfill (WP-03A) | not_implemented | F002, F003 | high | high | review |
| F012 | Complete public catalog API: filters, sorts, facets, and collection parameters (WP-03B) | partially_implemented | F004, F011 | medium | high | review |
| F013 | Homepage and SiteConfig draft publishing (WP-04B) | requires_product_decision | F007, F008 | medium | medium | blocked |
| F014 | Versioned vehicle presentation content (WP-04C) | requires_product_decision | F007 | medium | medium | blocked |
| F015 | Optimistic concurrency for vehicle workspace edits | not_implemented | F003 | medium | high | review |
| F016 | Admin style architecture isolation (P0-4 residual) | partially_implemented | F003 | medium | high | review |
| F017 | Storefront cross-repository contract gate | blocked_by_prerequisite | F004, F006, F012 | high | medium | blocked |
