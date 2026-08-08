# GOAP Plan 079 — Admin Grants PATCH UI

**Date:** 2026-06-15
**Orchestrator:** goap-agent
**Source:** `analysis/SWARM_ANALYSIS.md` G21
**Closes:** G21 (orphan GrantForm + GrantList components)

## 1. Analysis

- **Primary Goal:** Wire the existing `<GrantForm />` and
  `<GrantList />` components into `GrantsPage.tsx`, or delete
  them. The backend PATCH endpoint
  (`routes/admin/grants.ts:72-110`) is shipped and tested.
- **Complexity:** Small (UI only).

## 2. Decomposition

1. **Audit:** confirm the components are wired to a working
   PATCH endpoint and the test (`routes.admin.test.ts:134-159`)
   covers the schema.
2. **Wire:** mount `<GrantList />` inside `GrantsPage.tsx` and
   pass `onEdit={(grant) => setEditingGrant(grant)}` to
   `<GrantForm />`. When `editingGrant` is set, the form
   pre-fills and PATCHes on submit.
3. **Test:** add a `GrantsPage.test.tsx` test that asserts
   clicking "Edit" opens the form with the right initial
   values, and submitting PATCHes.
4. **Delete:** if a design decision is "these are reserved for
   the future, do not delete", add a top-of-file comment
   explaining why they exist and link to the relevant issue.

## 3. Strategy

**Sequential, one PR.** Pick one of "wire" or "delete" based on
team preference. The default is **wire** because the backend
support is already shipped.

## 4. Quality Gates

- `./scripts/quality_gate.sh`
- A new `GrantsPage.test.tsx` interaction test.

## 5. Atomic Commits

1. `feat(web): wire GrantForm + GrantList into GrantsPage`
2. `test(web): cover edit grant flow`
3. `docs(plans): record execution of plan 079`

## 6. Reference

- `apps/web/src/features/admin/components/GrantForm.tsx`
- `apps/web/src/features/admin/components/GrantList.tsx`
- `apps/worker/src/routes/admin/grants.ts:72-110`
- `apps/worker/src/__tests__/routes.admin.test.ts:134-159`
