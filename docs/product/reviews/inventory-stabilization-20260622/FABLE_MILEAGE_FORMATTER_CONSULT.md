# CONSULT — Fable 5 Codex work order

> Claude fills this before starting Codex. Codex starts with zero Claude session context, so be explicit. Keep this narrow enough that Codex can produce a reviewable diff.

## 1. Intent

**Intent:** `refactor`

## 2. Goal

```text
Extract the inline mileage-formatting logic in
src/app/(frontend)/vehicle-preview/[id]/page.tsx (line 168) into a small,
reusable, pure utility function so it can be unit-tested and reused
elsewhere. Preserve the exact current output for all inputs.
```

## 3. Repo and paths

- **Repo root:** `.`
- **Primary paths to inspect/change:**
  - `src/app/(frontend)/vehicle-preview/[id]/page.tsx`
  - `src/utils/formatMileage.ts` (new file)
- **Important related paths:**
  - `src/components/PriceFormatter.tsx` (existing example of a similar small formatting helper/component in this repo — match its style/conventions, e.g. file location under `src/utils` vs `src/components`, naming, and export style)
- **Do not touch:**
  - Anything under `src/collections/`, `src/migrations/`, `src/payload.config.ts`, or any file touching the database/Payload schema
  - `src/components/PrismaCMSLogo.tsx` and `src/app/(payload)/custom.scss` (unrelated in-flight work)

## 4. Frozen decisions / constraints

- Do not change the rendered output/behavior of the vehicle preview page. The exact current logic is:
  ```ts
  const mileage = numberValue(vehicle.mileage)
  // ...
  {mileage ? `${mileage.toLocaleString('es-MX')} km` : 'Por confirmar'}
  ```
- New function must be pure (no React, no DOM, no side effects) so it is trivially unit-testable.
- Function signature: `formatMileage(mileage: number | null | undefined): string`
- Keep the `es-MX` locale and `km` unit suffix and the `'Por confirmar'` fallback string exactly as-is.
- Do not add new npm dependencies.
- Do not touch git history, do not commit, do not push. Leave changes as uncommitted working-tree edits for Claude to review.

## 5. Non-goals

- Do not refactor `numberValue` or any other helper in that file beyond what's needed to wire up the new utility.
- Do not add a test runner/framework to the repo (none is currently configured — see section 8 for why).
- Do not touch any other formatting helper (e.g. `PriceFormatter.tsx`) beyond reading it for style reference.

## 6. Current evidence / repro

```bash
# Current inline usage, src/app/(frontend)/vehicle-preview/[id]/page.tsx:147-168
const mileage = numberValue(vehicle.mileage)
...
<dd>{mileage ? `${mileage.toLocaleString('es-MX')} km` : 'Por confirmar'}</dd>

# This repo has no unit test runner configured (checked package.json: only
# "lint" (eslint) and "build"/"dev" (next) scripts exist, no vitest/jest).
```

## 7. Expected implementation shape

- New file `src/utils/formatMileage.ts` exporting `formatMileage(mileage: number | null | undefined): string`.
- Update `src/app/(frontend)/vehicle-preview/[id]/page.tsx` to import and use it in place of the inline ternary, removing the now-redundant inline expression.
- Edge cases to preserve exactly:
  - `mileage` is `0` → currently falsy, so today's code renders `'Por confirmar'` for `0` too. Preserve this exact (if surprising) current behavior — do not "fix" it, this run is a pure extraction.
  - `null` / `undefined` → `'Por confirmar'`
  - Positive number → `` `${mileage.toLocaleString('es-MX')} km` ``

## 8. Proof command

```bash
npx tsc --noEmit
```

If that is too slow/broad, also acceptable as a supplementary check:

```bash
npm run lint -- src/utils/formatMileage.ts "src/app/(frontend)/vehicle-preview/[id]/page.tsx"
```

Since there is no test runner, also write a tiny standalone sanity script at `scripts/sanity-format-mileage.mjs` (or `.ts` run via `npx tsx`) that imports/re-implements a quick check of `formatMileage` against a handful of inputs (`0`, `null`, `undefined`, `12000`, `123456`) and prints PASS/FAIL — this is throwaway verification, not a permanent test suite, and should say so in a one-line comment.

## 9. Output contract

Codex final response must include:

1. Summary of what changed.
2. Files changed.
3. Commands/tests run and results (including the sanity script output).
4. Anything not completed and why.
5. Follow-up questions only if truly blocking.

## 10. Claude review notes

Claude will verify after Codex:

```bash
git status -sb
git diff
npx tsc --noEmit
node scripts/sanity-format-mileage.mjs
```
