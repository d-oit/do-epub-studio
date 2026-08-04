# GOAP 216: Execute Plan 215 Non-Gated Waves

**Date:** 2026-08-04
**Status:** Proposed
**Goal:** Implement every non-gated recommendation of Plans 214/215
(Waves 1–3 minus the email gate) in one PR using a GOAP swarm.
**Related:** Plan 214, Plan 215, ADR-212, ADR-214, ADR-215

## 1. Analysis

A verification swarm (three parallel Explore agents) confirmed the
implementation state of every R/N ID on `main` (d0ed388):

| ID | State on main | Action this PR |
| --- | --- | --- |
| R2 trace header validation | Missing | Implement (T1.1) |
| R3 background log request context | Missing | Implement (T1.2) |
| N1 Codacy excludes app source | Missing (exclusions present, no documented gate) | Implement as documented advisory + authoritative lint gate (T1.3) |
| R5 budget model drift | Partial (raw vs gzip, stale routes, admin entry mismatch) | Implement (T1.4) |
| R6 `readFileSync` VERSION | Missing | Implement (T1.5) |
| R4 Vitest pool + mobile smoke | Partial (`threads` vs forks policy; mobile projects not in PR smoke) | Implement (T2.1) |
| R7 PWA E2E lane | Missing (`serviceWorkers: 'block'` global) | Implement (T2.2) |
| R8+N4 i18n formatting/lazy locales | Partial (dates only; static bundle; no NumberFormat) | Implement (T2.3) |
| R9 viewport regression matrix | Missing (one ad-hoc 4-width login test) | Implement (T2.4) |
| N2+R11 integration layer/oversized tests | Partial (36 worker handler tests exist; 5 test files >500 lines) | Implement (T2.5) |
| R10 insights claims | PRODUCT.md overclaims chapter time/reading speed | Align docs wording (T3.3) |
| N5 docs drift | Stale RTL claim; no retention runbook | Implement (T3.4) |
| N8 accepted-risk docs | Already satisfied (`docs/security-posture.md` §34–71) | Close with evidence |
| R1/R12/N3 email | Gated by T0.1 private triage (ADR-214 D4, ADR-215 D4) | Out of scope |
| N6/N7 | Unscheduled backlog per Plan 215 §3 | Out of scope |

## 2. Decomposition — Swarm Assignments

### Wave 1 (parallel, independent file sets)

| Task | IDs | Agent scope | Key files |
| --- | --- | --- | --- |
| W1-A | R2, R3 | Validate/bound inbound trace headers, mint server IDs on invalid input; add optional `RequestContext` to `logAppInfo/Warn/Error`; thread request-scoped callers | `apps/worker/src/lib/observability.ts`, middleware, telemetry route |
| W1-B | R6 | Static `VERSION` import in Vite config | `apps/web/vite.config.ts` |
| W1-C | R5 | One authoritative budget model; fix stale LHCI routes; fix admin manifest entry | `scripts/check-bundle-*.mjs`, `.performance-budgets.json`, `.lighthouserc.json`, `lighthouse.yml` |
| W1-D | N1 | Document Codacy advisory scope; declare type-aware `pnpm lint` the authoritative gate | `docs/static-analysis.md`, `.codacy.yml` |
| W1-E | R10, N5 | Align PRODUCT.md claims; fix RTL doc; add telemetry retention runbook | `PRODUCT.md`, `docs/accessibility.md`, `docs/observability-telemetry.md`, `docs/runbooks/` |
| W1-F | R11 | Split test files >500 lines (5 files, 3 agents) | `BooksPage.test.tsx`, `AnnotationToolbar.test.tsx`, `schemas.test.ts`, `offline-db.test.ts`, `reader-hooks.test.ts` |
| W1-G | N2 | Grow testkit builder tests | `packages/testkit/src/__tests__/` |

### Wave 2 (after Wave 1; internal dependency R4 → R7)

| Task | IDs | Agent scope | Key files |
| --- | --- | --- | --- |
| W2-A | R4 | Resolve Vitest pool policy (measure forks vs threads; switch or supersede via ADR-216); add mobile project to PR smoke | `apps/web/vitest.config.ts`, `.github/workflows/ci.yml` |
| W2-B (after W2-A) | R7 | `pwa-chromium` project with service workers allowed + CI lane | `playwright.config.ts`, PWA specs, `ci.yml` |
| W2-C | R8, N4 | `Intl.NumberFormat` helper, repeated-placeholder formatter, lazy per-locale loading | `apps/web/src/i18n/`, `lib/i18n-format.ts` |
| W2-D | R9 | Reusable viewport matrix harness (320–1440 + landscape, LTR/RTL) | `apps/tests/viewport-matrix.ts`, new responsive spec |

## 3. Execution Strategy

Hybrid swarm per ADR-212: Wave 1 parallel (7 streams / 9 agents on
disjoint file sets), Wave 2 mixed (W2-A → W2-B sequential chain, W2-C
and W2-D parallel). Orchestrator commits each logical change
separately; agents never commit. Quality gates between waves:
`pnpm lint` + `pnpm typecheck` per touched package, targeted unit
tests; final gate `./scripts/quality_gate.sh` before push.

## 4. Out of Scope (recorded, not deferred silently)

- **T0.1/R1 private email triage** — requires private security review
  (ADR-214 Decision 4); R12 and N3 remain gated behind it.
- **N6** (skeletons/shortcuts/Storybook), **N7** (OTel evaluation) —
  unscheduled backlog per Plan 215 §3.
- **LHCI auth fixture for protected reader/admin routes** (part of R5
  acceptance) — needs a seeded preview environment; tracked as the
  follow-up item in this plan's PR description.
- **Plan 215 §5 criterion "plan's own PR contains no source changes"** —
  superseded: Plans 214/215 ship in this execution PR together with the
  Wave 1–3 remediation they govern (single-PR delivery requested by the
  maintainer).

## 5. Acceptance Criteria

- [ ] All Wave 1/2 tasks above land with tests where behavior changed.
- [ ] No first-party test file exceeds 500 lines.
- [ ] `node scripts/check-adr-index.mjs` and markdownlint pass.
- [ ] `./scripts/quality_gate.sh` passes before push.
- [ ] One PR, atomic commits, PR template + AI verification section.
