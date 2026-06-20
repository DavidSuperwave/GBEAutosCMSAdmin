# Deferred Admin Surfaces

This file records custom admin surfaces that still have source code or styles but are intentionally not part of the active Payload admin navigation.

## Standalone Media Workspace

- **Route**: `/admin/media-workspace`
- **Status**: deferred / hidden
- **Reason**: vehicle image operations now live inside the vehicle workspace Images tab. Keeping one active AI/image workflow reduces styling-system drift while the admin kit is being standardized.
- **Re-enable checklist**:
  - Register the view in `src/payload.config.ts`.
  - Add an intentional navigation entry.
  - Decide whether the screen is a normal `admin-kit` surface or part of the scoped AI studio.
  - Add it back to `docs/production-e2e-test-plan.md` and the Admin Visual QA Gate.
  - Move or restore `.media-workspace__*` styles only under the chosen surface owner.
