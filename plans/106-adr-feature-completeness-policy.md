# ADR-106: Feature Completeness and Incremental Delivery Policy

**Date:** 2026-06-23
**Status:** Proposed
**Deciders:** Project maintainer
**Related:** ADR-077 (Phased Feature Delivery), ADR-092 (Feature-Gap Policy)

## Context

Analysis of the codebase reveals ~20 concrete feature gaps spanning backend
endpoints, frontend user flows, shared package utilities, and UI components.
These gaps range from missing UI primitives (Pagination, ConfirmDialog) to
incomplete backend operations (cascade delete, export notes) to absent user
flows (catalog search, reading insights dashboard).

The existing ADR-077 establishes phased delivery, but does not prioritize
which gaps block a usable product vs. nice-to-have enhancements.

## Decision

1. **UI primitives before features.** Missing shared UI components
   (Pagination, ConfirmDialog, SearchInput, ProgressBar, Tabs) ship
   first because multiple features depend on them.

2. **Backend completeness before frontend wiring.** An API endpoint
   must exist and be tested before building UI that consumes it.

3. **Catalog and admin are P1.** Users cannot effectively use the
   platform without catalog browsing (search/filter/paginate) and
   admins cannot manage content without full CRUD + cascade delete.

4. **Export and insights are P2.** Reading insights and annotation export
   enhance the product but are not blocking core usage.

5. **Every new endpoint ships with:**
   - Zod input validation (per ADR-078)
   - Tenant isolation guard (per ADR-075)
   - TraceId propagation
   - Rate limit consideration
   - Vitest coverage ≥ 80%

6. **Every new UI component ships with:**
   - Storybook story
   - Vitest unit test
   - Semantic design tokens only (per ADR-063a)
   - Keyboard accessibility and ARIA attributes
   - `prefers-reduced-motion` compliance

7. **Offline-first for reader mutations.** Any operation the reader
   performs (annotate, bookmark, progress) must work offline and sync
   via Background Sync API. Non-reader operations (admin, catalog browse)
   may require connectivity.

## Consequences

- Clear priority order prevents scope creep
- UI component library grows predictably (each component independently tested)
- Backend gaps are closed with consistent patterns
- Feature flags are not needed — phased delivery via plan ordering
