# ADR-114: Comprehensive Audit Remediation Policy (2026-06-27)

**Status:** Accepted
**Date:** 2026-06-27
**Deciders:** Project maintainer
**Context:** Plan 114 comprehensive audit findings

---

## Context

Plan 113 (Phase 3 Polish) closed all 12 PRs from Plan 105's most critical
findings (B2-B7 security, C1 observability, D2-D4 logging, E3-E7 performance,
F1-F2 lint, G1-G2 build). The remaining gaps are:

- 1 TIER-1 security violation (B1: grant session revocation)
- Missing .gitignore patterns for dev artifacts
- UI responsive regressions in admin pages
- E2E test coverage below 50% of user flows
- Offline sync correctness issues (bookmarks/insights not queued)
- CI lacks Node version matrix testing

---

## Decision

### 1. Security-First Execution

Grant session revocation (B1) is a TIER-1 AGENTS.md violation and ships first,
independent of all other work. No other PR merges until B1 is resolved.

### 2. .gitignore as Defense-in-Depth

Add `.dev.vars`, `*.tsbuildinfo`, lint caches, and CI artifacts to .gitignore.
The `.dev.vars` pattern is critical — AGENTS.md explicitly states these are
"local only" secrets files. Missing this pattern risks accidental secret
commits.

### 3. Responsive-by-Default Admin Pages

Admin pages must use responsive padding (`p-4 sm:p-6 lg:p-8`) and
`overflow-x-auto` for tables. The `dvh` unit replaces `vh` for mobile
viewport calculations. These are per ADR-105 (container queries + modern CSS).

### 4. E2E Coverage Target

Each user-facing route must have at least one e2e smoke test:
- `/catalog` — browsing, search, filter
- `/admin/books` — CRUD operations
- `/admin/grants` — create, update, revoke
- `/admin/audit` — viewing, filtering
- `/read/:slug` — reading with annotations (real fixture)

Mobile viewport tests use `@mobile` tag for iPhone/Pixel projects in
`playwright.config.ts`.

### 5. Offline Sync Queue Completeness

The offline sync queue must support all entity types that have local stores:
`progress`, `annotation` (highlight/comment), `bookmark`, `reading-insight`.
Failure to sync any type must enqueue a retry item (no silent data loss).

### 6. CI Node Version Matrix

CI tests against Node 22 LTS and Node 24 (current). This catches V8/runtime
regressions that single-version testing misses.

---

## Consequences

- B1 fix requires careful session table querying on grant PATCH
- .gitignore changes may require `git rm --cached` for any stale tracked files
- Responsive fixes touch 3 admin page files
- E2E additions increase CI runtime by ~30-60s (parallelized)
- Offline sync refactor touches `apps/web/src/lib/offline/sync.ts`
- Node matrix doubles CI minutes for unit/build jobs

---

## Compliance

- AGENTS.md Tier 1: B1 fix satisfies "MUST revoke sessions on grant change"
- AGENTS.md Tier 1: .dev.vars in .gitignore satisfies "NEVER leak secrets"
- AGENTS.md Tier 2: All findings documented as GOAP plan + ADR (not KNOWN-ISSUES.md)
- AGENTS.md Tier 3: Responsive design follows mobile-first patterns
- ADR-063: Semantic design tokens maintained in all fixes
- ADR-105: Container queries and modern CSS APIs used
