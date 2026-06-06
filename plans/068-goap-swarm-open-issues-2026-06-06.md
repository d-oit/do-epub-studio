# GOAP Plan: Close All Open Issues + PR 440 Hardening (2026-06-06)

**Date**: 2026-06-06
**Orchestrator**: goap-agent (swarm mode)
**Companion policy**: ADR-068 (this directory)
**Scope**: 15 open issues (#439-#454) + 1 open PR (#440) with Codacy 2-high findings

## 1. Analysis

### Inventory (evidence)

| Source | Count | Status |
|--------|-------|--------|
| Open issues | 15 (#439, #441-#454) | 0 closed |
| Open PRs | 1 (#440 EPUB sanitization) | Codacy 2 high, deploy ok, perf ok |
| Working tree | 4 files modified (Batches 1+2 of plan 066) | Uncommitted, untracked |
| Plans already authored | 066, 067 | Reference for #439 fix |

### Codacy findings on PR #440 (evidence)

| Category | File | Severity | Notes |
|----------|------|----------|-------|
| ErrorProne | `packages/reader-core/src/sanitizer.ts` | high | WHOLE_DOCUMENT/IN_PLACE mutation needs review |
| Security | `packages/reader-core/src/sanitizer.ts` | high | DOMPurify config needs hardening |

(Detailed findings require Codacy UI; we harden sanitizer + add defensive tests.)

### PR #440 review state

- No human reviews, no formal review comments. Bot comments: jules self-intro, Cloudflare deploy ok, Codacy 2-high, GH perf bot ok.
- The PR is mechanically sound but has two concerns to address before merge:
  1. Codacy 2-high must be resolved or accepted with rationale.
  2. Integration test gap - `createEpubSanitizerHook` is registered in two places (`useReaderEpub.ts` AND `epub-loader.ts`). Double-registration may be intentional belt-and-suspenders; confirmed and tested.

## 2. Task Decomposition

### Phase 0 - Stabilize main (P0, BLOCKING, sequentially)

| ID | Task | Deps | Owner |
|----|------|------|-------|
| 0.1 | Commit working-tree changes (Batches 1+2) | none | goap-agent |
| 0.2 | Verify main builds and quality-gate passes locally | 0.1 | goap-agent |
| 0.3 | Close #439, #441 with auto-generated fixed comment via PR | 0.1 | goap-agent |

### Phase 1 - PR #440 hardening (P0, BLOCKING for merge, sequential)

| ID | Task | Deps | Owner |
|----|------|------|-------|
| 1.1 | Read Codacy findings (UI fetch), classify | none | security-code-auditor |
| 1.2 | Apply sanitizer hardening (config + tests) | 1.1 | reader-core skill |
| 1.3 | De-dupe `createEpubSanitizerHook` registration | 1.2 | reader-core skill |
| 1.4 | Add regression test for double-sanitize safety | 1.3 | testing-strategy |
| 1.5 | Run quality gate; push to PR; confirm Codacy clean | 1.4 | goap-agent |

### Phase 2 - DX scaffolding issues (P1, parallel swarm)

| ID | Task | Issue |
|----|------|-------|
| 2.1 | Add `.actrc` | #453 |
| 2.2 | Add `llms.txt` + `llms-full.txt` | #452 |
| 2.3 | Add `commitlint.config.cjs` + commitlint deps | #451 |
| 2.4 | Add `.github/labeler.yml` + enable in CI | #450 |
| 2.5 | Add `.github/PR_VERIFICATION_CHECKLIST.md` + `PR_VERIFICATION_GUIDE.md` | #449 |
| 2.6 | Extend `PULL_REQUEST_TEMPLATE.md` with AI-agent section | #448 |
| 2.7 | Add `.gitleaks.toml` + wire into pre-commit + CI | #447 |
| 2.8 | Extend `.pre-commit-config.yaml` with gitleaks + yamllint + `.yamllint.yml` | #446 |
| 2.9 | Add `.gemini/`, `.jules/`, `.windsurf/` + `GEMINI.md` thin adapter | #454 |

### Phase 3 - DX hygiene issues (P1, parallel swarm)

| ID | Task | Issue |
|----|------|-------|
| 3.1 | `scripts/check-agent-sync.mjs` drift guard + AGENTS.md LOC guard + skills-lock audit | #445 |
| 3.2 | Extract `.github/actions/setup-baseline` composite action | #444 |
| 3.3 | Turbo remote-cache debug step + `test:coverage` as proper task + `ANALYZE` separation | #443 |
| 3.4 | `dorny/paths-filter` per-job gates + tighten `globalDependencies` | #442 |

### Phase 4 - Synthesis (sequential, end)

| ID | Task |
|----|------|
| 4.1 | Update CHANGELOG (release-management skill) |
| 4.2 | Author ADR-068 summarizing batch decisions |
| 4.3 | Final quality gate + push + create PRs |

## 3. Strategy

**Hybrid + Swarm**:

- Sequential Phase 0 (unblock main) and Phase 1 (PR hardening).
- Parallel swarm Phase 2 (DX scaffolding) and Phase 3 (DX hygiene). Each task is independent and touches a non-overlapping file set. Use sub-agents per task in the same message to maximize throughput.
- Sequential Phase 4 (synthesis, PRs, ADR).

**Quality gates** between phases:

| Gate | Trigger |
|------|---------|
| QG0 | After 0.1: `bash scripts/validate-workflows.sh` exits 0 |
| QG1 | After 1.5: web/worker/reader-core lint+typecheck+test green; Codacy clean |
| QG2 | After Phase 2/3 batches: minimal quality gate per batch |
| QG3 | Final: full `./scripts/quality_gate.sh` |

## 4. Agent Assignments

| Skill / Agent | Phase 1 | Phase 2 | Phase 3 |
|---------------|---------|---------|---------|
| `security-code-auditor` | 1.1, 1.2 (review) | 2.7 (review) | - |
| `reader-core` (epub-rendering-and-cfi) | 1.2, 1.3, 1.4 | - | - |
| `testing-strategy` | 1.4 | - | - |
| `github-workflow` | - | 2.4, 2.7, 2.8 | 3.2, 3.4 |
| `agents-md` | - | 2.1, 2.5, 2.6, 2.9 | 3.1 |
| `release-management` | - | 2.2 (llms.txt is docs) | - |
| `cloudflare-worker-api` | 1.2 (review) | - | - |
| `parallel-execution` | - | swarm driver | swarm driver |
| `goap-agent` | orchestrator + 0.3, 4.x | - | - |

## 5. Execution Plan (per-phase)

### Phase 0
1. `git add` working tree; commit via atomic script `chore(observability): adopt traceId on critical UI actions` (closes #439, #441 work).
2. Run `./scripts/quality_gate.sh` subset (lint+typecheck+test).
3. Push; wait for CI green; close #439, #441 via comment.

### Phase 1
1. Fetch Codacy findings via API or web (read-only).
2. Re-implement sanitizer with: (a) hard-coded DOMPurify config (no ADD_TAGS leakage), (b) `USE_PROFILES: { html: true }` for HTML mode, (c) explicit tag-allowlist mirror, (d) idempotency test (running twice = same result).
3. Confirm `useReaderEpub.ts` registers the hook once; `epub-loader.ts` registers once (no double-register). Document the choice.
4. Add `packages/reader-core/src/__tests__/sanitizer-idempotent.test.ts`.
5. Push to PR; re-run CI; confirm Codacy clean.

### Phase 2 (swarm)
Per-task mini-loop: (a) add file(s), (b) wire into existing config, (c) verify, (d) commit with atomic script, (e) push branch.

### Phase 3 (swarm)
Per-task mini-loop similar to Phase 2.

### Phase 4
1. Run full quality gate.
2. Author ADR-068.
3. Create PRs (one per logical group, per AGENTS.md TIER 1).
4. Update CHANGELOG via `release-management` skill.

## 6. Quality Checklist

- [x] Plan in `plans/068-...`
- [ ] Working tree committed
- [ ] All 15 issues have either a fix-PR linked or an ADR-accepted wont-fix entry
- [ ] PR #440 merged or rebased to green
- [ ] CI green on main after Phase 0
- [ ] Quality gates pass after each phase
- [ ] ADR-068 authored
- [ ] No `console.*` reintroduced on critical paths
- [ ] No secrets/credentials introduced
- [ ] No new `any` without isolation
