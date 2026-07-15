# CONSULT — current-codebase audit for Fable orchestration

> Read `ORIENT.md` first. It defines the sandbox, evidence labels, failure
> classifications, and anti-hallucination rules. Then read `PRIOR_CONTEXT.md` in
> full: it is the supplied `GBE_CAR_COMMERCE_PLATFORM_AUDIT_AND_ROADMAP.md`, not a
> prior model verdict. Audit its Admin/CMS claims against the repository packet.

## 1. Intent

**Intent for this run:** `plan-audit`

Reconcile the supplied architecture audit and product roadmap with the current
`GBEAutosCMSAdmin` codebase. Determine which findings and work packages remain
correct at the exact packet state, which have been partially or fully addressed
since the roadmap's audited commit, and what bounded work Fable should orchestrate
first. This is an evidence-producing consultation, not authorization to implement.

## 2. Context

- **Run ID / label:** `gbe-current-roadmap-audit`
- **Roadmap's Admin/CMS baseline:** `e47352123cb70bb4c2823f25fcf6b751de4d05e4`
- **Current committed HEAD when this ask was prepared:** `d6d505f6ef9fea5c0a1aaf50e112b9db324ac8bf`
- **What changed:** four Admin workflow commits after the roadmap baseline, plus
  uncommitted user work included in the packet. Use the packet manifest and change
  artifacts as the final authority if the state differs from the SHA above.
- **What this material is:** Payload 3 / Next.js Admin, API, inventory, page, media,
  lead, analytics, and Supabase-backed Postgres integration for GBE Autos.
- **Change under consultation:** whole current Admin tree, with the delta from
  `e47352123cb70bb4c2823f25fcf6b751de4d05e4` supplied as review metadata.
- **Prior context attached?** yes — `PRIOR_CONTEXT.md`, the 2026-07-10 architecture
  audit and roadmap that must be reconciled rather than accepted at face value.
- **END_STATE.md included?** no.
- **Important state rule:** uncommitted files and edits belong to the user. Inspect
  them as part of the current state, but do not modify any repository file.

## 3. What I need from you

1. Give a verdict on the supplied roadmap **as an orchestration input at the current
   packet state**: `go | revise | no-go`. Judge the plan as written; do not silently
   replace it with an idealized plan.
2. Produce a delta matrix for every release blocker `P0-1` through `P0-7` and every
   first work package `WP-00` through `WP-04`. For each item report:
   - `open | partially-addressed | resolved | contradicted | unknown`;
   - the roadmap's claim in one sentence;
   - current repository evidence with exact `repo/<path>:line` anchors;
   - what changed since `e473521` when the change artifacts establish it;
   - the remaining acceptance proof needed.
3. Re-test especially the claims most likely affected by the four later commits:
   invite/specs/import/workshop authorization, public and preview DTO boundaries,
   publish gating, media assignment/review policy, catalog query behavior, workflow
   save guards, admin-style stability, and the alleged absence of test/release gates.
   Do not infer resolution from filenames, helper names, or UI guards alone; trace
   each relevant request path through server-side enforcement.
4. Identify plan-to-code mismatches, stale facts, missing dependencies, unsafe
   sequencing, and work that is too broad for a single Fable feature/layer.
5. Return a corrected, dependency-aware orchestration sequence for the Admin/CMS
   repository only. Preserve useful roadmap identifiers where possible, but split or
   reorder work where the live evidence requires it.
6. Recommend exactly **one** bounded first feature for `/fable:blueprint` (or explain
   why no feature is ready). Define its goal, in-scope paths, deliberate exclusions,
   security invariants, migration/data constraints, acceptance criteria, and proof
   commands. Prefer the smallest vertical risk-reduction slice that creates a reliable
   foundation for later layers; do not return a menu.
7. Call out facts the repository cannot prove, including live Supabase Postgres
   version/extensions, Data API exposure/grants/RLS, deployed environment settings,
   SMTP/provider behavior, persistent object-storage durability, and current
   production data. For each unknown, name the exact staging query, configuration
   capture, or experiment that would resolve it.
8. Separate conclusions about this Admin/CMS packet from storefront conclusions.
   The Storefront repository is not in this packet, so do not claim its roadmap items
   are revalidated. Mark cross-repository dependencies and storefront claims as
   carried-forward or unknown.

## 4. Required preflight

Run these before trusting tools and record every command in the evidence ledger.

1. **Environment:** `uname -a`, `python3 --version`, `node --version`,
   `npm --version`, and the package/runtime declarations in `repo/package.json` and
   the lockfile.
2. **Network egress:** DNS resolution for `example.com`, then
   `curl -sSI https://example.com`; classify the first failure precisely. This probes
   only the model runtime surface.
3. **Repository state:** inspect `CONTENTS.md`, the manifest/change artifacts,
   `git status` if `.git` is present, and both the current tree and supplied base diff.
4. **Static/release checks:** run, when available in the sandbox:
   - `npm run check:admin-styles`
   - `npx tsc --noEmit --incremental false`
   - `npm run lint`
   - `git diff --check` if Git metadata is present
5. Do not run the production database smoke/cleanup/seed/migration scripts. They may
   require credentials or mutate external state. Do not run a production build merely
   to restate the older audit; if the read-only sandbox prevents it, classify that
   honestly and specify the clean Node 22 CI proof needed.
6. No browser/visual claim is requested. Do not use `visual-verified` without the full
   real-browser acceptance test defined in `ORIENT.md`.

## 5. Evidence ledger (required)

Keep a row for every command:

```text
| cwd | command | exit code | classification | proof excerpt or artifact path |
```

Use only the classifications and evidence labels defined by `ORIENT.md`. Static code
inspection is `static-analysis`, not runtime verification. A current passing command
does not prove deployed database, storage, provider, tenant, or browser behavior.

## 6. Final report format

Lead with the answer and include only these sections:

1. **Bottom line** — `go | revise | no-go`, with primary evidence label.
2. **Capability preflight summary.**
3. **Roadmap delta matrix** — `P0-1..P0-7` and `WP-00..WP-04` with the fields from §3.
4. **Findings** — only material plan/code mismatches and hidden dependencies, each
   using Severity, Confidence, Evidence type, Path(s), Impact, Reasoning, Fix, and
   Regression test.
5. **Corrected Admin/CMS orchestration sequence** — ordered, bounded features with
   explicit dependency gates; distinguish code work from environment/operations work.
6. **Recommended first Fable feature** — exactly one blueprint-ready feature contract.
7. **Verified vs static vs blocked.**
8. **Evidence ledger.**
9. **Unknowns and cross-repository limits** — with resolving experiments.
10. **Next steps** — end with the single call for what Fable should do next.

Do not pad the report with generic modernization advice. Do not describe a risk as
fixed merely because the UI hides it or a helper exists; prove enforcement at the
collection, endpoint, service, storage, or database boundary that actually controls it.

## 7. Scope and deliberate omissions

- **In scope:** the entire current `GBEAutosCMSAdmin` packet, the change from
  `e473521` to current HEAD, current uncommitted state, and reconciliation of the
  supplied roadmap's Admin/CMS findings and first work packages.
- **Out of scope:** implementing fixes; editing files; committing/pushing; live
  production access; destructive or mutating database commands; a fresh visual-design
  critique; detailed Storefront validation without its repository.
- **Deliberately not done (do not flag as gaps):**
  - Full Storefront re-audit — `GBECMS` is not supplied in this packet.
  - Live Supabase/SMTP/OpenRouter/CarsXE/RapidAPI verification — no production or
    staging credentials are authorized for this read-only consultation.
  - Reusing historical `GPT_5_5_PRO_*`, `REVIEW_TO_GPT_5_5_PRO_*`, the unrelated root
    `CONSULT.md`, `.oracle/`, or earlier `.fable-5/` outputs as current proof — they may
    be read only as explicitly labeled historical context and never outrank live code.
  - Product implementation or roadmap approval — consultation is advisory; blueprint,
    build-plan, approval, execution, and verification remain separate Fable gates.
