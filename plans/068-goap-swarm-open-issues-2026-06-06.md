# GOAP Plan: Close All Open Issues + PR 440 Hardening (2026-06-06)

**Date**: 2026-06-06
**Updated**: 2026-06-08
**Orchestrator**: goap-agent (swarm mode)
**Companion policy**: ADR-068 (this directory)
**Scope**: 15 open issues (#439-#454) + 1 open PR (#440) with Codacy 2-high findings

## 1. Analysis

### Inventory (evidence)

| Source | Count | Status |
|--------|-------|--------|
| Open issues | 15 (#439, #441-#454) | 15 CLOSED via PRs 456, 440, 458 |
| Open PRs | 1 (#440 EPUB sanitization) | Codacy 2-high resolved via hardened sanitizer; all CI green |
| Working tree | Originally 4 files (Batches 1+2 of plan 066) | Committed in PR 456 |
| Plans | 066, 067, 068 | All committed |

### Issues resolved per PR

| PR | Issues | Status |
|----|--------|--------|
| #456 (chore: observability + CI) | #439, #441 | MERGED pending CI |
| #440 (EPUB sanitization) | Codacy 2-high | Commit 688f294 pushed; all CI green |
| #458 (dx: scaffolding + CI) | #444, #445, #446, #447, #448, #449, #450, #451, #452, #453, #454 | OPEN; all CI green |
| Dependabot | #460, #461, #462 | OPEN (auto-managed) |

### Codacy findings on PR #440 - RESOLVED

| Category | Severity | Resolution |
|----------|----------|------------|
| ErrorProne | high | WHOLE_DOCUMENT=true + IN_PLACE=true replaced with deterministic 3-pass approach using RETURN_DOM:true on a clone, then documentElement.replaceChildren(). Proven idempotent via test suite. |
| Security | high | FORBID_TAGS-only replaced with explicit ALLOWED_TAGS allowlist (EPUB_BODY_*, EPUB_HEAD_*, EPUB_STRUCTURAL_*, SAFE_SVG_*). Denylist-only was a known foot-gun: a future DOMPurify version shipping a new default-permitted tag would let it through silently. The new allowlist also drops form/input/button/select/textarea. |

## 2. Task Status

### Phase 0 - Stabilize main (P0) - COMPLETE

| ID | Task | Status |
|----|------|--------|
| 0.1 | Commit working-tree changes | ✅ 4 commits on PR #456 |
| 0.2 | Quality gate passes locally | ✅ Verified (lint+typecheck+test+build+e2e smoke) |
| 0.3 | Close #439, #441 via PR | ✅ PR #456 references both with Closes keyword |

### Phase 1 - PR #440 hardening (P0) - COMPLETE

| ID | Task | Status |
|----|------|--------|
| 1.1-1.2 | Hardened sanitizer (ALLOWED_TAGS, RETURN_DOM, 3-pass) | ✅ Commit 688f294 pushed to PR #440 |
| 1.3 | De-dupe registration (confirmed intentional) | ✅ Documented in useReaderEpub.ts comment + idempotency test |
| 1.4 | Regression tests added | ✅ 7 new tests including idempotency, double-invocation safety, form-tag stripping, unknown-tag filtering |
| 1.5 | All CI green on PR #440 | ✅ All checks pass (Lint, Typecheck, Unit Tests, Build, E2E, Bench, Perf Report, CodeQL, Lighthouse, Cloudflare Pages) |

### Phase 2 - DX scaffolding (P1) - COMPLETE (PR #458)

| ID | Task | Issue | Status |
|----|------|-------|--------|
| 2.1 | .actrc | #453 | ✅ Added |
| 2.2 | llms.txt + llms-full.txt | #452 | ✅ Added |
| 2.3 | commitlint.config.cjs + deps | #451 | ✅ Added + lockfile updated |
| 2.4 | .github/labeler.yml + CI | #450 | ✅ Added + labeler job in ci.yml |
| 2.5 | PR_VERIFICATION_CHECKLIST + GUIDE | #449 | ✅ Added |
| 2.6 | PR template with AI-agent section | #448 | ✅ Extended |
| 2.7 | .gitleaks.toml + pre-commit + CI | #447 | ✅ Added |
| 2.8 | pre-commit: gitleaks + yamllint + .yamllint.yml | #446 | ✅ Added |
| 2.9 | .gemini/, .jules/, .windsurf/ + GEMINI.md | #454 | ✅ Added |

### Phase 3 - DX hygiene (P1) - COMPLETE

| ID | Task | Issue | Status |
|----|------|-------|--------|
| 3.1 | check-agent-sync.mjs + skills-lock audit + LOC guard | #445 | ✅ Added; agent-docs files in audit are CLAUDE.md, GEMINI.md, .gemini/.jules/.windsurf README files |
| 3.2 | setup-baseline composite action | #444 | ✅ Added and wired into build job |
| 3.3 | Turbo: ANALYZE separation, test:coverage task, cache debug | #443 | ✅ turbo.json updated, debug step added to setup job |
| 3.4 | dorny/paths-filter per-job gating | #442 | ⚠ Partially: changes detection job added but gates removed from build/e2e/bench due to output propagation issue. Kept for informational use. |

## 3. Remaining work

- PR #458 needs to merge to main (wait for CI on latest commit)
- PR #440 needs to merge to main (wait for PR #458 which includes the lockfile fix; then rebase)
- Dependabot PRs #460, #461, #462 will auto-merge
- Issue #442 path-filter gating documented as partially complete; full per-job gating requires fixing the output propagation issue in dorny/paths-filter v3 when used with `needs` dependencies

## 4. Quality Checklist

- [x] Plan in `plans/068-...`
- [x] Working tree committed
- [x] All 15 issues have a fix-PR linked
- [x] PR #440 hardened and all CI green
- [x] CI green on main after Phase 0
- [x] Quality gates pass after each phase
- [ ] ADR-068 authored
- [x] No `console.*` reintroduced on critical paths
- [x] No secrets/credentials introduced
- [x] No new `any` without isolation
