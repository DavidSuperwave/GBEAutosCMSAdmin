# AGIREAL reuse matrix — blueprint input

This document is an explicit input to the GBE platform product blueprint. It
records which patterns from the private `DavidSuperwave/AGIREAL` snapshot may be
adapted later, which constraints apply, and which roadmap features must not depend
on AGIREAL.

## Source identity

- Repository: `https://github.com/DavidSuperwave/AGIREAL`
- Local clone inspected:
  `C:/Users/Kecin/Documents/Codex/2026-07-09/https-www-aisdkagents-com-pro-patterns/work/AGIREAL`
- Pinned commit: `902c3ce975606c222358d1730e3f621e1baa1d1a`
- Branch state when inspected: clean `main`, equal to `origin/main`
- Snapshot catalog: `components/catalog.json`
- Catalog date and size: 2026-07-09, 120 AI SDK pattern snapshots
- Provenance rule: retain the upstream provider's licensing and access terms.
  Record the source commit for every adapted component.

The blueprint may inspect the referenced local clone directly. AGIREAL is a
reference/component library, not part of the current application repository and
not a production dependency to merge wholesale.

## Architectural boundary

Fable is the development orchestration system used to plan and implement the GBE
roadmap. AGIREAL contains candidate runtime product patterns for future dealer-facing
agents. Do not conflate Fable's implementation workers with the product's future
inventory, merchandising, media, lead, or analytics agents.

The current first feature, `WP-01A — Explicit-role fail-closed migration and
authorization proof`, has **no AGIREAL dependency**. Security, release harness,
tenant context, durable media, and publishing boundaries must be established before
runtime agent components become implementation-critical.

## Candidate reuse matrix

| GBE capability | AGIREAL source paths | Reuse | Do not reuse unchanged |
|---|---|---|---|
| Human approval and clarification | `components/agent-hil-plan/`; `components/ai-elements-confirmation/` | Approval/rejection states, clarification tools, plan preview, editable todo/plan artifact, and confirmation UI | Client-only approval state as an authorization boundary; generic plan schema; automatic continuation without a durable approval record |
| Typed specialist routing | `components/sub-agent-orchestrator/`; `components/ai-agents-routing/` | Typed routing contracts, streamed specialist results, structured outputs, and context/options passing | Generic research/analysis/support taxonomy; Exa dependency by default; account-tier authorization; raw tools that bypass GBE domain services |
| Orchestrator and progress UI | `components/ai-chat-agent-orchestrater-pattern/`; `components/wdk-workflows-orchestrator-worfklow/` | Coordinator/worker status displays, dependency/progress concepts, blocker states, and typed tool views | The execution core: workers use delays and canned outputs; generic duration/quality claims; deployment worker; unrestricted parallel mutation |
| Marketing plan-to-action flow | `components/agent-usecase-marketing-plan-implement/`; `components/example-agent-just-bash-marketing/` | Plan → clarify → approve → implement interaction shape, editable artifacts, tool-status views, and brand-context handoff | In-memory shared state, unfinished `README`/TODO surfaces, scraping tools without SSRF controls, or direct mutations without tenant/role/approval policy |
| Brand onboarding and design tokens | `components/example-agent-branding/`; `components/example-brand-guidelines-image-generation/`; `components/levee-brand-strategy/` | Brand extraction/brief schema ideas, color/typography/token displays, accessibility checks, and human review flow | Firecrawl as a mandatory provider, scraped content as trusted input, generated brand data as automatically published tenant configuration |
| Media generation/editing | `components/example-brand-mood-image-generation/`; `components/example-brand-image-generation/`; `components/ai-sdk-gemini-flash-image-edit/`; `components/gemini-flash-image-merge/`; `components/ai-elements-image/` | Prompt-template libraries, structured briefs, per-card job/error states, before/after comparison, edit/reset UX, and partial-failure handling | Provider-specific server actions, local-only image versions, data URLs as durable assets, demo model choices, or generation without budgets/moderation/provenance |
| Banner and page artifacts | `components/json-render-image/`; `components/agent-canvas-draw-artifact/` | Streamed artifact side panel, responsive preview, export concepts, JSON/SVG/PNG rendering experiments, undo/version UX | Excalidraw as the final banner format; in-memory-only versions; unbounded scene JSON; exports that bypass canonical Payload Media and approval |
| Inventory import/export artifacts | `components/agent-xlsx-artifact/`; `components/ai-artifact-table/`; `components/xlsx-csv-export/`; `components/csv-tsv-json-export/` | Spreadsheet preview/grid, streamed tabular artifact, CSV/XLSX export, and download/copy affordances | Replacing existing GBE import normalization, mapping, validation, import jobs, or approval services; browser-only state as the source of truth |
| Chat and artifact shell | `components/examples-chat-base-clone/`; `components/agent-text-artifact/`; `components/ai-elements-task-demo/` | Message/tool rendering, artifact panel layout, task progress, loading/empty/error states | A second unrelated design system, duplicate Prompt Kit primitives, or generic demo navigation/account assumptions |

## High-value files to inspect during relevant feature planning

### Approval and planning

- `components/agent-hil-plan/lib/plan-builder-agent.ts`
- `components/agent-hil-plan/lib/generate-plan.ts`
- `components/agent-hil-plan/lib/refine-plan.ts`
- `components/agent-hil-plan/components/plan-builder-chat.tsx`
- `components/agent-hil-plan/components/plan-preview.tsx`
- `components/ai-elements-confirmation/app/api/ai-elements-confirmation/route.ts`
- `components/ai-elements-confirmation/components/chat-form.tsx`

### Routing and agent tool contracts

- `components/sub-agent-orchestrator/lib/orchestrator-agent.ts`
- `components/sub-agent-orchestrator/lib/sub-agents.ts`
- `components/sub-agent-orchestrator/lib/types.ts`
- `components/ai-agents-routing/app/api/routing-agent/route.ts`
- `components/ai-agents-routing/lib/ai-routing-types.ts`
- `components/ai-chat-agent-orchestrater-pattern/lib/ai-agent-orchestrator-tools/schema.ts`
- `components/ai-chat-agent-orchestrater-pattern/components/tool-views/`

### Media and brand workflows

- `components/example-brand-guidelines-image-generation/lib/brand-guidelines-schema.ts`
- `components/example-brand-guidelines-image-generation/lib/guidelines-scene-prompts.ts`
- `components/example-brand-mood-image-generation/lib/brand-mood-schema.ts`
- `components/example-brand-mood-image-generation/lib/mood-scene-prompts.ts`
- `components/example-brand-image-generation/lib/brand-placement-schema.ts`
- `components/example-brand-image-generation/lib/product-photo-prompts.ts`
- `components/ai-sdk-gemini-flash-image-edit/components/gemini-flash-image.tsx`
- `components/json-render-image/lib/catalog.ts`
- `components/json-render-image/app/api/image/route.ts`

### Artifacts and tabular data

- `components/agent-canvas-draw-artifact/lib/artifacts.ts`
- `components/agent-canvas-draw-artifact/components/whiteboard-artifact-panel.tsx`
- `components/agent-xlsx-artifact/app/api/agent-xlsx-artifact/route.ts`
- `components/agent-xlsx-artifact/components/xlsx-artifact-panel.tsx`
- `components/agent-xlsx-artifact/lib/xlsx-export.ts`

## Mandatory GBE adaptation rules

1. Product agent tools call the same typed, tenant- and role-aware domain services
   as the operator UI. They never mutate raw Payload collections directly.
2. Import commit, inventory mutation, page mutation, media attachment, outbound
   person-directed communication, and publish require explicit durable approval.
3. Approval is bound to actor, tenant, role, exact proposed diff/input, expiration,
   and idempotency key. A React state flag is not authorization.
4. Every tool receives server-derived tenant and actor context. Client-supplied
   tenant IDs, roles, account tiers, costs, or approval state are untrusted.
5. Generated assets are saved through the canonical persistent Media service with
   tenant, provider, model, prompt/provenance, cost, rights, safety, lifecycle, and
   approval metadata before use by a vehicle or page.
6. Provider calls require quotas, cost reservation/ledger, concurrency limits,
   retry/idempotency rules, cancellation, timeouts, and observable failure states.
7. No agent may publish automatically. Agent output is a proposal attached to a
   draft entity until an authorized person approves the exact action.
8. Rate limiting must fail closed for protected/cost-bearing operations. Demo
   helpers that fall back when Redis is unavailable are not acceptable production
   policy.
9. URL ingestion and scraping require allow/deny rules, DNS/IP revalidation,
   redirect limits, content-type/size limits, and SSRF protection.
10. Agent and artifact state must be durable and auditable. AGIREAL patterns that
    explicitly use local or in-memory versions require a server persistence design.
11. UI components must be adapted to the future operator design system and scoped
    styling boundary; do not add another large global stylesheet.
12. Add only the minimal pinned dependencies required by an approved feature.
    Current GBE Admin does not yet depend on `ai`, `@ai-sdk/react`, Zod, Upstash,
    Firecrawl, Excalidraw, Papaparse, or React Data Grid.

## Roadmap placement

- `WP-01A`, release harness, remaining access closure, tenant foundation, durable
  media, catalog correctness, and publishing proofs: AGIREAL is reference-only or
  irrelevant and must not expand their scope.
- Dedicated operator console: selected chat/artifact/task UI primitives may be
  evaluated after design-system boundaries exist.
- AI media and agentic operations: run separate feature spikes for typed routing,
  durable approval, media artifact lifecycle, and provider jobs. Do not combine
  them into one implementation layer.
- Analytics/lead intelligence: reuse structured result and task-status UI only after
  ingestion integrity and trusted rollups exist.

## Required proof before adopting a pattern

For each selected component, record its source path/commit, imported dependencies,
server/client boundary, persistence assumptions, authorization assumptions, data
flow, accessibility state, and test coverage. Create a minimal compatibility spike
against the actual Next.js/React/Payload versions, then accept or reject it with
evidence. A visual resemblance or compiling demo is not sufficient proof.
