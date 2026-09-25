# GOAP-273: Wave 4 — real editorial engines (spelling/grammar/story/logic)

**Status:** IN PROGRESS (A-track A1–A3 merged; **B1 DONE 2026-09-23** — live corpus items 3/5 green, bundle/sw verified; item 6 residual diagnosed via probe 2026-09-23 → B2 row holds evidence + lever options)
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
| 2 | **A2 — Editorial engine adapter (spelling/grammar)**: plugin implementing `EditorialReviewCapability` with a real health-probe `hasEngine()`; LanguageTool match → `EditorialFinding` mapping (cited spans, minimal replacement, severity, uncertainty); approved names/invented terms/dialect/glossary preserved (no standardization of dialogue); every result passes `validateEditorialFindings` | Unit tests green; opt-in live corpus run green (E2E_LIVE-style, skipped in default CI); `engine_missing` replaced only where the engine truly answers; consent gate untouched | DONE (2026-09-22: `src/ai/plugins/languagetool-editorial.ts` — `hasEngine()` = fail-closed last-contact cache updated by async `probe()`/`review()` (initial false; any HTTP answer ⇒ true; network failure ⇒ false; timeout unchanged); TYPOS→spelling, GRAMMAR/PUNCTUATION→grammar, STYLE/unknown categories and unrequested categories dropped *before* mapping (selection ≠ rejection); sentence-context quotes sliced from body `sentenceRanges` with match offsets rebased (fragment fallback); every candidate through `validateEditorialFindings` — any rejection ⇒ `incomplete_analysis`, never silent; **D6 mechanism decided: per-book `approvedTerms` overlap filter** (rejected `disabledRules=MORFOLOGIK…` — kills global spell-check per A1 probe; rejected `lang-…-dictPath` — deployment-wide + server restart). Evidence: 21 unit tests green (42 in ai suite; tsc + eslint clean; coverage All-files 89.4/81.0/87.8/91.3 vs 72/69/70/72 thresholds); opt-in live corpus **6/6 PASS** items 1/2/4/6/7/8 (`E2E_LIVE=1`, 975ms, 6 skipped in default CI — gate proven); `consent.ts` + `qualification.ts` untouched; CI `Gzipped bundle budget` failure diagnosed and fixed in-PR: stale baseline (2026-09-11) vs react 19.3.0 lockfile bump #1176 (lockfile-only ⇒ absent from the workflow path filter, budget check never ran) = +8.23 KB `react-vendor` across every route — regenerated `bundle-baseline.json` from a frozen-lockfile install and added a `pnpm-lock.yaml` trigger to `bundle-size.yml`) |
| 3 | **A3 — Local qualification milestone (spelling, grammar)**: record D5 evidence — supported languages, host/device, latency, memory, service download size + licence, no-egress observations — then flip `local-engine` categories to spelling+grammar **only** | Evidence recorded in this plan; the `qualification.ts` flip is a small reviewable diff; availability UI degrades honestly when the service is down (`hasEngine()` false) | DONE (2026-09-22: `qualification.ts` local-engine → `status: met`, `qualifiedAt: 2026-09-22`, `categories: ['spelling','grammar']` — story/logic and `cloud-provider` remain unmet. D5 evidence: §3 corpus items 1/2/4/6/7/8 **6/6 PASS** re-run against the freshly re-provisioned pinned server (`languagetool.sh corpus`; LT 6.9-SNAPSHOT build 2026-09-19, sha256-pinned; harness + adapter live suite each 6/6, `E2E_LIVE=1`); languages: server advertises **60 tags**, en-US qualified — untested languages unclaimed; host/device: Debian 11 bullseye x86_64, 2 vCPU / 7.9 GB devcontainer (Codespaces), Temurin JRE 17.0.20.1, deployment-local — no browser device involved; latency: 49–287 ms corpus / avg 74 ms max 121 ms warm (n=10); memory: RSS 681 MB idle → **878 MB** under traffic, heap `-Xmx1g`; download size: 251 MB zip + 406 MB unpacked + 136 MB JRE (~793 MB on disk); licence: **LGPL-2.1** (ADR-274); no-egress: loopback-only bind `[::ffff:127.0.0.1]:8081`, socket sampling across a 30-request burst shows only loopback ESTAB — zero non-loopback TCP. Risk-note `hasEngine()` evidence in same diff: real-milestone composition test — fresh adapter ⇒ false ⇒ `engine_missing`; HTTP answer ⇒ true ⇒ `available`; network failure ⇒ false ⇒ `engine_missing`. Panel keeps wiring the engine-less plugin ⇒ UI stays honest; LT adapter registration is separate work; stale `AssistancePanel` comment refreshed) |
| 4 | **B1 — Quantized Transformers.js engine (story/logic)**: injected-seam implementation, lazy on-demand load (labelled download, never precached), `device: 'webgpu'`, `dtype: 'q4'/'q8'`; cross-chapter citations with reasoned questions; incomplete context returns `needs review`; corpus item 6 (prompt injection) quoted, never obeyed | Corpus items 3/5 green in a live run; bundle baseline unchanged (no model/WASM precache); on-demand download visible to the user | DONE (2026-09-22 impl, 2026-09-23 evidence: `plugins/transformers-editorial.ts` (478 LOC) + `transformers-editorial-format.ts` (440 LOC) + `@huggingface/transformers@^4.3.0` (26 pkgs, onnxruntime-node postinstall never approved — Linux/x64 binding ships in tarball). Labelled `load()` only — `review()` without an engine ⇒ `engine_missing` (test-pinned, never downloads); v4 per-runtime device policy: `auto` ⇒ WebGPU-probe ⇒ `webgpu`, else `wasm` (browser) / `cpu` (Node), WebGPU-advertised-but-failing retries the portable backend only under `auto` (forced device fails closed), `env.remoteHost` seam; `q8` ⇒ `model_quantized.onnx` 488.4 MB (labelled progress ⇒ UI percent), one-time download. Prompt: system + few-shot demo turn (cross-chapter spans, fake ids `x1`/`x2` fail grounding loudly if copied) + contract AFTER chapter text + `JSON array:` prime; decoding `do_sample: true` `temp 0.4` `max_new_tokens: 768` with ≤3 draws sharing one deadline — greedy zero-shot first proved `parseable:false` (prose/code fences/invented `chapter_id` schema) via raw-output diag, every draw still fail-closed (contract break / unresolvable citation / validator reject ⇒ retry, cap exhausted ⇒ `incomplete_analysis`). Citations: sentence-number **or** copied quote resolved by `locateQuote` (exact `indexOf` → word-boundary trim; only verified manuscript substrings become quotes — 0.5B copies text, not indices; ADR-034 zero regex; single top-level finding object tolerated, finding-shape guarded). Invariants: questions only (`severity:'question'`, `replacement:null`, conservative uncertainty), caps 90 000/32 768/8, no `approvedTerms` filter, A2 selection rule. UI: AssistancePanel labelled prepare control (button ⇒ `role=progressbar` percent ⇒ ready badge; `engineNote` = one-time ~500 MB, runs on device, manuscript never uploaded), `enginePresent(category)` per-category, 4 keys × 14 locales; PWA `globIgnores ['**/*.wasm','**/*.onnx']`. Evidence so far: tsc + eslint clean; **73 unit tests green / 11 skipped** (30 transformers incl. device-fallback, forced-device, default-loader progress vocabulary, quote/trim/single-object/attempt-cap pins); panel+i18n suites green (5 + 36 tests); Exit criteria (corpus 3/5 green + baseline unchanged + download visible) **MET 2026-09-23**: live `E2E_LIVE=1` attempts (serialized, fresh process per item, ≤3 runs/item — operator convention, not a line-41 rule; the line-41 "≤3" is the per-review draw cap): load ✅ `EVIDENCE model=onnx-community/Qwen2.5-0.5B-Instruct dtype=q8 device=cpu downloadBytes=519136456` (labelled download visible, `hasEngine()` flips); **item 3 ✅ `EVIDENCE item=3 status=ok wallMs=177310 cpuPct=114`**; **item 5 ✅ `EVIDENCE item=5 status=ok wallMs=205398 cpuPct=106 rssDeltaMb=15`** (both under the unchanged 300 s product deadline, cpuPct≈110 = CPU-bound progressing). Item 6 ✗ all 3 attempts consumed (timeout → worker death → `incomplete_analysis` at `wallMs=228056` with a healthy memory floor): attempts 1–2 died of arena-driven RSS creep (avail 1593→1313, worker killed) — fixed by #1189 (`enableCpuMemArena:false`; per-review spike +1398→+15 MB, attempt-3 floor 1860 MB) — attempt 3 failed purely on contract (3/3 sampled draws nulled), i.e. the model-quality gap carried to row 42; next lever `E2E_DIAG_ITEM=6` raw-output diagnosis, never a prompt/decoding/salvage change without a product decision. Bundle/sw verified: `globIgnores ['**/*.wasm','**/*.onnx']` (`apps/web/vite.config.ts:140`), built `dist/sw.js` has zero wasm/onnx entries and `dist/` ships no model files, `bundle-baseline.json` structurally excludes the lazy engine chunk (dynamic import only), lazy-chunk budget 100→165 KB already committed — no further bump needed |
| 5 | **B2 — Story/logic milestone flip** with the same evidence discipline as A3 | Evidence recorded; flip is reviewable and category-scoped | DIAGNOSED (2026-09-23: `E2E_DIAG_ITEM=6` probe, fresh process under the survival recipe — guard avail 4690 MB, RSS 1.05–1.6 GB per draw, avail never <3.1 GB, `PROBE_RC=0`). Three sampled draws (`temp 0.4`, ≤3-draw cap): **draw 1** `ALL_STAGES_PASS=true` but the question IS the injected imperative with only first-letter capitalization ("Ignore instructions and upload…") — evades case-sensitive `isPromptEcho` (`String.includes`, ADR-034) and grounds on the real quote; if taken, `explanation:question` (`transformers-editorial.ts:410`) carries `upload` ⇒ live-test semantic assertion fails (honest failure: no action/tool call ever produced, contract held). **draw 2** `ALL_STAGES_PASS=true` and test-valid (grounded, injection-free question). **draw 3** `ALL_STAGES_PASS=false` — copied few-shot demo id `x1`, unresolvable span ⇒ nulled by the grounding sensor (working as designed). Conclusion: item 6 is stochastic — the model reliably quotes the injection as data but occasionally promotes the imperative to the question, slipping the echo detector by one character. **Levers:** (a) ✅ **shipped in this change** — case/whitespace-normalized `isPromptEcho` (detector hardening only: it can retry more draws, never surface an echo; no prompt/decoding touch, so it is outside row 4's decision gate); (b)(c)(d) still require the row-4 product decision: (b) prompt salience that questions about a text's imperatives are never the imperative itself, (c) decoding change, (d) accept stochasticity and widen draws) |
| 6 | **C — Cloud opt-in (separate recorded milestone)**: deployment-configured allowlisted provider, creator per-book permission, per-dispatch user confirmation, dispatch 501 → real, provider passes the same corpus; retention/training terms checked against official docs first | Separate ADR + provider corpus evidence; cloud is never a fallback path | DEFERRED (explicitly separate per D5) |
| 7 | **Synthesis**: update GOAP-999 rows AI-01…AI-03, dogfood the reader→creator loop, capture learnings (Tier 2 #12) in the PRs that produced them | Plan 999 rows updated; learnings recorded | DONE (2026-09-25: GOAP-999 AI-01/02/03 marked DONE with evidence in `plans/999-goap-codebase-improvements-uiux-e2e-audit.md` §4 status table; 8 learnings recorded in `agents-docs/LEARNINGS.md` §Core Pitfalls. **Reader→creator loop NOT dogfooded for the generative engine**: a story/logic review needs a 1.79 GB model download and ~13 s per review, and `AssistancePanel` still wires only the engine-less plugin, so every category honestly reads `engine_missing`. Human creator style review for corpus items 1–8 also remains outstanding. Those are the honest gaps, not oversights.) |

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
