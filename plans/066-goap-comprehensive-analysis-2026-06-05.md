# GOAP Plan: Comprehensive Codebase Analysis & Modernization

**Date**: 2026-06-05
**Orchestrator**: goap-agent
**Objective**: Analyze the codebase across implementation gaps, features, UI/UX, security,
logging, performance, deployment, and the AGENTS.md coding workflow; then execute the
high-value, evidence-backed changes. Companion policy: ADR-067.

## 1. Analysis

- **Primary Goal**: Identify and close real gaps (not speculative ones) and keep `main` green.
- **Constraints**: Quality gates (`./scripts/quality_gate.sh`), atomic commits, feature
  branch + PR, AGENTS.md TIER 1–3 rules.
- **Complexity**: Medium. The codebase is mature (prior plans 020–065) and largely clean.
- **Method**: Evidence-first survey. Every finding below is backed by a concrete observation,
  not assumption. Tooling note: `rg` is unavailable in this environment; `grep` was used.

### Baseline (evidence)

| Area | Observation |
|------|-------------|
| Stack currency | React 19, Vite 8, TS 6, Zod 4, Zustand 5, Tailwind 4, Vitest 4, Hono 4, Wrangler 4 — all current. |
| First-party TODO/FIXME | 0 (all matches were under `node_modules`). |
| Tests | 84 test files across apps/packages. |
| Worker observability | Structured JSON logging with traceId/spanId in `apps/worker/src/lib/observability.ts`. |
| Web observability | `apps/web/src/lib/client-logger.ts` exists, used in only ~5 sites. |
| Security | Argon2id, CSP middleware, signed URLs, rate-limit, security-headers all present. |
| Open issues | 1: #439 CI failure on `main`. Open PRs: 0. |

## 2. Findings & Decomposition

### Batch 1 — CI / Deployment (P0, BLOCKING) ✅ executed
- **#439**: `main` CI red. Root cause: `scripts/validate-workflows.sh` line 115 —
  `zizmor: Permission denied`. The pip/curl-installed launcher in `~/.local/bin`
  intermittently loses its exec bit, failing mid-run on one workflow file.
- **Action**: Guarantee exec bit on resolved `actionlint`/`zizmor` binaries before the
  validation loop (`chmod u+x "$(command -v …)"`).
- **Quality Gate**: `bash scripts/validate-workflows.sh` → exit 0 (verified locally).

### Batch 2 — Logging / Observability (P1) ✅ executed
- **Gap**: AGENTS.md TIER 1 requires "emit traceId on every critical UI action," but
  raw `console.warn/error` calls in `apps/web/src` critical paths bypassed `logClientEvent`
  and carried no traceId.
- **Action (done)**: Converted the critical-path failures to `logClientEvent` with a traceId:
  - `main.tsx`: service-worker registration + background-sync registration failures.
  - `ReaderPage.tsx`: annotations fetch failure, logout failure.
  - `useReaderEpub.ts`: EPUB init failure, progress load (API + cache), progress save.
- **Quality Gate (verified)**: web typecheck ✓, lint ✓, 264 unit tests ✓. The conversions
  reuse the already-tested `logClientEvent` contract (covered by api/sync/conflict tests), so
  no brittle epub.js/SW mocks were added — avoiding over-engineering per the pragmatism guard.

### Batch 3 — Security (P2, audit-only)
- No defects found in survey. Schedule a `security-code-auditor` pass on auth + signed-URL +
  EPUB-parsing paths to confirm; file follow-ups only if real issues surface.

### Batch 4 — Performance (P2, monitor)
- Reader virtualization, turbo input/output tuning, and route-aware bundle budgets already
  landed (plans 046/065). No new action; keep budgets enforced in CI.

### Batch 5 — UI/UX (P3, monitor)
- 2026 design system (OKLCH tokens, View Transitions, panel mutual-exclusivity) delivered in
  plans 031/032/063. No regression observed. No new action.

### Batch 6 — AGENTS.md Workflow (P3)
- Deprecation warning: `actions/upload-artifact@v4.6.2` is forced onto Node 24 (Node 20
  sunset). Non-blocking; Dependabot owns the bump. Track only.

## 3. Strategy

- **Hybrid**: Batch 1 executed immediately (unblocks `main`). Batch 2 next (small, testable).
  Batches 3–6 are audit/monitor — documented, not force-changed, to avoid over-engineering.

## 4. Agent Assignment

- goap-agent: orchestration + synthesis
- shell-script-quality: Batch 1
- reader-ui-ux / cloudflare-worker-api: Batch 2
- security-code-auditor: Batch 3 (read-only)

## 5. Execution Plan

1. ✅ ADR-067 (policy) authored.
2. ✅ Batch 1 — fix zizmor/actionlint exec-bit race; verify locally.
3. ✅ Batch 2 — client traceId adoption on critical UI actions.
4. ⏳ Batches 3–6 — scheduled audit/monitor; promote to action only on real findings.
5. Quality gate + atomic commits + PR.

## 6. Synthesis

- [x] CI blocker #439 root-caused and fixed (verified `exit 0`).
- [x] Comprehensive evidence-based gap map recorded.
- [x] Client-side traceId adoption (Batch 2) — typecheck/lint/264 tests green.
- [x] No speculative refactors introduced (pragmatism guard).
