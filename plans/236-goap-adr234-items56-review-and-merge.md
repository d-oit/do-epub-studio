# GOAP-236: ADR-234 Items 5+6 — Review, Remediate, and Merge

**Status:** ✅ Complete (merged as PR #975, commit a3827d5)
**Date:** 2026-08-14
**Goal:** Drive the in-progress ADR-234 items 5+6 follow-up (WebAuthn passkeys + recovery codes + MFA) to a mergeable PR with all CI green, addressing all review findings and PR comments.

## Scope

Working tree (uncommitted, on `main`) contains the ADR-234 items 5+6 feature:

- **Worker:** `src/auth/mfa.ts`, `src/middleware/mfa.ts` (new); `src/routes/admin/auth.ts`, `src/auth/admin-middleware.ts`, `src/lib/env.ts`, `wrangler.jsonc` (modified); test files.
- **Web:** `src/features/admin/MfaSection.tsx`, `mfa.ts`, `mfa.test.ts` (new); `AccountSettingsPage.tsx`, `AdminLoginPage.tsx`, `step-up.tsx`, `useAdminMfa`, i18n; test files.
- **Schema:** `packages/schema/migrations/0010-mfa-passkeys.sql` (new); `src/schemas.ts`; `src/__tests__/mfa-schemas.test.ts`.
- **Shared/docs:** `apps/tests/fixtures.ts`, `apps/worker/src/__tests__/fixtures.ts`, plans/230+234 closure records, `docs/security-posture.md`, `agents-docs/LEARNINGS.md`.

## Strategy: Swarm (review) → Hybrid (implement)

### Phase 1 — Review swarm (parallel, read-only)

| Slice | Agent | Target |
|---|---|---|
| A Security | security-reviewer | worker auth/mfa.ts, middleware/mfa.ts, routes/admin/auth.ts, admin-middleware.ts, migration 0010 |
| B Worker correctness | reviewer | worker auth/mfa.ts, routes/admin/auth.ts, middleware/mfa.ts |
| C Web UI + i18n | designer + reviewer | MfaSection.tsx, mfa.ts, step-up.tsx, AccountSettings/AdminLogin, i18n |
| D Schema + tests | reviewer | schemas.ts, migration 0010, test files |

Quality gate: each slice returns concrete, evidence-backed findings.

### Phase 2 — Synthesize
Collate findings into a ranked backlog.

### Phase 3 — Implementation swarm (by area)
Worker/security, web/UI, schema/tests. Quality gate: re-run worker + web unit suites and typecheck.

### Phase 4 — Verification
`/home/doit/git/do-epub-studio/scripts/quality_gate.sh` → exit 0.

### Phase 5 — PR
Commit on feature branch, open PR, address reviewer comments until CI green.

## Notes
- No cron/architecture changes (prune handled inline in `storeChallenge`).
- Baseline: prior quality gate passed on essentially this tree.

## Synthesis (2026-08-14)

Review swarm (security-reviewer + 2× reviewer + designer) over the feature surfaced findings; all actioned:

- **MFA single-factor bypass (WEAKN-001/004):** public `/login/mfa/*` could mint an `mfa` session from a passkey alone. Fixed by a short-lived single-use **login ticket** issued only after `/login` verifies the password (migration 0011 `mfa_login_tickets`), required by `/login/mfa/start` + `/login/mfa/verify`, and consumed atomically immediately before session mint. Closes both the bypass and the enrollment/credential-id disclosure.
- **Recovery-code single-use race (WEAKN-002):** initially rewritten to an atomic SQLite JSON1 `UPDATE` (`json_each`/`json_group_array` + `EXISTS`), then **reverted** to the tested read-modify-write: this repo has no real-D1/miniflare harness, so all unit tests mock D1 and the atomic SQL would ship with zero execution coverage on the critical locked-out-admin fallback to close a LOW-severity, rate-limited (5/300s) race — inverted risk/reward. The tested path is kept with a doc-comment noting the narrow concurrency caveat; re-open if a real-D1 test layer lands.
- **requireMfa expiry (WEAKN-003):** middleware now enforces `expires_at` itself (defense-in-depth).
- **Dead/misleading code:** removed dead `idx_webauthn_challenge_expires` (unbackable by the prune DELETE); removed unused `MfaAuthenticateStartSchema`; removed `hasRecoveryCodes` literal-`'null'` check.
- **Unhandled 500 on public route (schema):** `WebAuthnResponseSchema` now requires `id` + `response.clientDataJSON` so structurally-invalid bodies fail Zod with a clean 400.
- **Web (I18N-01 was a FALSE POSITIVE** — all 12 locales already carried the 25 keys): added 5 genuinely-new keys (`security.mfa.{loading,passkeyName,removeConfirmTitle,removeConfirmMessage}`, `security.recovery.copy`) to all locales via swarm.
- **Web UX/a11y:** passkey rows show `display_name` + labeled remove button; destructive removal confirm (`ConfirmDialog` danger) naming the passkey; `display_name` now persisted (migration 0010) + returned by status; regenerate loading state; singular per-code copy label; loading indicator.
- **Tests:** new schema tests (RecoveryVerifyLogin/LoginMfaVerify/LoginMfaStart/SetPassword + boundary); login-ticket guard tests in worker routes; `/login` returns-`loginTicket` assertion.

Quality gate: exit 0 (full worker+web+schema unit suites, typecheck, lint, build, E2E smoke, knip dead code, madge circular deps).
