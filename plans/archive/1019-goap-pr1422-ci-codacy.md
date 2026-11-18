# GOAP-1019: Restore PR #1422 CI and Codacy gates

**Status:** COMPLETE

**ADR:** `plans/1019-adr-pwa-e2e-route-mocks.md`

**PR:** #1422

## Goal

Get every currently failing PR #1422 check green and bring Codacy's new-issue count to zero without suppressions.

## Diagnosis

- `Codacy Static Code Analysis` reports three high-severity Biome `useQwikValidLexicalScope` findings in `apps/tests/demo-preview.spec.ts`: two module-level arrow probes and one local arrow helper.
- `E2E Smoke Tests` fails in the PWA lane at `apps/tests/offline-reader.spec.ts:93`; the chapter iframe stays absent. The run logs show API requests falling through to Vite's unavailable `127.0.0.1:8787` proxy and EPUB fetch errors. The PR's `clients.claim()` makes the first page service-worker-controlled; Playwright documents that `page.route()` does not intercept service-worker-owned requests, while `browserContext.route()` does.
- Keep the production `clients.claim()` behavior: it is needed for first-visit control and offline reload. Update the PWA test mocks to route at the browser-context level.

## Work plan

| Task                                                                                                                                            | Priority | Dependency      | Complexity | Observable result                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| Replace Codacy-flagged probe arrows with named function declarations and remove the local arrow helper.                                         | P0       | None            | Low        | The three findings no longer exist in the changed test source; no lint suppression.                                         |
| Use `BrowserContext.route()` for the offline-reader suite's shared and PWA-specific network mocks; correct stale comments about worker control. | P0       | None            | Low        | The PWA offline-reload test renders its EPUB through the active service worker and passes the offline/reconnect assertions. |
| Record the Playwright routing constraint in the project learnings and add this GOAP/ADR record.                                                 | P1       | Diagnosis       | Low        | The next PWA test author can choose the correct routing API; the ADR index references this decision.                        |
| Run targeted verification, the repository quality gate, and post-push PR checks.                                                                | P0       | Both code fixes | Medium     | The targeted PWA test and local gate pass; Codacy reports zero new issues and all PR checks pass.                           |

The two code fixes are independent; all verification follows them. Do not weaken the service worker or skip PWA coverage.

## Acceptance criteria

- Codacy's three reported findings are fixed in code with no suppressions; its PR quality gate passes.
- The failing PWA offline-reload test passes, including cached chapter rendering while offline and persistence after reconnect.
- `./scripts/quality_gate.sh` completes successfully.
- The latest PR head has no failed CI checks.

## Verification evidence

- Targeted PWA suite: `PLAYWRIGHT_MODE=preview pnpm exec playwright test --project=pwa-chromium apps/tests/offline-reader.spec.ts` — 5 passed.
- `./scripts/quality_gate.sh` — passed with Node 22 and the CI-pinned `do-harness` v0.2.1.
- Codacy CLI on HEAD `e0cc3bc81ffb4b72bb639902c595de45f556bb3a`: analysis complete, `isUpToStandards: true`, `newIssues: 0`.
- `gh pr checks 1422` on the same head: 30 passed, 8 skipped by workflow conditions, 0 failed.
- No PR blockers remain. GitHub reported three Dependabot vulnerabilities on the default branch (two moderate, one low); they are unrelated to this PR's checks.
