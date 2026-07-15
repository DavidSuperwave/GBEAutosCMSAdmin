# F018 reproducible source baseline

## Purpose and scope

This record pins the clean Admin and Storefront sources used by F018 before the
Node 22 baseline CI slice and before the role migration. It covers only F018
layer L001: source identity, prior-change disposition, local launch mapping, and
evidence boundaries. It does not close all of F018; the local quality harness,
CI workflow, and archived remote CI proof belong to later approved layers.

- Capture time: `2026-07-10T15:52:52Z` (UTC).
- Evidence basis: local Git refs and working trees, tracked package files,
  `.claude/launch.json`, the approved F018 plan, and the recorded pre-layer
  proof history supplied to L001.
- Repository state before this document was created: both repositories clean.

## Admin baseline

| Fact | Pinned value | Evidence command |
| --- | --- | --- |
| Canonical remote | `https://github.com/DavidSuperwave/GBEAutosCMSAdmin.git` (`origin`) | `git remote -v` |
| Branch | `codex/admin-workflow-updates` | `git branch --show-current` |
| Admin SHA | `d4a2590b21998c7f91bed5a32d74b4e4885e40ba` | `git rev-parse HEAD` |
| Remote-containing ref | `origin/codex/admin-workflow-updates` | `git branch -r --contains "$(git rev-parse HEAD)"` |
| `package-lock.json` SHA-256 | `49ddbd5471288327800d0d16715f01ad006bac8e422abb9e6f06a5e335b73963` | `(Get-FileHash -Algorithm SHA256 -LiteralPath "package-lock.json").Hash.ToLowerInvariant()` |
| Node / npm | `v22.22.2` / `11.8.0` | `node --version`; `npm.cmd --version` |
| Clean status before document diff | Clean; no tracked or untracked output | `git status --porcelain=v1 --untracked-files=all` |

The remote-containing-ref check proves that the pinned object is represented
by the locally available canonical remote-tracking ref. L001 did not fetch or
contact the remote.

## Storefront baseline

The sibling checkout is `../GBE Autos`. Git ownership protection in the
sandbox required a per-command `safe.directory` override for inspection; this
did not change Git configuration or repository state.

| Fact | Pinned value | Evidence command |
| --- | --- | --- |
| Canonical remote | `https://github.com/DavidSuperwave/GBEautos.git` (`gbe`) | `git -c safe.directory="C:/Users/Kecin/Desktop/GBE Autos" -C "../GBE Autos" remote -v` |
| Branch | `codex/ultra-f018-storefront-baseline` | `git -c safe.directory="C:/Users/Kecin/Desktop/GBE Autos" -C "../GBE Autos" branch --show-current` |
| Storefront SHA | `d0e8fd019aefba8ef3a760e93bd09ca67a3d72ae` | `git -c safe.directory="C:/Users/Kecin/Desktop/GBE Autos" -C "../GBE Autos" rev-parse HEAD` |
| Remote-containing ref | `gbe/codex/ultra-f018-storefront-baseline` | `git -c safe.directory="C:/Users/Kecin/Desktop/GBE Autos" -C "../GBE Autos" branch -r --contains "d0e8fd019aefba8ef3a760e93bd09ca67a3d72ae"` |
| `package-lock.json` SHA-256 | `fcc815de313e47200ca128ed28697c2dedd4d92a6579a8d129b056153b83ab45` | `(Get-FileHash -Algorithm SHA256 -LiteralPath "../GBE Autos/package-lock.json").Hash.ToLowerInvariant()` |
| Node / npm | `v22.22.2` / `11.8.0` | `node --version`; `npm.cmd --version` |
| Clean status before document diff | Clean; no tracked or untracked output | `git -c safe.directory="C:/Users/Kecin/Desktop/GBE Autos" -C "../GBE Autos" status --porcelain=v1 --untracked-files=all` |

The remote-containing-ref check has the same local-ref meaning as the Admin
check; no network access was performed by L001.

## Prior dirty-item disposition ledger

| Repository | Previously dirty item | Disposition and evidence |
| --- | --- | --- |
| Admin | `.claude/launch.json` | Preserved in `98eda3b198071fd519a85dd574b9e9d81e6c159c` (`Preserve current admin UI and preview updates`). |
| Admin | `src/app/(frontend)/vehicle-preview/[id]/page.tsx` | Preserved in `98eda3b198071fd519a85dd574b9e9d81e6c159c`. |
| Admin | `src/app/(payload)/custom.scss` | Preserved in `98eda3b198071fd519a85dd574b9e9d81e6c159c`. |
| Admin | `src/components/PrismaCMSLogo.tsx` | Preserved in `98eda3b198071fd519a85dd574b9e9d81e6c159c`. |
| Admin | `src/utils/formatMileage.ts` | Added and preserved in `98eda3b198071fd519a85dd574b9e9d81e6c159c`. |
| Admin | Product input, review, and roadmap documents under `docs/product/` | Preserved in `d4a2590b21998c7f91bed5a32d74b4e4885e40ba` (`Archive product audits and Fable roadmaps`). |
| Admin | Local orchestration/runtime organization | `.gitignore` changes were preserved in `d4a2590b21998c7f91bed5a32d74b4e4885e40ba`; `.fable-5/`, `.oracle/`, and generated roadmap `RUN_PATH.txt` pointers are intentionally ignored and are not part of the pinned Git tree, while durable audits and roadmaps are committed under `docs/product/`. |
| Admin | One-off `run_pro_review*.sh` launchers | Preserved locally under `.oracle/legacy-review-runners/`; these ignored runtime artifacts are not part of the pinned Git tree. |
| Admin | Earlier `scripts/sanity-format-mileage.mjs` candidate | Preserved locally at `.oracle/manual-checks/sanity-format-mileage.mjs`; this ignored `.oracle/` runtime artifact is not part of the pinned Git tree. |
| Storefront | `lib/cms.ts` strict-mode work | Preserved in `d0e8fd019aefba8ef3a760e93bd09ca67a3d72ae` (`Preserve Storefront CMS strict mode baseline`); that commit changes only `lib/cms.ts`. |
| Storefront | Generated `next-env.d.ts` development-path change | Normalized before `d0e8fd0`; `git show d0e8fd0 -- next-env.d.ts` is empty, so it is not part of the pinned baseline diff. |

## Launch and environment mapping

### Confirmed local launch mapping

| Surface | Command source | Port | Status |
| --- | --- | --- | --- |
| Admin development | `.claude/launch.json` and Admin `package.json` (`npm run dev`) | `3001` | Confirmed local mapping |
| Admin preview development | `.claude/launch.json` (`npx next dev -p 3777`) | `3777` | Confirmed local mapping |
| Storefront development | `.claude/launch.json` (`npm --prefix "../GBE Autos" run dev`) | `3000` | Confirmed local mapping |

### Environment and deployment ownership

| Environment or binding | Evidence-backed mapping | Ownership / later work |
| --- | --- | --- |
| Local Admin | This repository, ports `3001` and `3777` as above | Local developer/operator |
| Local Storefront | Sibling `../GBE Autos`, port `3000` | Local developer/operator |
| F018 CI environment | Not created by L001 | Later F018 layers L002-L004 own the quality harness, workflow, and remote proof. |
| Staging database and Storage | **Unknown — not evidenced in F018**; not provisioned by F018 | F019 owns provisioning and sanitized seeding. |
| Staging backup/restore | **Unknown — not evidenced in F018**; not provisioned or exercised by F018 | F019 owns backup/restore proof. |
| Staging migration rehearsal | **Unknown — not evidenced in F018**; not provisioned or exercised by F018 | F019 owns rehearsal, abort thresholds, rollback triggers, and evidence paths. |
| Production Admin deployment binding and owner | **Unknown — not evidenced in F018** | Later release ownership/evidence is associated with F017 where applicable. |
| Production Storefront deployment binding and owner | **Unknown — not evidenced in F018** | F017 owns the later pinned-SHA cross-repository release gate. |
| Production database/Storage binding and deployment owner | **Unknown — not evidenced in F018** | F009 covers the canonical Storage adapter; production release proof is outside L001. |

## Proof history and boundaries

### Recorded before L001

These results are historical evidence supplied to this layer, not commands
rerun by L001:

| Repository | Recorded command/check | Recorded result | Qualification |
| --- | --- | --- | --- |
| Storefront | `npm.cmd run lint` | Passed before `d0e8fd0` was pushed | Local pre-layer proof at the pinned source. |
| Storefront | `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false` | Passed before the branch was pushed | Standalone typecheck; Storefront has no package typecheck script. |
| Storefront | `npm.cmd run build` | Passed before the branch was pushed | Compilation/fallback evidence only; it is not Storefront contract verification. |
| Admin | `node scripts/check-admin-styles.mjs` | Passed during F018 planning | Local observation, not clean-CI evidence. |
| Admin | `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false` | Passed during F018 planning | Local observation with pre-existing dependencies; not clean-CI evidence. |
| Admin | `npm.cmd run lint` | Passed with four existing warnings during F018 planning | Local observation; warnings were not expanded into L001 scope. |
| Admin | Clean install and production build | Not run as an L001 or recorded planning proof | These remain later F018 quality/CI work; no passing claim is made here. |

### L001 proof commands

L001 runs only the seven commands bound in `BASELINE.json`, after writing this
record:

```bash
test -z "$(git status --porcelain=v1 --untracked-files=all -- . ':(exclude)docs/product/baselines/F018_REPRODUCIBLE_BASELINE.md')"
test -n "$(git branch -r --contains "$(git rev-parse HEAD)")"
test -z "$(git -C '../GBE Autos' status --porcelain=v1 --untracked-files=all)"
test -n "$(git -C '../GBE Autos' branch -r --contains "$(git -C '../GBE Autos' rev-parse HEAD)")"
test -s docs/product/baselines/F018_REPRODUCIBLE_BASELINE.md
rg -q 'Admin.*SHA|Admin SHA' docs/product/baselines/F018_REPRODUCIBLE_BASELINE.md && rg -q 'Storefront.*SHA|Storefront SHA' docs/product/baselines/F018_REPRODUCIBLE_BASELINE.md && rg -q 'SHA-256' docs/product/baselines/F018_REPRODUCIBLE_BASELINE.md
git diff --check
```

These prove the allowed-path boundary, local remote-ref containment, sibling
cleanliness, document presence/content, and patch hygiene. They do not prove a
fresh remote fetch, clean dependency installation, application compilation,
deployment, service behavior, or production readiness.

## Reproduction commands for future operators

Run from the Admin repository root in PowerShell. These commands are read-only
and use quoted sibling paths:

```powershell
# Runtime
node --version
npm.cmd --version

# Admin identity, cleanliness, reachability in fetched refs, and lock hash
git remote -v
git branch --show-current
git rev-parse HEAD
git status --porcelain=v1 --untracked-files=all
git branch -r --contains "$(git rev-parse HEAD)"
(Get-FileHash -Algorithm SHA256 -LiteralPath "package-lock.json").Hash.ToLowerInvariant()
git show --format=fuller --name-status 98eda3b
git show --format=fuller --name-status d4a2590

# Storefront identity, cleanliness, reachability in fetched refs, and lock hash
git -C "../GBE Autos" remote -v
git -C "../GBE Autos" branch --show-current
git -C "../GBE Autos" rev-parse HEAD
git -C "../GBE Autos" status --porcelain=v1 --untracked-files=all
git -C "../GBE Autos" branch -r --contains "$(git -C "../GBE Autos" rev-parse HEAD)"
(Get-FileHash -Algorithm SHA256 -LiteralPath "../GBE Autos/package-lock.json").Hash.ToLowerInvariant()
git -C "../GBE Autos" show --format=fuller --name-status d0e8fd0
git -C "../GBE Autos" show d0e8fd0 -- next-env.d.ts
```

If Git rejects the sibling checkout solely because a sandbox identity differs
from the directory owner, add `-c safe.directory="C:/Users/Kecin/Desktop/GBE Autos"`
to each Storefront `git` invocation for that invocation only; do not mutate
global Git configuration.

To reproduce the recorded Storefront compilation checks without changing
source files (build output remains ignored), use the pinned checkout and its
existing locked installation:

```powershell
Push-Location "../GBE Autos"
npm.cmd run lint
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
npm.cmd run build
Pop-Location
```

These quality commands may write ignored generated output. A future clean-CI
operator must use the later F018 harness/workflow once those layers exist.

## Explicit limitations

L001 required and performed no F002 capture, live-database query, Supabase
access, deployment mutation, remote fetch/push, Storefront contract inventory
or verification, staging provisioning, backup/restore exercise, or migration
rehearsal. It makes no production-readiness claim. Storefront contract and
block-drift verification belongs to F020, while the final cross-repository
release gate belongs to F017.
