# GOAP 222: Fix CI #938 + Owlwatch Security/Refactor Issues

**Date:** 2026-08-09
**Status:** ✅ COMPLETED
**Goal:** Fix the scheduled E2E CI failure on main (issue #938) caused by the
epub worker pipeline wiring in PR #936, and close all three Owlwatch issues
(#933 command injection, #934 long function, #935 hardcoded API key).
**Related:** Plan 221, ADR-218, ADR-212, Issues #933 #934 #935 #938

## 1. Analysis

### CI Failure (#938 — scheduled cross-browser E2E)

Run 31293129632 on commit eb3e064 (`perf(reader): wire epub loader, add bundle
baseline`) failed with two error classes:

| Error | Root Cause |
|-------|-----------|
| `sw.registration_failed` — `Cannot read properties of undefined (reading 'waiting')` | Workbox update handler reads `.waiting` on an undefined registration; guard needed |
| `epub-loader.error` — `Worker error: undefined` | `worker.onerror` fires with `event.message` undefined when worker load fails in E2E test environment; error propagation needed improvement |

### Owlwatch Issues

| Issue | File | Rule | Fix |
|-------|------|------|-----|
| #933 (high) | `.agents/skills/do-web-doc-resolver/scripts/providers_impl.py:248-250` | `ruff:S603` command injection | Validate URL scheme before subprocess; pass as list |
| #934 (medium) | `.agents/skills/do-web-doc-resolver/scripts/resolve.py:159-315` | `lizard:long-function` (157 lines, ccn=34) | Extract `_run_hedged_requests()` helper |
| #935 (low) | `.agents/skills/security-code-auditor/SKILL.md:80` | `gitleaks:generic-api-key` | Replace `sk-live-abc123` with `YOUR_API_KEY_HERE` |

## 2. Decomposition — Parallel Swarm

### Wave 1 (parallel, disjoint file sets)

| Task | Files | Agent |
|------|-------|-------|
| T1 | Fix CI #938: epub worker error + SW `.waiting` guard | Worker 1 |
| T2 | Fix Owlwatch #933+#934+#935: Python + SKILL.md | Worker 2 |

### Wave 2 (orchestrator, after Wave 1)

| Task | Files |
|------|-------|
| Update plan 221 acceptance criteria (`[x]` for A1–A3) | `plans/221-goap-remaining-audit-items.md` |
| Write this plan doc | `plans/222-goap-ci-fix-and-owlwatch.md` |
| LEARNINGS capture | `agents-docs/LEARNINGS.md` |
| Commit + PR | PR template + AI verification section |

## 3. Acceptance Criteria

- [x] `epub-loader.error` no longer fires in E2E; EPUB loads successfully
- [x] `sw.registration_failed` guard prevents the `.waiting` TypeError
- [x] Owlwatch #933 closed: URL validated before subprocess; ruff S603 clear
- [x] Owlwatch #934 closed: `resolve_url_stream` under 80 lines after extraction
- [x] Owlwatch #935 closed: no `sk-live-*` pattern in SKILL.md
- [x] Plan 221 status + criteria updated
- [x] `./scripts/quality_gate.sh` passes before push
- [x] CI green on PR
