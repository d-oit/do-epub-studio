# GOAP-1012: Repair the CI evidence surfaced by PR #1377

**Status:** DONE — repairs and local runtime verification complete; final-head CI remains the PR merge prerequisite.
**Owner:** PR #1377 repair
**Related:** ADR-1012 (`plans/1012-adr-ci-evidence-prerequisites.md`)

## Observed problems

1. Run `39761528260`, Benchmark job `119772223237`, compared main's 8-character early-exit query against the repaired full chapter scan under the same benchmark name. The reported -99.99% is a workload change, not implementation regression evidence.
2. The CI Full Quality Gate reported that do-harness was missing and skipped compliance/DORA checks, although the separate harness-contract job installed the pinned tool.
3. Superseded run `39760340093` failed the offline annotation comment journey at the visible Comment dialog/textbox interaction (`offline-annotations.spec.ts:400-401`). The failure remains actionable; it must not be hidden by retries or a weakened assertion.

## Goal and actions

- Run the PR's corrected `reader-core.bench.ts` against both base and head implementation. Restore the base fixture before returning to the head checkout. Keep the comparison threshold and noise policy unchanged.
- Install do-harness v0.2.1 in the Full Quality Gate using the existing checksum-verified installation sequence from harness-contract.
- Diagnose the offline-comment failure from source and retained browser evidence; repair the actual cause and exercise the complete offline/reconnect scenario.
- Publish a final head only after local smoke and full quality gates, then require all applicable exact-head CI checks to finish successfully.

## Evidence

- Offline-comment diagnosis: retained trace starts the new Comment interaction about 150 ms after Yellow, before the awaited highlight persistence completes. `HighlightToolbarLayer.tsx:40-41` then calls `onClose`, clearing selection and dismissing the new dialog. Wait for the old toolbar to disappear before reselecting; no application behavior, timeout, or assertion was weakened.
  `PLAYWRIGHT_MODE=preview pnpm exec playwright test apps/tests/offline-annotations.spec.ts --project=pwa-chromium --workers=1 --retries=0` — 1/1 passed, including offline creation, encrypted storage, reload, chapter navigation, reconnect, and rejected writes.
- Full local baseline/head benchmarks with identical corrected fixtures: both completed; `compare-benchmarks.mjs` reported no significant regressions under the unchanged 30%/combined-rme policy.
- Complete PWA smoke lane (`--grep @pwa --project=pwa-chromium --workers=1 --retries=0`): 16/16 passed.
- Workflow validation: all 17 workflows passed.
- Final-head CI verification is enforced by the PR merge checks; local evidence does not replace it.
