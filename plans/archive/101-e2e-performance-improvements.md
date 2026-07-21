# E2E Resilience & Performance Improvement Plan

**Date:** 2026-06-17
**Branch:** feature/e2e-performance-improvements

## Current State

### Bundle Size
- Total: ~944 KB (gzip: ~285 KB)
- Largest chunks:
  - admin-route: 441 KB (gzip: 130 KB)
  - reader-core: 185 KB (gzip: 56 KB)
  - react-vendor: 180 KB (gzip: 57 KB)
  - reader-route: 83 KB (gzip: 22 KB)

### E2E Status
- Scheduled cross-browser E2E uses production builds (ADR-074 compliant)
- All admin form elements have proper labels (ADR-074 compliant)
- Mock endpoints match actual API endpoints

## Tasks

### Task 1: Implement ADR-074 - Verify Accessibility Labels

**Goal:** Ensure all form elements have programmatic labels per ADR-074.

**Files to check:**
- `apps/web/src/features/admin/AuditLogPage.tsx` - Already has aria-labels ✅
- `apps/web/src/features/admin/BooksPage.tsx` - Check form elements
- `apps/web/src/features/admin/GrantsPage.tsx` - Check form elements
- `apps/web/src/features/auth/LoginPage.tsx` - Check form elements

### Task 2: Performance Optimization

**Goal:** Reduce bundle size and improve Lighthouse scores.

**Opportunities:**
1. Analyze admin-route chunk (441 KB) for code splitting
2. Check for duplicate dependencies
3. Optimize dynamic imports
4. Review image and asset optimization

### Task 3: Lighthouse Audit Improvements

**Goal:** Improve Lighthouse performance score.

**Current Issues:**
- Service worker: 218 KB (65 KB gzip)
- Multiple JS chunks loaded on initial load

## Execution Plan

### Phase 1: Accessibility Verification
1. Run axe-core audit on all admin pages
2. Verify all form elements have labels
3. Document any findings

### Phase 2: Bundle Analysis
1. Analyze admin-route chunk composition
2. Identify code splitting opportunities
3. Check for duplicate dependencies

### Phase 3: Performance Fixes
1. Implement code splitting for admin routes
2. Optimize dynamic imports
3. Review and optimize assets

### Phase 4: Verification
1. Run Lighthouse audit
2. Verify bundle size reduction
3. Run E2E tests
