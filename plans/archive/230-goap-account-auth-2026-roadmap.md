# GOAP-230: Account Auth and Demo Account Roadmap

**Date:** 2026-08-13
**Status:** Accepted
**Related:** ADR-004, ADR-080, ADR-092, ADR-106, ADR-200, ADR-212, ADR-214, ADR-231, ADR-232, ADR-233, ADR-234

## Goal

Analyze the current account/auth surface and define the missing implementation
needed for secure reader/admin accounts, password resets, and demo accounts.
This plan intentionally updates only `plans/` and does not implement code.

## Current Implementation Evidence

| Area | Evidence | Current state |
| --- | --- | --- |
| Reader grant password auth | `apps/worker/src/auth/password.ts`, `apps/worker/src/routes/access.ts` | Argon2id grant passwords, rate limit, lockout, bearer reader sessions. |
| Reader recovery | `apps/worker/src/routes/access.ts`, `apps/web/src/features/auth/LoginPage.tsx` | Magic-link session issuance; no password reset or single-use reset-token table. |
| Admin password auth | `packages/schema/migrations/0002-admin-auth.sql`, `apps/worker/src/auth/admin-middleware.ts` | Admin user password hash, 8-hour bearer admin sessions. |
| Admin recovery | `apps/worker/src/routes/admin/auth.ts`, `apps/web/src/features/admin/AdminRecoverPage.tsx` | Recovery link creates a session; frontend sends `newPassword`, but backend schema accepts only `token`. Response shape also differs. |
| Demo accounts | `scripts/`, `packages/schema/migrations/`, E2E fixtures | No production-safe seed path; demo-like accounts exist only in tests/fixtures. |
| Session posture | `docs/security-posture.md`, `apps/web/src/stores/auth.ts` | localStorage bearer token accepted with CSP/sanitizer/lockout compensating controls. |

## Missing Implementation

| ID | Priority | Recommendation | ADR |
| --- | --- | --- | --- |
| A1 | P0 | Fix admin recovery contract and replace magic-link login with real password reset semantics. | ADR-232 |
| A2 | P0 | Add persistent, hashed, single-use reset-token records with expiry, attempt limits, audit events, and session revocation. | ADR-232 |
| A3 | P1 | Make `users` the canonical account identity for reader/admin auth while preserving grant-email compatibility during migration. | ADR-231 |
| A4 | P1 | Add account lifecycle endpoints for reader/admin password set/change, email verification, disabled state, and compromised-password recovery. | ADR-231 |
| A5 | P1 | Harden admin auth with step-up controls, WebAuthn-ready MFA policy, session rotation, and sensitive-action reauthentication. | ADR-234 |
| A6 | P2 | Add safe demo reader/admin accounts through an explicit non-production seed workflow, never migrations or tracked credentials. | ADR-233 |
| A7 | P2 | Add auth observability that logs reset/session/account events without token, password, or reset-code disclosure. | ADR-231, ADR-232, ADR-234 |

## TRIZ Contradictions

### Contradiction 1

**Improving:** Demo usability and reviewer onboarding.
**Worsens:** Credential safety and production blast radius.
**Reality:** No seed script exists; hardcoded demo users would create a
credential leak path if deployed broadly.
**TRIZ principles:** Segmentation, condition separation, extraction.
**Resolution:** ADR-233 makes demo seeding environment-gated and non-production
only, with generated or operator-provided passwords.

### Contradiction 2

**Improving:** Password recovery convenience.
**Worsens:** Replay resistance and account takeover risk.
**Reality:** Existing recovery links are stateless JWTs that issue sessions.
They expire, but there is no persisted single-use record.
**TRIZ principles:** Time separation, nesting, local quality.
**Resolution:** ADR-232 separates request, verification, password update, and
session creation, with one-time hashed token records.

### Contradiction 3

**Improving:** Unified account lifecycle.
**Worsens:** Migration risk for reader data keyed by email.
**Reality:** Reader progress, comments, bookmarks, highlights, grants, and
sessions use email fields today.
**TRIZ principles:** Segmentation, dynamicity, partial action.
**Resolution:** ADR-231 phases in `user_id` ownership while retaining
lowercase-email compatibility until data backfill is complete.

### Contradiction 4

**Improving:** Admin account security.
**Worsens:** Admin workflow friction.
**Reality:** Admins currently use password plus bearer session only.
**TRIZ principles:** Condition separation, local quality.
**Resolution:** ADR-234 applies step-up checks only to sensitive actions and
keeps ordinary admin reads within the existing session model.

## Decomposition

| Phase | Tasks | Dependencies | Gate |
| --- | --- | --- | --- |
| 1. Contract repair | Align admin recovery schema, response DTO, UI store update, and tests. | None | Unit tests prove no shape mismatch. |
| 2. Reset foundation | Add reset-token table, schemas, route handlers, email templates, and audit events. | Phase 1 | Tokens are hashed, single-use, expiring, and attempt-limited. |
| 3. Account lifecycle | Add user identity migration, account status fields, password set/change endpoints, and reader account linking. | Phase 2 | Existing grant login remains compatible. |
| 4. Admin hardening | Add sensitive-action reauth, MFA-ready metadata, session rotation rules, and audit coverage. | Phase 3 | Admin mutations require current assurance. |
| 5. Demo seed | Add non-production seed command and tests for reader/admin demo users. | Phase 3 | Production deploys cannot enable demo credentials. |
| 6. Verification | Add worker route tests, web flow tests, E2E happy paths, Codacy check, and quality gate. | All phases | `./scripts/quality_gate.sh` passes. |

## Quality Gates

- Zod schemas for every new request and response contract.
- Argon2id for every long-lived password; no bcrypt/scrypt fallback.
- Reset tokens generated by CSPRNG, hashed at rest, single-use, and expired.
- Uniform recovery responses for existing and non-existing accounts.
- Per-account plus per-IP rate limits for login and reset flows.
- Sessions revoked or rotated after password reset, grant change, MFA change,
  and admin sensitive-action reauthentication.
- No token, password, reset link, or PII-bearing payload in client telemetry or
  audit payloads.
- HSTS/CSP regression tests continue to cover auth pages.
- Demo account workflow is disabled in production by default and fails closed.

## References

- OWASP Forgot Password Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>
- OWASP Authentication Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>
- OWASP Password Storage Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- OWASP ASVS 5.0 V6 Authentication:
  <https://github.com/OWASP/ASVS/blob/master/5.0/en/0x15-V6-Authentication.md>
- NIST SP 800-63B:
  <https://pages.nist.gov/800-63-4/sp800-63b.html>

## Closure Record (2026-08-13)

Implemented A1–A7 across a single PR:

- **A1 / A2 (contract repair + reset foundation):** admin recovery now uses a
  real password-reset flow (`password_reset_tokens` table, CSPRNG tokens stored
  only as SHA-256 hashes, 15-min admin / 30-min reader TTL, single-use with
  replay/expiry audit, per-account + per-IP rate limits, uniform responses, no
  auto-login, full admin-session + reader-session revocation). Reader magic-link
  access is persisted single-use. Fixed the admin login/recovery response DTO
  mismatch so the web UI consumes `{ token, user:{email} }` and recovery returns
  `{ ok, data:{ reset:true } }`.
- **A3 / A4 (account lifecycle):** `users` gained lifecycle fields
  (`email_verified_at`, `disabled_at`, `compromised_at`, `last_login_at`,
  `last_password_change_at`, `password_version`) and a shared password policy;
  nullable `user_id` backfill columns on reader-owned tables + idempotent
  `scripts/backfill-user-ids.mjs`; authenticated password-change, sessions
  inventory, logout-all, and email-derivative rejection. Fail-closed on
  disabled/compromised accounts.
- **A5 (admin hardening):** session `assurance_level` + step-up reauth
  enforcing fresh assurance on sensitive grant/book mutations
  (`middleware/step-up.ts`), session inventory and rotation, account-wide
  revocation. MFA-ready schema (`mfa_method`, `mfa_enrolled_at`,
  `recovery_codes_hash_json`) is present for the follow-up passkey/TOTP work.
  **Passkey enroll/remove (WebAuthn) is now implemented** in the ADR-234
  items 5+6 follow-up PR: `requireMfa` middleware, MFA routes, `useAdminMfa`
  web hook + Account Settings UI. **Recovery codes (A6)** are generated and
  regenerated hashed-at-rest and single-use via the same PR. **Item 7
  (risk-event handling)** shipped via GOAP-237 (PR #977) — risk events are
  persisted and surfaced to the admin dashboard; no open follow-up remains.
- **A6 (demo seed):** `scripts/seed-demo-accounts.mjs` — fails closed outside
  `DEMO_ACCOUNTS_ENABLED=1` + non-production gates, operator-provided Argon2id
  passwords, `created_by_demo=1`, idempotent reseed that revokes prior sessions.
- **A7 (observability):** audit events for reset requested/completed/denied/
  replay/expired, password changed, sessions revoked, step-up success/failure,
  session list — none log tokens, passwords, recovery codes, user agents, or raw
  IPs (only `ipHash` / `traceId`).

ADRs 231–234 are marked Accepted. See ADR-INDEX.md.
