# GOAP Plan 109: Fix PRs #632 & #633 Codacy Failures

**Date:** 2026-06-24
**Strategy:** Parallel swarm — both PRs are independent

---

## Primary Goal

Resolve all Codacy `ACTION_REQUIRED` violations to unblock merge for both PRs.

## PR #632 — `feat(reader): Add reading insights / statistics`

### Issues

| # | File | Line | Rule | Fix |
|---|------|------|------|-----|
| 1 | `apps/web/src/features/reader/hooks/useReadingTimer.ts` | 62 | `no-unnecessary-condition` | Remove `?? 0` — `activePages` is `number` not nullable |
| 2 | `packages/schema/migrations/0005-add-pages-to-insights.sql` | 1 | `set-quoted-identifier` | Add `SET QUOTED_IDENTIFIER ON;` header |

### Root Cause

1. `e.activePages` is typed as `number` in the DB schema (`db.ts:45`), so `?? 0` is redundant.
2. SQL migration file lacks the TSQLLint-required `SET QUOTED_IDENTIFIER ON` header.

## PR #633 — `perf(reader-core): optimize TOC processing in reanchorByText`

### Issues

| # | File | Line | Rule | Fix |
|---|------|------|------|-----|
| 1 | `packages/reader-core/src/reanchor.ts` | 84 | `useQwikValidLexicalScope` | False positive — Qwik rule on non-Qwik code. Suppress with inline eslint-disable |

### Root Cause

Codacy's Biome linter applies Qwik-specific rules to `reader-core` which is a plain TypeScript library, not a Qwik app. The `collect` arrow function is perfectly valid in this context.

## Execution Strategy

**Parallel** — Fix PR #632 and #633 independently, then merge each.

### Phase 1: Fix PR #632 (Agent: general)

1. Checkout `feat-reader-insights-*` branch
2. Remove `?? 0` from `useReadingTimer.ts:62`
3. Add `SET QUOTED_IDENTIFIER ON;` to `0005-add-pages-to-insights.sql`
4. Run lint + typecheck
5. Commit and push

### Phase 2: Fix PR #633 (Agent: general)

1. Checkout `perf-reanchor-toc-*` branch
2. Add `// eslint-disable-next-line` for false-positive Qwik rule in `reanchor.ts:84`
3. Run lint + typecheck
4. Commit and push

### Phase 3: Verify & Merge

1. Verify Codacy passes for both PRs
2. Merge both PRs

## Quality Gates

- [ ] Local lint passes for both
- [ ] Typecheck passes for both
- [ ] Codacy `isUpToStandards` becomes `true` for both

## Success Criteria

```
✓ Completed: Fix 3 Codacy issues across 2 PRs
📦 Deliverables: 3 files modified
⚠️ Blocked: None
✅ Quality: All CI checks green including Codacy
```
