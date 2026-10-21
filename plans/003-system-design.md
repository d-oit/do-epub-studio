# System design — session-bound offline teardown

**Scope:** GOAP-1002 S1 local logout persistence and sync replay. This design does not change server authorization, signed-file policy, or deployed behavior.

## Component contracts

- **Auth store:** The current session token is the authority for local sensitive writes. Clearing or replacing it ends the previous session locally.
- **API client:** Track authenticated request _handles_ (never bearer-token strings) and abort them when the session token changes. Aborting a browser request does not prove the server did not already process it.
- **Offline writers:** Capture the owning token before asynchronous work and re-check it immediately before starting each IndexedDB write transaction, through the shared `captureSessionToken()` / `assertSessionToken()` helpers in `lib/offline/db.ts`. A stale operation rejects with `Session expired` instead of persisting after purge. A missing session keeps the pre-existing `Authentication required for sensitive offline storage` message.
- **Reader logout:** Cancel scheduled sync retries, clear auth state, then purge encrypted IndexedDB stores and the `book-content` cache. Auth-loss teardown already clears auth before its asynchronous purge.
- **Verification:** A deterministic local test delays encryption, performs auth loss and purge, releases encryption, and asserts the late write cannot recreate a row. API tests cover aborting in-flight authenticated requests on session change. A browser spec drives the visible sign-out control and asserts the seeded rows and the `book-content` cache are gone.

## Resolution and limits

This uses time separation for logout ordering and condition separation at each write boundary. Active-session writes remain available; work from a replaced session cannot commit locally. Existing sync session checks remain in place. An already accepted server mutation is outside the browser cancellation guarantee. No claim is made about cross-account ciphertext readability or production deployment.

## Implementation status (2026-10-20)

Implemented and locally proved. `analysis/triz-core-2026-10-20.md` records the two contradictions and their resolution; `plans/1002-goap-security-control-validation.md` records the proof commands and results.
