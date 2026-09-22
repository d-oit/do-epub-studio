# GOAP-273: Wave 4 — real editorial engines (spelling/grammar/story/logic)

**Status:** PLANNED
**Date:** 2026-09-22
**ADR:** ADR-999 D4/D5 + §3 corpus (`plans/999-adr-reader-creator-editorial-contract.md`); A1 decision → ADR-274 (`plans/274-adr-languagetool-local-editorial-engine.md`)
**Out of scope (tracked):** React test/component warnings → issue #1175

## Context

Wave 4 turns the consent-gated, engine-less scaffolding into qualified,
evidence-backed review assistance:

- `packages/reader-core/src/ai/types.ts` already defines the injected seam
  (`EditorialReviewCapability.review()` + `hasEngine()`); the request carries
  only chapter text, source SHA-256, retained references, style revision and
  BCP-47 language.
- `editorial-findings.ts` validates every result (out-of-range spans, stale
  hashes, invented reference IDs and malformed findings are rejected before
  render/persistence) and distinguishes clean runs from
  `unavailable`/`needs review`.
- `qualification.ts` gates availability on **evidence**, not config: both
  milestones (`local-engine`, `cloud-provider`) ship UNMET, and a milestone
  flip alone cannot make a category read available while `hasEngine()` is false.
- `plugins/local-editorial.ts` intentionally returns `engine_missing`;
  `POST /api/creator/books/:bookId/assistance/dispatch` answers 501.

ADR-999 D5 authorizes exactly two research candidates: a **self-hosted
LanguageTool HTTP server** for deterministic spelling/grammar (the public free
API prohibits automated use) and a **quantized, on-demand local inference
engine** via the injected seam for story/logic. Cloud is a separate recorded
milestone and never a timeout fallback. No model/WASM assets may enter the app
precache (GOAP-262's ~23MB-bundle rejection stands).

## Phases

| # | Phase | Exit criteria | Status |
|---|-------|---------------|--------|
| 1 | **A1 — LanguageTool spike + decision**: run the official self-hosted HTTP server in the devcontainer, pin version, review licence, decide deployment shape (deployment-local vs browser-offline labelling per D5) in a new ADR; verify Java runtime availability for dev + CI | Server answers its check endpoint locally; corpus harness executes items 1/2/4/6/7/8 against it; ADR merged | DONE (2026-09-22: LT 6.9-SNAPSHOT on `127.0.0.1:8081` via `scripts/dev/languagetool.sh` (pin sha256 `8efc9fca…9b13d`, loopback, LGPL-2.1); `scripts/dev/languagetool.sh corpus` → 6/6 PASS items 1/2/4/6/7/8, latencies 54–256ms; Java via Temurin-17 fallback after bullseye apt 404 → ADR-274) |
| 2 | **A2 — Editorial engine adapter (spelling/grammar)**: plugin implementing `EditorialReviewCapability` with a real health-probe `hasEngine()`; LanguageTool match → `EditorialFinding` mapping (cited spans, minimal replacement, severity, uncertainty); approved names/invented terms/dialect/glossary preserved (no standardization of dialogue); every result passes `validateEditorialFindings` | Unit tests green; opt-in live corpus run green (E2E_LIVE-style, skipped in default CI); `engine_missing` replaced only where the engine truly answers; consent gate untouched | NOT STARTED (deps: A1) |
| 3 | **A3 — Local qualification milestone (spelling, grammar)**: record D5 evidence — supported languages, host/device, latency, memory, service download size + licence, no-egress observations — then flip `local-engine` categories to spelling+grammar **only** | Evidence recorded in this plan; the `qualification.ts` flip is a small reviewable diff; availability UI degrades honestly when the service is down (`hasEngine()` false) | NOT STARTED (deps: A2) |
| 4 | **B1 — Quantized Transformers.js engine (story/logic)**: injected-seam implementation, lazy on-demand load (labelled download, never precached), `device: 'webgpu'`, `dtype: 'q4'/'q8'`; cross-chapter citations with reasoned questions; incomplete context returns `needs review`; corpus item 6 (prompt injection) quoted, never obeyed | Corpus items 3/5 green in a live run; bundle baseline unchanged (no model/WASM precache); on-demand download visible to the user | NOT STARTED (independent of A-track) |
| 5 | **B2 — Story/logic milestone flip** with the same evidence discipline as A3 | Evidence recorded; flip is reviewable and category-scoped | NOT STARTED (deps: B1) |
| 6 | **C — Cloud opt-in (separate recorded milestone)**: deployment-configured allowlisted provider, creator per-book permission, per-dispatch user confirmation, dispatch 501 → real, provider passes the same corpus; retention/training terms checked against official docs first | Separate ADR + provider corpus evidence; cloud is never a fallback path | DEFERRED (explicitly separate per D5) |
| 7 | **Synthesis**: update GOAP-999 rows AI-01…AI-03, dogfood the reader→creator loop, capture learnings (Tier 2 #12) in the PRs that produced them | Plan 999 rows updated; learnings recorded | NOT STARTED |

## Execution strategy

**Hybrid**: A-track (1→2→3) is strictly sequential (each phase depends on the
previous); B-track (4→5) is independent of A and can run in parallel after the
seam contract is confirmed unchanged. C is deferred until A and B have proven
the evidence discipline once. Quality gate runs after every phase PR;
corpus evidence is committed as test fixtures + plan updates, never as prose
claims.

## Acceptance (unchanged from ADR-999 §3)

Real-engine runs over corpus items **1–8** plus human creator review for style
quality; synthetic fixtures remain permitted only for UI/error/consent
behaviour and must be labelled. Boundary checks (403s, EPUB bytes unchanged,
offline compose → exactly one server item, revoked-replay blocked) stay green.
"No supported finding" must remain distinct from unsupported language, missing
engine, timeout, refusal and incomplete analysis.

## Risks

- **Java runtime** for the official LanguageTool server may be absent from the
  devcontainer/CI images — A1 verifies before anything depends on it; if it
  cannot be added cleanly, the ADR records the alternative.
  *Resolved by A1/ADR-274: JRE provisioning cascade (system ≥17 → apt
  openjdk-17 → Temurin-17 tarball) covers stale images (bullseye apt 404
  observed); no JRE in CI — corpus runs are opt-in dev-side.*
- **story/logic downloads** are network events: on-demand, labelled, and never
  precached; processing itself stays deployment-local/browser-local as
  claimed, and the UI must not imply offline availability it does not have.
- **Milestone flips are reporting-only**: any PR that touches
  `qualification.ts` must show `hasEngine()` evidence in the same diff or the
  availability claim is dishonest by construction.
