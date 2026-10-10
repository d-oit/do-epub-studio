# GOAP-1006: Scheduled-lane E2E repairs — manifest version, demo copy, encrypted seed, invitation race

**Status:** DONE (2026-10-10)
**Date:** 2026-10-10
**Type:** Pre-existing CI failure repair (AGENTS.md Tier 1: "CI check failures are
pre-existing issues … must be fixed in the current changeset")
**Trigger:** the scheduled `CI` runs on `main` failed on 2026-10-04/05/06/07/09/10
(`Scheduled Cross-browser E2E`), most recently run
[38037282055](https://github.com/d-oit/do-epub-studio/actions/runs/38037282055)
(16 failed / 721 passed).
**Related:** ADR-218, ADR-312, ADR-309 (D1), GOAP-1000/1003 (E1), S2 of #1284
(PR #1284, commit `0203c067`), `agents-docs/LEARNINGS.md`

## Goal

Make the nightly cross-browser lane green again by fixing the _sources_ of the
failures — not by loosening assertions. The lane's whole purpose is to catch
what the PR lanes skip, so any test touched here must keep asserting the same
consumer-visible behaviour.

## Evidence (before)

Reproduced locally at `main` (`65685ac5`) with the lane's own environment
(`PLAYWRIGHT_MODE=preview`, `VITE_DEMO_LOGIN_ENABLED=1`, `E2E_DEMO_LOGIN=1`,
`PLAYWRIGHT_INCLUDE_WEBKIT=1`):

| Spec                                    | Symptom                                                                                            | Root cause                                                                                                                                                                                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-identity-responsive.spec.ts:26`    | `manifest.version` — `Expected "0.1.0", Received undefined` (all 3 browsers)                       | `#1284` (E1) replaced the guarded/vacuous block with a hard assertion; the built `dist/manifest.webmanifest` never carried `version` because `0203c067` had added it only to the dev-only `configureServer` middleware                                                     |
| `demo-login.spec.ts:54`                 | `getByText('Demo login is not available.')` not visible                                            | `#1279` (ADR-309 D1) intentionally renders the localized `login.demoUnavailable` copy via `role="alert"`; the spec still expected the old raw server message                                                                                                               |
| `reader-progress.spec.ts:138`           | wait for `reader.progress_loaded … "source":"offline"` times out; telemetry shows `source=default` | `#1284` (S2) made `decryptEntry` refuse plaintext rows with sensitive fields; the spec seeded a **plaintext** progress row, so the offline fallback correctly ignored it                                                                                                   |
| `login-responsive-controls.spec.ts:247` | `toggle contained in password field` false (chromium, both CI attempts; also flaky locally)        | single post-click `boundingBox()` snapshot races the theme-flip layout change                                                                                                                                                                                              |
| `invitation-flow.spec.ts` (webkit)      | "Invitation unavailable" instead of the password form; 2 failed + 2 flaky locally over 4 repeats   | `AcceptInvitePage` scrubbed `location.hash` **during render** (ref-guarded). React can execute a render it later discards (concurrent interrupt / Suspense retry): the fragment was already wiped when the surviving instance read it. WebKit hits the race intermittently |

## Fixes

1. **One PWA manifest definition** (`apps/web/vite.config.ts`): `pwaManifest`
   feeds both `VitePWA({ manifest })` (build → preview/production) and the
   `app-identity-html` dev middleware (`vite-plugin-pwa` does not serve the
   manifest in dev without `devOptions.enabled`). The field can no longer drift
   between lanes.
2. **Honest-state assertion** (`apps/tests/demo-login.spec.ts`): assert the
   `role="alert"` region carries the ADR-309 D1 copy — same behaviour, real
   contract.
3. **Encrypted seed** (`apps/tests/reader-progress.spec.ts`): encrypt the
   progress payload with the app's own `encryptJSON` (Node-side import from
   `apps/web/src/lib/offline/crypto`) and store
   `{ id, bookId, synced, encryptedPayload }` — exactly the `encryptEntry`
   shape. The security control stays; the seed becomes realistic.
4. **Render-safe token read** (`apps/web/src/features/invitations/AcceptInvitePage.tsx`):
   pure read in a `useState` initialiser, scrub in an idempotent effect.
5. **Geometry re-measure** (`apps/tests/login-responsive-controls.spec.ts`):
   `expect.poll` on the containment invariant instead of one snapshot.

## Verification (after)

| Run                                                    | Result                                             |
| ------------------------------------------------------ | -------------------------------------------------- |
| chromium preview — the 4 repaired specs                | **68/68 passed**                                   |
| firefox preview — the same 4 specs                     | **68/68 passed**                                   |
| webkit preview — `invitation-flow` × 8 repeats         | **48/48 passed** (was 2 failed + 2 flaky per 4)    |
| `AcceptInvitePage` unit suite                          | 3/3 passed                                         |
| `scripts/__tests__` (incl. ADR-index validator)        | 69/69 passed                                       |
| `pnpm --filter @do-epub-studio/web lint` + `typecheck` | clean                                              |
| built `dist/manifest.webmanifest`                      | `version: 0.1.0`, 2 icons (previously `undefined`) |

## Cross-references

- The benchmark gate noise fix that also surfaced during this repair window is
  ADR-312 (`plans/312-adr-benchmark-regression-gate-noise.md`) — a separate
  decision with its own evidence.
- Learnings recorded in `agents-docs/LEARNINGS.md` (PWA manifest divergence,
  encrypted-seed contract, WebKit env gate, render-phase scrub, geometry race).

## Out of scope

- The pre-existing flake taxonomy beyond the four specs above (the lane's other
  721 tests passed).
- Chromatic's `UI Tests` baseline backlog (non-required check, human decision).
