# Master Plan: Closeout Issue #222 / PR #239

**Date:** 2026-05-22
**Goal:** Resolve issue #222 (performance budgets) by fixing Codacy issues in PR #239 and merging.

## Dependency Graph

```
Sequential:
  1. [P0] Fix security/Codacy issues in PR #239 branch
  2. [P0] Push fixes, re-run CI
  3. [P1] Merge PR #239

No parallel groups (single PR, single issue).
```

## Task List

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 1 | Fix ReDoS in `check-bundle-size.mjs` regex | ✅ | P0 | Replaced regex with string-based matching (startsWith/endsWith) |
| 2 | Fix path traversal in `check-bundle-size.mjs` | ✅ | P0 | Added `distDir.startsWith(rootDir)` guard (restored after Jules reverted) |
| 3 | Fix CodeQL jq injection in `ci.yml` | ✅ | P0 | Piped `gh api` to `jq --arg` instead of string interpolation (restored after reversion) |
| 4 | Fix CI baseline build hardcoded repo/branch | ✅ | P1 | Used `${{ github.repository }}` and `${{ github.base_ref }}` instead of hardcoded values |
| 5 | Fix run-name injection in `ci.yml` | ✅ | P0 | Used `.pull_request.title` and `.head_commit.message` (kept from Jules' revision) |
| 6 | Re-add `.gitignore` metric entries | ✅ | P1 | Restored after Jules reverted |
| 7 | Remove `startup-metrics.json` from git | ✅ | P1 | Generated artifact should not be committed |
| 8 | Push fixes, run CI | ✅ | P0 | All CI checks passed (E2E, Benchmark, Performance Report) |
| 9 | Merge PR #239 | ✅ | P1 | Squash merged as `fd2abdb` |

## Final Results

| Issue | Branch | PR Link | Status | Notes |
|-------|--------|---------|--------|-------|
| #222 | observability-performance-budgets-... | #239 | ✅ | Merged via `fd2abdb`, branch deleted |
