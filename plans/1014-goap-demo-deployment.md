# GOAP-1014: Complete deployed demo setup

**Status:** IMPLEMENTED — required hosted CI remains the merge prerequisite
**ADR:** [ADR-1014](1014-adr-demo-deployment.md)

## Goal and boundaries

Implement the user's requested demo deployment fixes in a new PR. The reader and optional administrator demo must work against isolated preview D1/R2 resources. Production demo rejection remains enforced. This change authorizes code and a PR, not a live deployment or remote seed.

## Sequence and acceptance

- [x] Review demo UI, runtime gates, account seed and deployment configuration.
- [x] Resolve production-access and content-provisioning contradictions in `analysis/triz-core-2026-10-25.md`.
- [x] Frontend (low): include demo inputs in Turbo's build environment and make credential autofill select the demo book. Verify root-build configuration and login regressions.
- [x] Preview seed (medium): add an explicit, isolated remote D1/R2 provisioning command, real sample EPUB and deliberate admin enablement. Verify guard failures write nothing, reseeding, bound SQL and content linkage.
- [x] Runtime/configuration (medium): bind Pages R2, use the existing D1 rate limiter for demo routes, and keep production guards consistent with documentation. Verify demo route/configuration tests.
- [x] Integration (medium): run focused suites, full quality gate and a local real-stack chapter-reading journey. Record material environment limits and fix actionable failures.
- [x] Record scoped learnings, stage explicit paths and attempt the atomic commit workflow.
- [ ] Required hosted CI passes before merge. Publish for review using the connected GitHub integration because the atomic workflow refuses to commit while its online audit is unavailable.

Independent source/edit ownership: frontend reviewer owns web login UI/tests and Turbo input config; seed reviewer owns seed scripts/tests; coordinator owns Pages config, demo rate limiting, docs/plans and integration checks. Heavy tests run serially.

## Evidence and current limits

- Focused frontend login suites: 65 tests passed; web and Worker typechecks passed.
- Seed suites: 37 tests passed against actual schema migrations, including production-overlay aliases, mode selection, ownership refusal, explicit admin enablement and idempotent EPUB linkage.
- Focused runtime suites: demo credential/account gates, Pages origin mapping, D1 fallback rate limiting and cache isolation passed; the rate-limit client suite passed 7 tests.
- Root demo-enabled production build passed. Repository-root Pages Functions compiled with both WASM modules.
- Full workspace coverage passed, including 154 web files / 1,535 tests and 77 Worker files / 584 tests. All eight package lint tasks passed after correcting test-only type import annotations; script ESLint also passed. BATS, shellcheck, formatting, source LOC, plan references, compliance drift, bundle budgets and circular-dependency checks passed. Reader-core retains its existing opt-in skips (500 passed / 14 skipped).
- Disposable local D1/R2 preview provisioning completed; the dedicated real-Pages browser lane passed 3/3, including actual EPUB bytes on the preview origin, chapter navigation/reload, ordinary credential sign-in and admin demo entry. No remote resources were seeded or deployed.
- Installed Turbo documentation confirms Vite framework inference already includes `VITE_*`: explicit demo inputs clarify the contract and support builds with framework inference disabled; their previous omission alone was not a proven failure.
- Current workflow validation is unavailable: zizmor's online `known-vulnerable-actions` audit requires `api.github.com/advisories`, which this environment's network policy denies. GitHub CLI GraphQL is also denied; connected GitHub tools remain available. No sensor is disabled to claim a green gate. The PR must remain unmerged until required CI passes.
- The atomic workflow stopped in PRE_COMMIT after the full gate reported its unavailable online audit and the subsequently corrected lint annotation. It created no local commit or push. The gate's shared failure flag prevents its bundled smoke lane from starting in this situation; the real-Pages demo lane ran separately and passed.
- The separate default Chromium smoke lane passed 15 tests with 3 existing opt-in skips, confirming the normal browser project still runs after adding the dedicated demo-preview project.
