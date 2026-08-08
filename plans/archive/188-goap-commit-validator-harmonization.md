# Plan 188: GOAP — Commit Validator Harmonization & Quality Gate Hardening

**Status:** ✅ COMPLETED
**Date:** 2026-07-15
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Extends:** Plan 186
**Strategy:** Swarm — independent fixes executed in parallel
**Completed:** 2026-07-15 (PR #797, commit 7e7e73c)

## Goal

Close the remaining W3 (commit vocabulary drift), W4 (quality gate skip handling), and
commit.sh arg-parsing edge case from Plan 186. All validators must agree on a single
source of truth for types and scopes, and the quality gate must never exit 0 when
required phases are skipped.

## Verified Already Resolved (Plan 186 items)

| ID | Status | Evidence |
|----|--------|----------|
| I1 | ✅ | `permissions.ts:109` enumerates cached permissions via `getAllCachedPermissions()` |
| W1 | ✅ | `run.sh:123-141` verifies remote SHA before force-push |
| C1 | ✅ | `validate-workflows.sh:177` fails on unknown SHAs |
| C2 | ✅ | `release.yml:24-108` verifies tag format, VERSION, main ancestry, CI checks |
| W2 | ✅ | `CONTRIBUTING.md:8` and `AGENTS.md` both show `--body` in invocation |

## Tasks

### T1: Shared commit types definition (P1 — W3)
- Create `scripts/lib/commit-types.sh` as single source of truth
- Update `commit.sh`, `hooks/commit-msg`, `validate-commit-message.sh` to source it
- Include `plans` in valid scopes

### T2: Commit validator parity tests (P1 — W3)
- Create `scripts/__tests__/commit-validator-parity.sh`
- Table-driven tests that all 3 validators accept/reject the same messages

### T3: Quality gate skip detection hardening (P1 — W4)
- Add per-phase skip tracking with explicit exit 3 documentation
- Ensure `validate.sh` treats exit 3 as failure (fail-closed)

### T4: commit.sh arg parsing fix (P1)
- Fix positional arg edge case where `--body` comes before `--message`
- Use proper flag parsing loop

### T5: auto-fix-shas.sh read-only guard (P1 — C1)
- Add prominent warning that this is a dev-only tool, not CI
- Add `--check-only` mode for CI validation

## Acceptance Criteria

- [x] All 3 commit validators accept the same set of types
- [x] All 3 commit validators accept the same set of scopes
- [x] Parity tests pass (28/28, 0 drift)
- [x] Quality gate exit 3 is treated as failure by `validate.sh`
- [x] `commit.sh` handles `--body "X" --message "Y"` order correctly
- [x] `./scripts/quality_gate.sh` passes
- [x] `pnpm lint && pnpm typecheck && pnpm build` all pass
