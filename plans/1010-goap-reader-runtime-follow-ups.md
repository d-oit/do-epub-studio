# GOAP-1010: Reader session stability and EPUB chapter navigation

**Status:** COMPLETE — local AUTH-01 and READER-01 acceptance verified (2026-10-18); no production deployment
**Date:** 2026-10-18
**Source audit:** [GOAP-1009](1009-goap-production-readiness-audit.md), local disposable runtime journey
**Governance:** [ADR-1009](1009-adr-production-readiness-evidence.md) and ADR-1000; priorities are scheduling order, not vulnerability severity

## Scope

Two user-visible failures reproduced in the fresh local Worker/D1/R2 and browser stack. The original audit was read-only; separately authorized remediation is limited to this repository and disposable local Worker/D1/R2. No production deployment, remote user data, or production secrets were used. Neither finding is attributed to the public deployment because its deployed SHA is unavailable.

## Findings and acceptance

| ID        | Priority / evidence | Source and observed behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Required acceptance                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01   | P1 / local-runtime  | `apps/web/src/lib/offline/permissions.ts:96–123` schedules `GET /api/access/validate-all` without an authorization token; `ReaderPage.tsx:287–290` starts the check. The Worker route at `apps/worker/src/routes/access.ts:477–485` requires auth. `apiRaw` at `apps/web/src/lib/api/core.ts:256–285` treats every 401 as auth loss and calls `logout('expired')`. In the local demo journey, a session whose D1 expiry was 2026-10-25 received `401 SESSION_INVALID` on the tokenless poll; the browser subsequently removed its session and redirected to `/login?error=session_expired`. | With a live authenticated local session, exercise at least two polling intervals: no invalid poll may clear the current session or private state. A genuinely rejected request carrying the current session token must still trigger the existing auth-loss teardown; a stale request must not terminate a newer session. Add regression coverage at the actual request/auth boundary. |
| READER-01 | P1 / local-runtime  | A seeded local EPUB and `book_files` row loaded successfully and exposed TOC `Start`. Selecting it navigated the rendition frame to `/read/section0001.xhtml`, where the Vite SPA shell appeared instead of chapter text. `Hello, EPUB world!` was not reached; reload/position restoration could not be completed. The initial audit did not establish root cause; the authorized investigation below found malformed navigation metadata in the tracked minimal EPUB fixture.                                                                                                             | Using a real valid EPUB in a local real-Worker browser journey, selecting TOC `Start` must render the corresponding chapter body inside the reader, not the app shell. The user must be able to navigate and reload with the same section/position restored and no reader error state. The test must assert chapter text and restored location, not only reader shell or toolbar.      |

## Existing evidence and boundaries

- Local `E2E_LIVE_DEMO=1` endpoint/login suite passed 4/4; it proves the demo endpoints and reader/admin shell, not chapter content.
- `offline-reader.spec.ts` and `offline-annotations.spec.ts` passed 6/6 in the PWA Chromium lane with mocked API responses and a separate generated EPUB fixture. That proves those offline fixtures, not the seeded local demo EPUB navigation path.
- `logout-teardown.test.ts` and API-client tests passed in the focused web suite. They cover store/cache teardown and token-bearing/stale 401s, not the tokenless periodic poll.
- The admin step-up boundary independently returned `428 STEP_UP_REQUIRED` for the local write probe; D1 and R2 counts remained unchanged.
- Cloudflare deployment identity and effective Pages bindings remain unavailable; public `DEMO_DISABLED` does not establish the cause of either local failure.

## Non-actions

- The original audit authorized no remediation. Separate user authorization on 2026-10-18 covered only AUTH-01 and READER-01; implementation and evidence are recorded below.
- Do not weaken auth-loss handling, ignore 401 responses, relax EPUB iframe sandboxing, or treat shell rendering as chapter proof.
- Keep every mutation on fresh local resources; do not use root `.wrangler/state` or production/preview data.

## Implementation and verification (2026-10-18; local-only)

### AUTH-01

- `setupZombieDetection` now sends the current session token as a Bearer credential, and `ReaderPage` starts/restarts the poll when both book and session token are present.
- Unauthorized teardown now runs only when the rejected request token is non-null and equals the current non-null session token. A tokenless 401 and stale-token 401 preserve the current session; a current-token 401 still uses the existing logout/private-data teardown.
- The local Chromium journey remained authenticated through at least two `GET /api/access/validate-all` responses (both 200), with the reader route and chapter content intact. Throwaway browser probe: 1 passed after 2m20s.

### READER-01

- Root cause: the generated minimal EPUB marked the nav document with `properties="nav"` on its spine `itemref` instead of its manifest `item`, and included the nav document in the spine. The EPUB parser therefore exposed an empty TOC and rendered the nav document as spine content; its relative `Start` link escaped to the Vite SPA shell. This was malformed fixture metadata, not a failure in the app's valid-EPUB Contents navigation.
- `packages/reader-core/src/__tests__/fixtures/generate.mjs` now writes manifest item properties; the minimal fixture marks its nav document correctly and excludes it from the spine. The fixture was regenerated. The sandbox was not relaxed and the app navigation implementation was not changed.
- The local real-Worker Chromium journey fetched the corrected R2 EPUB (200), selected TOC `Start`, displayed `Hello, EPUB world!` in the reader, stayed on `/read/demo`, then reloaded with the same CFI from Worker progress and the chapter still visible without reader alerts.
- The permanent Playwright regression selects `Chapter 2`, asserts its body, reloads, and verifies the persisted CFI and chapter body; parser regression asserts the nav document is not in the spine.

### Checks

- Web auth/reader focused Vitest: 3 files, 33 tests passed.
- Reader-core EPUB parsing Vitest: 19 tests passed.
- `apps/tests/reader-migration-smoke.spec.ts`: 3 Playwright tests passed.
- Web typecheck and ESLint on changed source/tests passed.
- Local auth-poll browser test: 1 Playwright test passed; it asserted at least two new validation responses were 200 and the live session remained authenticated after a 125-second wait.
- No production deployment or public-runtime claim; deployment identity and public demo behavior remain unverified.
