# GOAP 129 — CI Failure Resolution & Release Preparation (2026-07-12)

**Date:** 2026-07-12
**Status:** 🔄 ACTIVE
**Author:** MiMoCode analysis session
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Extends:** Plan 128 (session summary), Plan 121 (P3 backlog consolidation)
**ADR:** `plans/129-adr-ci-release-readiness-policy.md`

---

## Goal

Resolve GitHub Issue #771 (34 failing E2E tests on main), prepare the 0.1.2
release from 18+ unreleased CHANGELOG entries, update P3 backlog status, and
clean up Proposed ADRs.

---

## Analyze — Current State

### Issue #771: Scheduled Cross-Browser E2E Failures (run 29181330824)

34 failing tests across 3 root causes:

| # | Root Cause | Scope | Severity |
|---|-----------|-------|----------|
| **RC1** | Sync queue flush race condition — bookmarks not incrementing after reconnection | `offline-reader.spec.ts:212` | P0 — blocks release |
| **RC2** | Mobile viewport visibility failures — 3 pixel tests failing `toBeVisible()` | Mobile E2E suite | P1 — flaky |
| **RC3** | Workbox SW crash — `Cannot read properties of undefined (reading 'waiting')` | Workbox bundle | P0 — blocks release |

### Root Cause Analysis

**RC1 (Sync race):** PR #757 consolidated bookmark sync into the annotation queue
path. The E2E test at line 212 disconnects, creates a bookmark, reconnects, and
expects the bookmark count to increment. The race is between the sync queue flush
and the UI re-render. The fix likely needs either:
- A `waitFor` on the sync queue flush completion signal before asserting count
- An explicit `syncQueue.flush()` call in the test setup
- A server-side confirmation event that the client awaits

**RC2 (Mobile visibility):** 3 pixel tests use `toBeVisible()` on elements that
may be below the fold or clipped by mobile viewport overflow. Likely need
`scrollIntoViewIfNeeded()` or viewport-specific selectors.

**RC3 (Workbox crash):** The `waiting` property access on undefined suggests a
service worker lifecycle race — `self.registration` or `navigator.serviceWorker`
is undefined when the workbox precaching code runs. May need a guard or a
workbox config update.

### Backlog State

| Item | Status | Notes |
|------|--------|-------|
| A6 | ✅ RESOLVED | Per Plan 121 — IndexedDB restore in ReaderPage.tsx catch block |
| N3 | ⏳ OPEN | Server-side full-text search for large EPUBs |
| N6 | ⏳ OPEN | EPUB re-export / packager |
| N7 | ⏳ OPEN | Comment reply notifications |
| F3 | ⏳ OPEN | Cross-isolate cache invalidation via DO/KV |

### ADR State

| ADR | Status | Action Needed |
|-----|--------|---------------|
| 065 | Proposed | Accept — all open PRs/issues were resolved in Plans 114–128 |
| 074 | Proposed | Accept — E2E resilience improvements shipped in PR #756 |
| 115 | Proposed | Accept — verified-audit policy followed in Plans 116–128 |

### CHANGELOG

18+ unreleased entries since 0.1.1 (2026-06-14). Includes features (search,
admin dashboard, My Library, settings), security fixes (IDOR, CSP hardening,
tenant isolation), and infrastructure (sync consolidation, coverage improvements).

---

## Decompose — Tasks

### T1: Fix Sync Queue Flush Race (RC1) — P0
- **Branch:** `fix/sync-queue-flush-race`
- **Scope:** `offline-reader.spec.ts`, possibly sync queue module
- **Approach:** Add explicit flush/await in E2E test; if race is in production
  code, add a `syncComplete` event or promise gate
- **Tests:** Fix the specific failing assertion at line 212; add regression test
- **Deps:** None
- **Agent:** `testing-strategy` + `pwa-offline-sync`

### T2: Fix Mobile Viewport Visibility (RC2) — P1
- **Branch:** `fix/mobile-viewport-e2e-visibility`
- **Scope:** 3 failing pixel tests in mobile E2E suite
- **Approach:** Add `scrollIntoViewIfNeeded()` or use `getByRole` with
  viewport-aware selectors
- **Deps:** None
- **Agent:** `testing-strategy`

### T3: Fix Workbox SW Crash (RC3) — P0
- **Branch:** `fix/workbox-sw-waiting-crash`
- **Scope:** Workbox config or SW lifecycle code
- **Approach:** Guard `self.registration` access; check workbox version
  compatibility; add null check before `.waiting` access
- **Deps:** None
- **Agent:** `pwa-offline-sync`

### T4: Update P3 Backlog — P2
- **Branch:** `docs/p3-backlog-update-129`
- **Scope:** Plan 121, Plan 128 remaining items table
- **Approach:** Strike A6 (resolved), confirm N3/N6/N7/F3 status, add M6
- **Deps:** None
- **Agent:** None (doc update)

### T5: Accept Proposed ADRs — P2
- **Branch:** `docs/accept-proposed-adrs`
- **Scope:** ADR-065, ADR-074, ADR-115, ADR-INDEX.md
- **Approach:** Update status to Accepted in each ADR file; update ADR-INDEX
- **Deps:** None
- **Agent:** None (doc update)

### T6: Skills & Harness Check — P3
- **Branch:** `chore/skills-harness-audit`
- **Scope:** `.agents/skills/`, `.claude/skills/`
- **Approach:** Verify all 40 skills are tracked in git; check pr-review-fix
  tracking status; validate SKILL.md structure
- **Deps:** None
- **Agent:** None

### T7: Prepare 0.1.2 Release — P1
- **Branch:** `release/0.1.2`
- **Scope:** CHANGELOG.md, package.json versions
- **Approach:** Use `release-management` skill to cut release
- **Deps:** T1, T2, T3 (CI must be green on main)
- **Agent:** `release-management`

---

## Strategize — Execution Strategy

**Hybrid: Parallel (T1–T6) → Sequential (T7)**

```
Phase 1 (Parallel) — Fix CI + Documentation
├── T1: Sync race fix ──────────────┐
├── T2: Mobile viewport fix ────────┤
├── T3: Workbox crash fix ──────────┤──→ All must pass before T7
├── T4: P3 backlog update ──────────┤
├── T5: Accept ADRs ────────────────┤
└── T6: Skills audit ───────────────┘

Phase 2 (Sequential) — Release
└── T7: Cut 0.1.2 release (after T1+T2+T3 merged, CI green)
```

### Quality Gates

| Gate | Criteria | When |
|------|----------|------|
| QG1 | `./scripts/quality_gate.sh` passes | After each of T1–T3 |
| QG2 | `gh pr checks` all green | After each PR merge |
| QG3 | All 34 E2E tests pass (run count: 0 failures) | After T1+T2+T3 merged |
| QG4 | CHANGELOG clean, versions bumped | Before T7 |

---

## Coordinate — Agent Assignments

| Task | Primary Agent | Support Agent | Strategy |
|------|--------------|---------------|----------|
| T1 | `testing-strategy` | `pwa-offline-sync` | Sequential (diagnose → fix → verify) |
| T2 | `testing-strategy` | — | Sequential |
| T3 | `pwa-offline-sync` | — | Sequential |
| T4 | — (manual doc) | — | Direct edit |
| T5 | — (manual doc) | — | Direct edit |
| T6 | — (manual audit) | — | Direct edit |
| T7 | `release-management` | — | Skill-driven |

---

## Execute — Detailed Steps

### Phase 1a: CI Fixes (T1, T2, T3 — Parallel)

#### T1: Sync Queue Flush Race

```bash
# 1. Reproduce locally
pnpm test:e2e --grep "offline-reader" --project=chromium

# 2. Diagnose — inspect sync queue flush timing
# Check: apps/web/src/stores/sync-queue.ts (or equivalent)
# Check: apps/web/src/lib/offline-reader.spec.ts:212

# 3. Fix options (in order of preference):
#    a. Add waitFor sync-complete signal before assertion
#    b. Increase timeout for sync flush in CI
#    c. Mock sync flush completion in test

# 4. Verify
pnpm test:e2e --grep "offline-reader" --project=chromium
./scripts/quality_gate.sh
```

#### T2: Mobile Viewport Visibility

```bash
# 1. Reproduce
pnpm test:e2e --project="Mobile Chrome"

# 2. Fix — add scrollIntoViewIfNeeded() or use viewport-aware selectors

# 3. Verify
pnpm test:e2e --project="Mobile Chrome"
```

#### T3: Workbox SW Crash

```bash
# 1. Diagnose — check workbox config and SW lifecycle
# Check: apps/web/vite.config.ts (workbox plugin config)
# Check: apps/web/src/sw.ts or equivalent

# 2. Fix — add null guard before .waiting access

# 3. Verify
pnpm test:e2e --grep "service-worker|offline"
pnpm build  # verify SW builds correctly
```

### Phase 1b: Documentation (T4, T5, T6 — Parallel)

#### T4: P3 Backlog Update

- Strike A6 from Plan 121 remaining table (already resolved per Plan 121)
- Confirm N3, N6, N7, F3 remain open
- Add M6 (VirtualList variable-row-height) as tracked non-goal

#### T5: Accept Proposed ADRs

- ADR-065: Update `Status: Proposed` → `Status: Accepted (Plan 129)`
- ADR-074: Update `Status: Proposed` → `Status: Accepted (Plan 129)`
- ADR-115: Update `Status: Proposed` → `Status: Accepted (Plan 129)`
- Update `plans/ADR-INDEX.md`: move rows from "Cross-referenced" to "Accepted"

#### T6: Skills Audit

```bash
# List all skills
ls .agents/skills/ .claude/skills/

# Verify git tracking
git ls-files .agents/skills/ .claude/skills/ | wc -l

# Check pr-review-fix (reported as untracked local only)
git status .claude/skills/pr-review-fix/
```

### Phase 2: Release (T7 — After CI Green)

```bash
# Use release-management skill
# 1. Bump version in package.json files
# 2. Move [Unreleased] entries to [0.1.2] section
# 3. Create release branch + PR
# 4. After merge, tag and create GitHub Release
```

---

## Synthesize — Success Criteria

| Criteria | Verification |
|----------|-------------|
| Issue #771 resolved | 0 E2E failures in scheduled run |
| All CI green on main | `gh pr checks` shows all pass |
| 0.1.2 released | Git tag `v0.1.2` exists, CHANGELOG updated |
| P3 backlog current | Plan 121 table reflects reality |
| Proposed ADRs resolved | ADR-INDEX shows 0 Proposed entries |
| Skills tracked | All 40 skills in git |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Sync race is deeper than test timing | Medium | High | May need production sync queue fix; escalate to T1.1 subtask |
| Workbox crash is upstream bug | Low | High | Pin workbox version or add polyfill guard |
| Release blocked by Codacy | Low | Medium | Pre-check with `codacy pull-request` before merge |

---

## Monitor

- E2E scheduled run: next trigger after fixes merged
- `pnpm test:coverage` thresholds met (web 55%, worker 55%, shared 40%)
- Bundle budgets: reader 1.15MB, catalog 860KB, admin 860KB
- Lighthouse mobile: catalog, admin, auth, offline routes within budget

---

## Corrections (per ADR-115)

| ID | Prior Claim | Verified Reality |
|----|------------|------------------|
| A6 | "OPEN — offline reader fallback annotation restore" | ✅ RESOLVED — `ReaderPage.tsx` catch block restores highlights, comments, bookmarks from IndexedDB (Plan 121 evidence) |
| M3 | "OPEN — redundant sync queue paths" | ✅ RESOLVED — PR #757 consolidated bookmark sync into annotation queue |
