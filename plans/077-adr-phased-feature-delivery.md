# ADR 077: Phased Feature Delivery Policy

**Date**: 2026-06-11
**Status**: Accepted
**Supersedes**: None
**Context**: GOAP plan 077 comprehensive codebase analysis

## Decision

All missing implementations and new features follow a phased delivery model:

1. **Security fixes (P0)** ship immediately as hotfix branches
2. **Code quality (P1)** ships in next planned sprint
3. **Missing implementations (P1-P2)** ship incrementally — no big-bang feature branches
4. **New features (P2+)** require an ADR before implementation begins

## Rationale

- The codebase has 9 missing implementations and 10 potential new features
- Attempting to deliver all at once would create merge conflicts and review bottleneck
- Security issues (grant revocation race, highlight cross-book access) must not wait

## Constraints

1. Each feature branch touches ≤3 source files where possible
2. No feature branch lives longer than 5 days without merge
3. Every P0/P1 item must have a test proving the fix
4. New features must not regress existing coverage thresholds
5. LOC-limit violations (500 LOC) must be fixed before adding features to those files

## Consequences

- Slower feature velocity but higher merge confidence
- Security posture improves before feature work begins
- Large files get split before new code is added to them
- Features like "Compare Editions" and "AI Editorial" remain backlogged until P0-P2 clear

## Implementation Order

```
P0 Security → P1 Quality/LOC splits → P1 Stubs → P2 Features → P3+ Backlog
```

## Affected Components

- `apps/worker/src/routes/admin/grants.ts` (transaction wrap)
- `apps/worker/src/routes/reader/highlights.ts` (ownership validation)
- `apps/web/src/features/reader/hooks/useReaderEpub.ts` (split)
- `apps/web/src/features/reader/components/toolbar/ReaderToolbar.tsx` (split)
- `apps/web/src/features/admin/BooksPage.tsx` (split)
- `packages/shared/src/dtos.ts` (DTO alignment)
- `packages/schema/src/locator.ts` (type unification)
