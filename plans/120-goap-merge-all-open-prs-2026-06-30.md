# GOAP Plan 120: Merge All Open Dependabot PRs

**Created:** 2026-06-30
**Status:** ✅ COMPLETE
**Strategy:** Hybrid Sequential (Phase 1 on main, then parallel rebase + sequential merge)

---

## Final State: All PRs Merged or Recreated

| #   | Title                               | Status       | Notes                  |
| --- | ----------------------------------- | ------------ | ---------------------- |
| 692 | react-router-dom 7.17→7.18          | ✅ Merged    |                        |
| 691 | framer-motion 12.40→12.42           | ✅ Merged    |                        |
| 690 | js-yaml 4.2→5.2 (major)             | ✅ Merged    |                        |
| 689 | @commitlint/cli 19→21 (major)       | 🔄 Recreated | Recreate triggered     |
| 688 | @types/node 25→26                   | 🔄 Recreated | Recreate triggered     |
| 687 | eslint-plugin-unicorn 64→69 (major) | 🔄 Recreated | Recreate triggered     |
| 686 | production-deps group (2)           | 🔄 Recreated | Recreate triggered     |
| 685 | dev-deps group (22)                 | ✅ Merged    | With v8 coverage fix   |
| 683 | actions/checkout 6→7                | ✅ Merged    |                        |
| 682 | github-actions group (3)            | ✅ Merged    | After rebase onto main |

---

## Execution Record

### Phase 1: SHA Allowlist Fix (PR #694)

- Added 4 new SHAs to `scripts/validate-shas.sh`
- Merged to main

### Phase 2: Merge Green PRs (#690, #691, #692)

- All merged successfully via squash

### Phase 3: Fix #685 (dev-deps Group)

- Root cause: `@vitest/coverage-istanbul` → ESM/Babel issue on Node 24
- Fix: Switched all vitest configs from `provider: 'istanbul'` to `provider: 'v8'`
- Added `@vitest/coverage-v8` to worker package.json
- Merged successfully

### Phase 4: Merge #682 and #683

- **PR #683**: Merged directly (only auto-merge failed, non-required)
- **PR #682**: Rebased onto main (picked up SHA allowlist fix), all checks passed, merged

---

## Closed PRs (Need Recreation)

| #   | Title                               | Action                        |
| --- | ----------------------------------- | ----------------------------- |
| 689 | @commitlint/cli 19→21 (major)       | `@dependabot recreate` posted |
| 688 | @types/node 25→26                   | `@dependabot recreate` posted |
| 687 | eslint-plugin-unicorn 64→69 (major) | `@dependabot recreate` posted |
| 686 | production-deps group (2)           | `@dependabot recreate` posted |

These were closed by Dependabot bot before the SHA allowlist fix. Recreate comments posted on all 4 PRs. They will reappear either:

- After Dependabot processes the recreate requests
- On the next Dependabot schedule (Tuesday)

---

## Verification

```bash
# Verify all PRs merged
gh pr list --state open

# Verify main CI is green
gh run list --branch main --limit 1

# Verify no merge conflicts remain
git fetch origin main && git log --oneline origin/main -10
```

---

## Lessons Learned

1. **SHA allowlist is critical** — Dependabot bumps SHAs but pre-commit hooks validate against allowlist
2. **V8 coverage provider** — Istanbul has ESM/Babel issues on Node 24, V8 works reliably
3. **Non-required checks** — Auto-merge workflow fails on unsigned Dependabot commits after force-push, but is non-required
4. **Dependabot recreate** — Closed PRs need `@dependabot recreate` comments to trigger new PRs
