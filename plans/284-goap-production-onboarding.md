# GOAP-284: Production account and invitation onboarding

**Status:** DONE (2026-09-29 — all acceptance criteria met. Phases 0-5 implemented; Phase 5 drove the real Worker end to end, 13/13, and found a tenant-guard ordering bug in `GET /api/books/:id`, now fixed. The final criterion, browser verification of the invite/acceptance UI, was met by `apps/tests/invitation-flow.spec.ts` in PR #1256: 12 tests across chromium, firefox and webkit, which surfaced a real StrictMode bug in `AcceptInvitePage` that the unit and API lanes had both missed.)
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

| Phase | Work                         | Exit criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Contract and threat model    | ADR accepted; token, identity, delivery, and rollback decisions recorded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1     | Schema and token foundation  | Migration applies; token helpers pass unit tests; audit enum includes invitations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2     | Worker invitation APIs       | Create/list/resend/revoke/accept routes enforce step-up, scope, expiry, and replay rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3     | Email delivery and redaction | Configured transport sends; fallback is explicit; raw tokens never enter logs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4     | Admin and acceptance UI      | Reader/creator invite flow and acceptance route work at mobile and desktop sizes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5     | End-to-end verification      | Fresh non-demo account completes invite → read → feedback → creator review; revocation fails closed — **DONE** (2026-09-28, live stack, 13/13). Drive path: wrangler simulates the `send_email` binding locally and writes each message body to `/tmp/miniflare-*/email/email-text/*.txt`, so the accept URL is read off disk — the real delivery path, not an in-process shortcut. Verified: step-up gate (428) and not bypassable (401); invitation created for a fresh address; **raw token never on the wire** (no token field, `copyUrl: null`); token recovered from the message body; accept returns a live session; the accepted reader logs in and reads the book; feedback accepted in state `open`; the reader sees exactly their own item; the unassigned reader is refused the creator surface (403, COL-01 holds); revocation fails closed. **This run also found and fixed a real bug** — see `plans/284-phase5-verification-note.md` |
| 6     | Synthesis                    | `plans/999` status reconciled; non-obvious learnings recorded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

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
- [x] Unit, route, component, live-stack, accessibility, workflow, and quality
      gates pass. **Met.** Unit, route, component, accessibility and workflow
      gates pass (local quality gate green; web 1410/1410; worker 537/537). The
      live-stack leg is met at the API level: Phase 5 drove the real Worker on
      :8787 end to end (invite -> accept -> read -> feedback -> creator review,
      13/13) and found a real tenant-guard bug in `GET /api/books/:id`, now
      fixed. The **browser** leg is met by `apps/tests/invitation-flow.spec.ts`
      (12 tests across chromium, firefox and webkit), added in PR #1256. Writing
      that spec surfaced a real product bug that the unit and API lanes had both
      missed: `AcceptInvitePage` read the invite token inside a mount effect and
      then scrubbed the fragment, so React 18 StrictMode's double-invoked effect
      lost the token on its second pass and every invitee in dev saw
      "Invitation unavailable" with no console error. Fixed by reading the token
      once per component instance via a ref.

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
