# Coverage Improvement Progress

**Date:** 2026-06-16
**Status:** In Progress

## Summary

Comprehensive test coverage improvement across all packages in the monorepo.

## Coverage Results

| Package | Before | After | Change |
|---------|--------|-------|--------|
| shared | 48.93% | 90.42% | **+41.49%** |
| schema | 44.06% | 98.3% | **+54.24%** |
| ui | 32.28% | 90.71% | **+58.43%** |
| web | 63.83% | 76.58% | **+12.75%** |
| worker | 70.15% | 70.15% | - |
| reader-core | 77.7% | 77.7% | - |
| testkit | 97.64% | 97.64% | - |

## Tests Added

### Phase 1 (PR #586 - Merged)
- `packages/shared/src/__tests__/epub-validator.test.ts` - 11 tests
- `packages/schema/src/__tests__/schemas.test.ts` - 78 tests
- `packages/ui/src/__tests__/components.test.tsx` - 39 tests
- `packages/ui/src/__tests__/modal-toast.test.tsx` - 26 tests
- `packages/ui/src/__tests__/Tooltip.test.tsx` - 10 tests
- `packages/ui/src/__tests__/Input.test.tsx` - 9 tests (updated)
- `apps/web/src/__tests__/catalog-page.test.tsx` - 6 tests
- `apps/web/src/__tests__/api-annotations.test.ts` - 7 tests
- `apps/web/src/__tests__/api-progress.test.ts` - 3 tests
- `apps/web/src/__tests__/reader-store.test.ts` - 29 tests

### Phase 2 (Current)
- `apps/web/src/__tests__/reader-hooks.test.ts` - 30 tests
- `apps/web/src/__tests__/info-panel.test.tsx` - 10 tests
- `apps/web/src/__tests__/login-page.test.tsx` - 8 tests
- `apps/web/src/__tests__/app-routes.test.tsx` - 4 tests
- `apps/web/src/__tests__/auth-store.test.ts` - 10 tests
- `apps/web/src/__tests__/preferences-store.test.ts` - 17 tests
- `apps/web/src/__tests__/session-expiry.test.ts` - 6 tests
- `apps/web/src/__tests__/client-logger.test.ts` - 7 tests
- `apps/web/src/__tests__/sync.test.ts` - 4 tests
- `apps/web/src/__tests__/db.test.ts` - 2 tests

## Files Now at 100% Coverage

- `shared/epub-validator.ts`
- `schema/schemas.ts`
- `web/lib/api/annotations.ts`
- `web/lib/api/progress.ts`
- `ui/AppLogo.tsx`
- `ui/LiveRegion.tsx`
- `ui/badge.tsx`
- `ui/card.tsx`
- `ui/header.tsx`
- `ui/icon-button.tsx`
- `ui/page-container.tsx`
- `ui/skeleton.tsx`
- `ui/modal.tsx`
- `ui/tooltip.tsx`
- `ui/input.tsx`
- `ui/toast.tsx`

## Remaining Gaps

### Web Package (76.58%)
- `BooksPage.tsx` - 28.57% (complex admin page with many dependencies)
- `CommentItem.tsx` - 30.43%
- `HighlightItem.tsx` - 40%
- `ReaderToolbar.tsx` - 42.1%
- `Drawer.tsx` - 57.14%
- `main.tsx` - 59.09%

## Next Steps

1. Continue improving web package coverage to reach 80% target
2. Consider testing more complex components with mocked dependencies
3. Focus on reader-related components for highest impact
