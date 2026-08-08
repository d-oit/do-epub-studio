# GOAP Plan 076 — Admin Recovery + Book CRUD

**Date:** 2026-06-15
**Orchestrator:** goap-agent
**Source:** `analysis/SWARM_ANALYSIS.md` (G17, G18)
**Closes:** G17 (admin recovery missing), G18 (book edit/delete missing)
**Depends on:** G15 (magic-link email transport, plan 081)

## 1. Analysis

- **Primary Goal:** Admins can recover their own password via
  email, and admins can edit or archive books from the Books
  page without direct DB intervention.
- **Constraints:** All new endpoints behind `adminAuth` (except
  the recovery request/verify pair). Magic-link tokens follow
  the same construction as the reader flow.
- **Complexity:** Medium.

## 2. Decomposition

### G17 — Admin password recovery

1. **API:** `POST /api/admin/recovery-request` (no auth) and
   `POST /api/admin/recovery-verify` (no auth). Reuse the
   `RecoveryRequestSchema` / `RecoveryVerifySchema` from
   `@do-epub-studio/schema` with a new `audience: 'admin'`
   discriminator.
2. **DB:** add `admin_recovery_codes` table
   (`id`, `admin_email`, `code_hash`, `expires_at`, `consumed_at`).
3. **Email:** call the same `EmailEvent` transport used by G15.
4. **Web:** add a "Forgot password?" link on
   `AdminLoginPage.tsx`; mirror the reader's
   `LoginPage.tsx:258-264`. Add i18n keys for en/de/fr.
5. **Audit:** log every `recovery_request` and `recovery_consume`
   event with the admin email.
6. **Test:** unit test for the request/verify pair; integration
   test that asserts the email transport was called once and the
   verify rejects expired codes.

### G18 — Book edit / archive / delete

1. **API:** `PATCH /api/admin/books/:id` (title, author,
   description, visibility, language) and
   `DELETE /api/admin/books/:id` (soft delete via
   `archived_at`).
2. **DB:** the schema already supports `archived_at`; add
   `updated_at` and `updated_by` columns if missing.
3. **Web:** add an Edit modal and an Archive button to
   `BooksPage.tsx`. The Edit modal reuses the existing form
   components.
4. **Audit:** log every edit/archival with the actor and the
   diff.
5. **Test:** unit test for PATCH/DELETE; integration test
   that asserts a non-admin gets 403, an admin gets 200, and a
   reader gets 404.

## 3. Strategy

**Sequential (G17 before G18) within the same sprint.**

- G17 depends on G15 (email transport) for actual delivery; we
  can land the routes in this PR but they will be no-op without
  G15, so we should ship G15 in the same release.
- G18 is independent of G17 but uses the same audit-log
  helpers, so landing both in one PR reduces churn.

## 4. Quality Gates

- `./scripts/quality_gate.sh` (lint + typecheck + coverage)
- `./scripts/validate-workflows.sh`
- New Playwright spec:
  `apps/tests/admin-recovery-and-book-crud.spec.ts` covering
  the full flow (admin login → recover → login → edit book →
  archive book → audit log shows entries).

## 5. Atomic Commits

1. `feat(schema): add admin_recovery_codes table + migration`
2. `feat(worker): add admin recovery endpoints + email dispatch`
3. `feat(web): add Forgot password flow to AdminLoginPage`
4. `test(worker): cover admin recovery request/verify + email`
5. `feat(worker): add PATCH + DELETE for /api/admin/books/:id`
6. `feat(web): add Edit + Archive UI to BooksPage`
7. `test(worker+web): cover admin book edit/archive`
8. `docs(plans): record execution of plan 076`

## 6. Reference

- `analysis/SWARM_ANALYSIS.md` G17, G18
- `plans/081-adr-magic-link-email-transport.md` (G15)
- `packages/schema/src/schemas.ts` (RecoveryRequestSchema,
  RecoveryVerifySchema)
- `apps/worker/src/routes/access.ts` (reader recovery template)
