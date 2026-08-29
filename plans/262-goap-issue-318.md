# GOAP-318 — AI-Assisted Features Plugin Architecture

Issue: [#318](https://github.com/d-oit/do-epub-studio/issues/318) — closed 2026-05-26 with
"Plugin architecture design deferred - will be addressed in a future architecture sprint".
**No architecture, interfaces, extension points, or PoC existed on main** (verified 2026-08-29).
This sprint implements the deferred architecture.

## Goal

Deliver the four body acceptance criteria:

1. AI features can be added as plugins.
2. User must opt-in to AI features.
3. Processing is local-first.
4. Architecture documented (this doc + ADR section).

## ADR

- **Chosen**: client-side plugin architecture in `packages/reader-core/src/ai/`
  (reader pipeline extension point per the body — the body overrides the
  execution-plan fallback of a worker-side registry; divergence recorded here):
  - `types.ts` — `AiPlugin` + capability interfaces:
    `TextProcessingCapability` (summarize), `ImageProcessingCapability`
    (OCR), `AudioProcessingCapability` (TTS), typed errors
    (`AiPluginNotFoundError`, `AiPluginRegistrationError`, `AiNotEnabledError`,
    `AiProviderUnavailableError`).
  - `registry.ts` — singleton `registerAiPlugin` / `getAiPlugin` /
    `listAiPlugins` / `unregisterAiPlugin`; duplicate-id and unknown-id errors.
  - `consent.ts` — opt-in gate, default **off**, injectable storage adapter
    (localStorage in browser, no-op elsewhere); every capability invocation
    refuses while consent is absent.
  - `plugins/local-summarization.ts` — proof-of-concept plugin with an
    **injected inference engine** (dependency inversion). Without an engine it
    fails closed with `AiProviderUnavailableError`; with one, it enforces
    consent, trims input, and returns typed results with metadata.
  - Web wiring: `reader.aiEnabled` preference (persisted, default off) with an
    opt-in toggle in the reader settings panel; `initAiPlugins()` in
    `main.tsx` registers the plugin and mirrors the preference into the
    consent gate. 13 locales gained `reader.settings.ai.*` keys
    (i18n-parity enforced).
- **Rejected**: bundling Transformers.js as the PoC runtime — Vite emits the
  lazy chunk plus the onnxruntime-web WASM asset (~23 MB) unconditionally, and
  vite-plugin-pwa's `injectManifest` hard-fails beyond its 2 MiB precache
  limit, breaking the PWA build; a CDN/importmap runtime loader (new unvetted
  network dependency for a local-first feature); a worker-side registry
  (body mandates reader-core extension points); a new `@do-epub-studio/ai`
  package (speculative split). **Consequence**: the Transformers.js engine
  itself is follow-up architecture-sprint work (consistent with the
  maintainer's deferral); it plugs into the engine slot with no API change.

### Local-first contract

Inference runs on-device; book text never leaves the device. The consent gate
is the only unlock for any capability — there is no silent or background AI
path, and no network fallback when the engine is unavailable.

## Implementation steps (this sprint)

1. `packages/reader-core/src/ai/{types,registry,consent,index}.ts` +
   `ai/plugins/local-summarization.ts`; export `ai` from
   `packages/reader-core/src/index.ts`.
2. Web wiring: preferences slice + settings toggle + `initAiPlugins()`;
   i18n keys in 13 locales.
3. Tests (reader-core, 75% floor): registry register/lookup/unknown-id/
   duplicate/unregister; consent default-off + opt-in + throwing-storage
   fallback; plugin consent refusal, fail-closed engine-less path, engine
   success/pass-through/empty-output/failure paths.

## Acceptance → Evidence

| Acceptance (issue body) | Test / artifact |
|---|---|
| AI features can be added as plugins | `ai-registry.test.ts` (register/lookup/list/unregister) |
| User must opt-in | `ai-consent.test.ts` (default off, gate enforced) + `ai-local-summarization.test.ts` (refusal before consent) |
| Processing is local-first | ADR local-first contract; no network path in capability code |
| Architecture documented | This doc + ADR section; ADR-INDEX cross-reference |

## Effort

L (this sprint). Branch: `feat/issue-318-goap-plan`. PR references #318.
