# GOAP-1002: Security control validation and remediation contracts

**Status:** DONE — S1/S2/S4 implemented 2026-10-05 (user-authorized); S3 stays evidence collection, deployed validation outstanding
**Date:** 2026-10-04
**Type:** Security control-gap backlog (source review only; no policy change)
**Source audit:** `plans/1000-goap-implementation-security-e2e-feature-audit.md`
— GOAP-1000, findings S1–S4
**Governance:** `plans/1000-adr-audit-evidence-and-scope.md` (ADR-1000)
**Related:** GOAP-1003 (`plans/1003-goap-e2e-behavior-proof-gaps.md`) — E1/E4 do
not certify these controls; `SECURITY.md` (private reporting),
`docs/security-posture.md` (adopted posture)

## Goal

Publish safe, source-level control gaps and the private validation contracts
that would close them, without changing standing security policy and without
reproducing any vulnerability. Runtime and deployed-security proof is
unavailable in this documentation-only work; that is stated rather than
manufactured, and it does not defer the roadmap.

Handling rules for this record:

- Safe control-gap descriptions and synthetic fixtures only. No reusable
  credentials, signed URLs, payload recipes, exploit probabilities or severity
  certification.
- `SECURITY.md:12–18` requires private reporting for an actual vulnerability. No
  public issue or advisory is opened here, and publication of this record is not
  a disclosure.
- Source review and publication proceed without live accounts or Cloudflare
  credentials.
- A newly demonstrated exploit would follow private `SECURITY.md` disclosure
  before any public mechanics are written.

## S1 — Sign-out and device-data teardown

| ID  | Priority and classification                                                          | Read anchors                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Future acceptance contract                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | P1, logout/device-data teardown gap; source-only, cross-account readability unproven | `apps/web/src/features/reader/ReaderPage.tsx:299–315`, `apps/web/src/stores/auth.ts:88–119` — `logout` runs inside the `persist` wrapper and `partialize` persists exactly the fields it nulls, so persisted auth state is cleared; what is missing is reader-data and cache teardown. `lib/offline/db.ts:395–408` purge primitive has no production caller and omits `feedbackDrafts`; `apps/web/src/sw.ts:152–161,238–252` book cache and unused clear-message receiver | Manual sign-out and auth-loss teardown must clear sensitive reader state, owner-scoped persisted rows and book-related caches. Stop in-flight persistence/replay before clearing. Do not clear application-shell assets merely to hide the issue. |

Acceptance proof: seed authenticated annotations, insights, feedback and the
file cache → sign out → the prior sensitive stores and book cache entries are
absent → another account or an offline route cannot render the prior cached
book. A purge failure must never preserve authenticated UI; show and log an
honest device-cleanup failure rather than claim successful removal.

Recorded limit: retained encrypted ciphertext alone is not proof that another
account can decrypt it. No cross-account readability is claimed here.

## S2 — Fail-open at-rest persistence

| ID  | Priority and classification                                                | Read anchors                                                                                                                                                                                            | Future acceptance contract                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S2  | P1, fail-open at-rest persistence; source-only, production race unobserved | `apps/web/src/lib/offline/db.ts` returns unencrypted entries when no token is present and accepts stored entries with no encrypted payload; the annotation writer at `db.ts:293–297` inherits the guard | Sensitive store writes must require a valid current session, and sensitive-store reads must refuse plaintext or undecryptable rows. No silent plaintext fallback, no silent dropping of authored work, and no bypass of the existing session ownership guard. |

Acceptance proof: with no session, an attempted authored-text persistence writes
no row and reports "not saved"; an authenticated write contains an encrypted
payload and no sensitive plaintext; a legacy plaintext row is not displayed.

Recorded test detail: the null `setTokenOverride` value falls back to the auth
store, so the negative case must clear the actual auth session as well.

## S3 — Signed file capability: policy and acceptance question

| ID  | Priority and classification                                                | Read anchors                                                                                                                                                                                                                                      | Future acceptance contract                                                                                                                              |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3  | P2, signed-capability policy/acceptance question; not a proven auth bypass | `apps/worker/src/storage/signed-url.ts:6,91–106`, `routes/files.ts:12–39`; adopted `docs/security-posture.md:131–143` documents one-hour self-contained URLs, while archived ADR-004:43–47 describes an older TTL and session-validation contract | Privately validate and record what an already-issued capability does after session or grant revocation, and distinguish that from cached offline bytes. |

The current one-hour signed-capability posture is documented and adopted; this is
not a new finding merely because archived ADR-004 differs. This plan selects
**evidence collection**, not a new TTL or principal field. Any requirement for
immediate file-capability revocation must receive its own approved policy and
contract before implementation; do not claim that session revocation currently
proves file revocation.

## S4 — Same-email recovery resource binding

| ID  | Priority and classification                                           | Read anchors                                                                                                                                                                                     | Future acceptance contract                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S4  | P1, same-email recovery resource-binding correctness gap; source-only | `apps/worker/src/routes/access.ts:96–102,191–198` requests recovery for a book but verifies against the first live email grant; `auth/password.ts:217–227` query lacks book binding and ordering | Requested book A recovery must issue access for A, or fail closed when A is no longer allowed. It must never silently switch to another same-email book B. Token binding must be server-authoritative; a client-supplied slug is insufficient. |

Future deterministic proof: the same email has grants on A and B with B ordered
first → request A recovery → the session book and its capabilities are A; revoke
A before redemption → deny despite a live B grant; a reused token is denied. No
cross-account escalation and no probabilistic or nondeterministic runtime
behavior is claimed.

## Controls reviewed, no new defect established

Attributed to source review of the security-relevant surfaces:

| Control                                    | Reviewed surface                                | Result                                                                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session hashing and fresh grant resolution | `apps/worker/src/auth/`, access/session routes  | Argon2id-backed sessions; grants re-resolved per request; no defect established                                                                                                                      |
| Atomic grant/session revocation            | grant mutation paths                            | Grant changes revoke all sessions for that grant in one step; no defect established                                                                                                                  |
| Tenant isolation                           | book-scoped readers, URL `bookId` re-validation | Book scoping enforced at the route boundary; no defect established                                                                                                                                   |
| Resource- and expiry-bound file HMAC       | `storage/signed-url.ts`, `routes/files.ts`      | HMAC binds `bookId:fileKey:expires`; capability semantics are S3's question, not a bypass                                                                                                            |
| EPUB parser hardening                      | EPUB fetch/parse path                           | Allowlist, sandbox and time bounds present; no defect established                                                                                                                                    |
| Purpose-scoped single-use claims           | recovery and invitation tokens                  | Purpose-scoped, single-use, expiring; S4 concerns resource binding within one purpose                                                                                                                |
| Log scrubbing (correlation-preserving)     | `packages/shared/src/redact.ts`, client logger  | Scrubber verified at the shared boundary; no new logging defect established. Retention is a separate, **now unowned** question (upstream `7e0cbd6c` deleted the retention module, cron and plan 305) |

Explicitly not new findings:

- A8 and A12 remain existing acceptance owners with their recorded deployment
  requirements.
- localStorage bearer transport and the Pages rate-limiter limitation are
  accepted posture, not newly discovered bugs.
- The claim about CSRF is limited to what was reviewed: the token-based API
  boundary is not automatically attached as a cookie. It is not a certification
  that no CSRF surface exists anywhere.

## Implementation 2026-10-05 (user-authorized: "read plans/ and implement all missing tasks")

**Status:** DONE for the source-level contracts S1/S2/S4; S3 remains the
recorded policy/evidence question (no TTL, session-binding or revocation model
was changed).

- **S1.** `useReaderStore` gained `reset()`, and `stores/reader.ts` subscribes to
  the auth store so any authentication loss (manual `logout()` or a 401) wipes
  in-memory reader state. The subscription lives in the reader store so the
  dependency edge stays one-way (`reader → auth`); importing the reader store
  from `auth.ts` instead created a new madge cycle
  (`api/core → stores/auth → stores/reader → api/feedback → api/core`).
  `Response`/auth-loss teardown (`lib/api/core.ts`) clears encrypted IndexedDB
  rows via a dynamic import (kept off the shell bundle, ADR-107 §3) and deletes the
  `book-content` cache; `ReaderPage.handleLogout` additionally posts the
  service-worker `CLEAR_CACHE` message and reports an honest teardown failure.
  `clearAllEncryptedData()` includes `feedbackDrafts`. Verified by
  `apps/web/src/__tests__/logout-teardown.test.ts` (store reset + purge of
  progress, annotations, feedbackDrafts, bookFiles).
- **S2.** `encryptEntry` throws without a current session and `decryptEntry`
  refuses rows whose non-plaintext fields are unencrypted. Verified by new
  negative cases in `offline-db.progress-annotations.test.ts` and
  `offline-db.sync-permissions.test.ts`.
- **S4.** `password_reset_tokens.book_id` (migration 0020) binds reader magic
  links to the requested book; `verify-recovery` resolves the grant for exactly
  that book and fails closed otherwise, denying reused tokens. Verified by
  `apps/worker/src/__tests__/recovery.test.ts` (book-A deny when its grant is
  gone; 3-arg session binding) and `reset.test.ts` (book binding persisted and
  returned).
- **S3.** unchanged — evidence collection only. Runtime/deployed validation
  remains outstanding for S1/S2 race and revocation questions; no cross-account
  readability or severity claim is made.
