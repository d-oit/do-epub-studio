# GOAP-239: Split >500-LOC Source Files (admin/auth.ts + schema/schemas.ts)

**Date:** 2026-08-14
**Status:** In Progress (this PR)
**Baseline:** `main` @ `8b458f5` (post GOAP-238, PRs #978/#979)
**Related:** Plan 226 (§5 source-LOC policy); ADR-078 (Zod schema centralization); ADR-234 (auth); AGENTS.md source-LOC cap

## Goal

Split the two remaining >500-LOC source files into ceremony/domain modules
behind the original paths, preserving ALL public exports and route behavior
exactly. Verified locally + full CI-green on the PR.

## Targets (scout-verified)

| File | LOC | Split strategy |
| --- | --- | --- |
| `apps/worker/src/routes/admin/auth.ts` | 1220 | By ceremony: login / recovery / account / mfa, behind `auth/` dir with a single `authRouter` |
| `packages/schema/src/schemas.ts` | 544 | By domain: common / password / mfa / auth / annotation / books / grants / queries / insights / telemetry, behind a barrel |

## Architecture

### auth.ts → `routes/admin/auth/` (single shared `authRouter`)
- `types.ts` — `AuthApp = Hono<{Bindings: Env; Variables: {requestContext; adminUser}}>`
- `shared.ts` — `getClientIp`, `hashString`, `MFA_CEREMONY_TIMEOUT_MS` (the only truly shared symbols)
- `login.ts` — `registerLogin(router)`: `/login`, `/login/mfa/start`, `/login/mfa/verify`, `/login/mfa/recovery-verify`, `/logout`; hosts login-only helpers `MfaFactorContext`, `MfaFactorOutcome`, `MFA_FAILURE_OUTCOME`, `logMfaFailure`, `logLoginTicketReplay`, `verifyPasskeyFactor`
- `recovery.ts` — `registerRecovery(router)`: `/recovery-request`, `/recovery-verify`
- `account.ts` — `registerAccount(router)`: `/account/password-change`, `/account/sessions`, `/account/logout-all`, `/account/step-up`
- `mfa.ts` — `registerMfa(router)`: `/account/mfa/status`, register-start/verify, authenticate-start/verify, `DELETE /account/mfa/passkey/:id`, recovery-codes/regenerate
- `index.ts` — creates `authRouter`, wires the four registrars, `export { authRouter }`
- Delete `auth.ts`; `import { authRouter } from './auth'` in `routes/admin/index.ts` now resolves to `./auth/index`

### schemas.ts → `schemas/` directory + `schemas/index.ts` barrel
`export *` from `common`, `password`, `mfa`, `auth`, `annotation`, `books`, `grants`, `queries`, `insights`, `telemetry`. Cross-module deps allocated: `common` → {password, mfa, auth(partial), annotation, books, grants, queries}; `password` → auth; `mfa` → auth(LoginMfaVerifySchema). No cycles. `KNOWN_WEAK_PASSWORDS` stays file-private in `password.ts`.

## Quality gate
- All 97 schema exports + every route preserved (barrel-name uniqueness enforced by `tsc`)
- Worker unit suite (incl. admin auth/mfa/account/step-up/recovery/risk) and schema + shared unit suites green
- `pnpm lint`, `pnpm typecheck`, `pnpm knip`, worker build, `scripts/dead-code-check.sh` green
- Full CI green on the PR (fast-check, quality-gate, worker-build, build, tests)

## Out of scope
- Vitest-4 deprecation warnings; private security triage (R1/R12/N3, S1–S9, O2, P5/P7); ADR-217 OTel; readers `@intity/epub-js` migration.
