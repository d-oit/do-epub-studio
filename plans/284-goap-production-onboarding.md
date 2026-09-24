# GOAP-284: Production account and invitation onboarding

**Status:** IN PROGRESS — Phases 0–4 implemented; live verification pending
**Date:** 2026-09-24
**Strategy:** Sequential contract → backend → UI → live verification
**ADR:** `plans/284-adr-invitation-account-lifecycle.md`
**Related:** ADR-004, ADR-231, ADR-232, ADR-233, ADR-234, ADR-999, GOAP-999, GOAP-252

## Goal

Make a fresh production-like deployment usable without demo accounts, manual SQL,
or out-of-band password sharing. An administrator must be able to invite a
reader or creator for a book; the recipient must accept the invitation, set a
grant password, and reach the appropriate reader or creator workspace.

The first release preserves the existing book-grant reader authentication model.
It adds canonical user linking where required for book-scoped creator assignment,
without migrating all existing reader sessions, progress, or annotations.

## Current evidence

- `apps/worker/src/routes/admin/creators.ts` rejects an email when no
  `users` row exists; there is no ordinary account-provisioning route.
- `apps/worker/src/auth/password.ts:createGrant` creates a grant but does not
  create a user or invitation lifecycle.
- `apps/worker/src/routes/access.ts` can issue a reader recovery token, but the
  transport falls back to logging when no email binding is configured.
- `apps/worker/src/lib/email-transport.ts` no longer logs message bodies or
  invitation/recovery URLs; the remaining work is to verify the end-to-end
  operator flow.
- `docs/runbooks/infrastructure-setup.md` records that Pages deployments do not
  expose the Email Sending binding, so a copy-link fallback is required.
- The reader → private feedback → creator review path is already implemented
  and live-verified under GOAP-999; this plan does not rebuild that channel.

## Product contract

### Invitation

1. An authenticated administrator creates a book-scoped invitation for either a
   reader or a creator.
2. The administrator chooses grant capabilities and an optional expiry.
3. A creator invitation does not grant creator access until accepted.
4. A pending invitation is visible to administrators with its delivery state.
5. Resend invalidates the previous pending token before issuing a new one.
6. Revoke prevents acceptance and revokes any access created by the invitation.

### Delivery

- When `EMAIL_SEND` is configured, the Worker sends a minimal invitation email.
- When it is not configured, the UI shows `manual copy required` and offers a
  copy-link action.
- The application never reports an email as sent when the transport only logged
  it.
- The raw invitation token is never written to logs, audit payloads, telemetry,
  or error text.

### Acceptance

- A valid token opens `/accept-invite` without requiring an existing session.
- The recipient sets a new grant password using the existing Argon2id policy.
- Acceptance creates or links the canonical user, creates the grant, and creates
  a creator assignment when the invitation role is `creator`.
- The token is single-use and expires; concurrent acceptance creates one result.
- Invalid, expired, revoked, and replayed tokens return a generic safe state.

## Scope

### In scope

- Additive invitation schema and migration.
- CSPRNG token creation, hash-at-rest storage, expiry, claim, and replay audit.
- Admin invite/list/resend/revoke APIs and step-up protection.
- Public invite acceptance API and `/accept-invite` web route.
- Hybrid email delivery plus secure copy-link fallback.
- Canonical user creation/linking compatible with existing grant authentication.
- Localized, keyboard-accessible admin and acceptance UI.
- Worker route tests, schema/migration tests, web tests, and live-stack E2E.
- Operator documentation for Pages email limitations and manual delivery.

### Out of scope

- Public signup, OIDC, or social login.
- Automatic creator assignment based on email domain or upload ownership.
- Migrating all reader sessions and stored state to a new account login.
- Cloud AI, local model downloads, or editorial-assistance productionization.
- Manuscript editing, automatic EPUB replacement, or version history.
- Guest/public-book reading without a grant.

## Phases

| Phase | Work                         | Exit criteria                                                                                       |
| ----- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| 0     | Contract and threat model    | ADR accepted; token, identity, delivery, and rollback decisions recorded                            |
| 1     | Schema and token foundation  | Migration applies; token helpers pass unit tests; audit enum includes invitations                   |
| 2     | Worker invitation APIs       | Create/list/resend/revoke/accept routes enforce step-up, scope, expiry, and replay rules            |
| 3     | Email delivery and redaction | Configured transport sends; fallback is explicit; raw tokens never enter logs                       |
| 4     | Admin and acceptance UI      | Reader/creator invite flow and acceptance route work at mobile and desktop sizes                    |
| 5     | End-to-end verification      | Fresh non-demo account completes invite → read → feedback → creator review; revocation fails closed |
| 6     | Synthesis                    | `plans/999` status reconciled; non-obvious learnings recorded                                       |

Phases 1–3 are sequential around the token contract. Phase 4 can begin against
frozen schemas after Phase 2. Phase 5 is integration-only and runs serially.

### Implementation checkpoint

- Migration `0018` adds invitation lifecycle, audit parity, and the Pages D1
  rate-limit bucket.
- Worker create/list/resend/revoke/accept routes, step-up guards, Argon2id
  grant provisioning, session issuance, audit events, and token redaction are
  implemented and covered by route/service/migration tests.
- `/accept-invite`, admin invitation management, and all 13 locale catalogs
  are implemented and covered by component/route/parity tests.
- The mocked admin E2E is green in CI; local browser execution remains
  unavailable in this Debian 11 workspace.
- A real Node SQLite integration test applies migrations 0001–0018 and verifies
  creator provisioning, token replay rejection, Argon2id-shaped grant creation,
  and revocation of creator/session access.
- The full local quality gate passes with the documented
  `QUALITY_GATE_NO_SMOKE=1` Debian 11/ADR-281 path; a controlled live-stack
  invite journey remains before this plan can be marked complete.

## Acceptance criteria

- [x] A fresh D1 database can be provisioned through the documented migration set.
- [x] A creator invitation requires no pre-existing active grant; an existing
      active grant is refused rather than silently changing its password.
- [x] Pages deployments use the D1 invitation rate-limit fallback.
- [x] An administrator can invite a reader without a pre-existing `users` row.
- [x] An administrator can invite a creator; the creator gains read access and
      `/creator` access only after acceptance.
- [x] Copy-link delivery works when `EMAIL_SEND` is absent and clearly reports
      manual delivery.
- [x] Raw invitation tokens are absent from captured logs, audit rows, and error
      responses.
- [x] Expired, revoked, replayed, and cross-book tokens fail closed.
- [x] Existing grants, reader sessions, offline queues, and creator permissions
      remain backward compatible.
- [x] New copy exists in English and all 13 locale catalogs.
- [ ] Unit, route, component, live-stack, accessibility, workflow, and quality
      gates pass (local quality gate passes; live browser verification remains).

## Risks and mitigations

| Risk                                 | Mitigation                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Token leakage through URLs/logs      | Fragment-based link, immediate history cleanup, no body logging, redaction tests              |
| Duplicate user/grant/assignment      | Transactional acceptance and unique constraints; idempotent mutation outcome                  |
| Existing grant password overwritten  | Refuse conflicting active grants; require an explicit reset path                              |
| Pages email binding unavailable      | Hybrid delivery with copy-link fallback and honest status                                     |
| Creator over-assignment              | Assignment only after scoped token acceptance; server-side creator gate remains authoritative |
| Legacy identity migration regression | Additive user link only; retain existing grant/session lookup by normalized email             |
| Partial D1/R2/audit failure          | Transactional database mutation; no R2 object is created by this feature                      |

## Verification commands

```bash
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm test:e2e:smoke
./scripts/quality_gate.sh
./scripts/validate-workflows.sh
```

The live invite journey must use a controlled non-demo account and must not put
credentials or tokens in tracked files, test logs, or CI output.

## Definition of done

A production operator can create a book, invite a reader or creator, deliver the
invitation through email or a secure copy link, and observe the recipient reach
the correct workspace. The full path is auditable, private, replay-resistant,
accessible, localized, and backward compatible with existing grants.
