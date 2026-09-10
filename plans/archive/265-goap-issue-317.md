# GOAP-317 — Offline Functionality E2E Tests

Issue: [#317](https://github.com/d-oit/do-epub-studio/issues/317) — CLOSED 2026-05-26 (COMPLETED)
Status: **Implemented on main; verified this sprint.**

## Goal

E2E coverage for offline reading, background sync, and cache behavior under
network simulation (ADR-005 Cache Storage + IndexedDB sync queue governs the
behavior under test).

## ADR

- **Chosen (as implemented)**: `apps/tests/offline-reader.spec.ts` (5 tests,
  `--project=chromium` compatible) driving the real PWA with Playwright
  network simulation: loads the reader online then survives an offline reload;
  offline/online status transitions; cached API responses served offline
  (NetworkFirst strategy); offline actions queued while the network is
  unavailable; queued mutations flushed after reconnection.
- **Rejected**: blocking the whole network with a single route (coarser than
  ADR-005's per-endpoint sync-queue semantics; per-endpoint simulation
  exercises the queue/flush contract directly).

## Acceptance → Evidence

| Acceptance | Test (`apps/tests/offline-reader.spec.ts`) |
|---|---|
| E2E covers offline reading | "loads reader page online then survives offline reload" |
| E2E covers background sync | "queues offline actions for sync when network is unavailable" + "flushes sync queue after reconnection" |
| E2E covers cache invalidation | "serves cached API responses while offline (NetworkFirst strategy)" |
| Tests pass in CI | spec included in `pnpm test:e2e` (sprint closeout run, 2026-08-29) |

## Effort

M (historical; verification only this sprint).
