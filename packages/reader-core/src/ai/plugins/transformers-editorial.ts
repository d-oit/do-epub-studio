/**
 * Quantized Transformers.js editorial engine for story + logic (GOAP-273
 * Phase B1; ADR-999 D4/D5).
 *
 * Runs `@huggingface/transformers` on-device with quantized weights: WebGPU in
 * the browser (WASM fallback) and the native `cpu` backend in Node for the
 * opt-in live corpus. v4's device vocabulary is environment-specific —
 * browsers validate {wasm, webgpu}, Node validates {cpu, webgpu, cuda} — so
 * `resolveInferenceDevice` mirrors that instead of hardcoding one value.
 * Book text never leaves the device; the only network events are the labelled
 * one-time model download and the runtime engine WASM fetch, both on-demand —
 * never precached (GOAP-262 bundle rejection stands).
 *
 * Three invariants, each pinned by test:
 *  - **Labelled load**: `review()` NEVER downloads. The engine must be loaded
 *    through `load(onProgress)` first — a visible, user-initiated event — so a
 *    ~500 MB model fetch is always an explicit action with progress, and
 *    `hasEngine()` stays fail-closed (false until a pipeline actually
 *    instantiated) exactly like the A2 adapter's last-contact rule.
 *  - **Grounded-by-construction citations**: nothing the model writes becomes
 *    a quote unverified. A `{chapter, sentence}` number is sliced from the
 *    real passage; a copied `quote` must resolve via `resolveCitation` as an
 *    exact substring of the supplied manuscript. An unresolvable citation
 *    retries a fresh draw, then fails the run as `incomplete_analysis` —
 *    same trust boundary as A2: never a fabricated finding, never a silent
 *    drop of a candidate the engine raised.
 *  - **Questions, never verdicts**: severity is forced to `question`,
 *    `replacement` is always null, and uncertainty is forced conservative
 *    (`review_needed` / `insufficient_context`) — story/logic assistance may
 *    ask the author, never rewrite the plot or attest a fact (ADR-999 D4).
 *
 * Scope notes:
 *  - `approvedTerms` (ADR-274 D6) is deliberately NOT applied here: that
 *    mechanism suppresses spelling/grammar standardization of glossary names
 *    and dialect. Story/logic findings only cite passages — a question *about*
 *    an invented term must survive.
 *  - Prompt building, sentence numbering and model-output parsing live in
 *    `transformers-editorial-format.ts` (500-line cap; no regex anywhere over
 *    untrusted input, ADR-034).
 */

import { AiProviderUnavailableError } from '../types';
import type {
  CitedSpan,
  EditorialCategory,
  EditorialFinding,
  EditorialReviewOutcome,
} from '../editorial-findings';
import { validateEditorialFindings } from '../editorial-findings';
import type {
  AiPlugin,
  AiPluginCapabilities,
  EditorialReviewCapability,
  EditorialReviewRequest,
} from '../types';
import type {
  ModelLoadProgress,
  TransformersDevice,
  TransformersDtype,
} from './transformers-editorial-format';
import {
  buildChapters,
  buildMessages,
  extractAssistantText,
  isPromptEcho,
  mapProgressEvent,
  MAX_FINDINGS,
  parseCandidates,
  resolveCitation,
} from './transformers-editorial-format';

/** Categories this engine answers (ADR-999 D4 story/logic scope). */
export const TRANSFORMERS_EDITORIAL_CATEGORIES: readonly EditorialCategory[] = [
  'story',
  'logic',
];

const DEFAULT_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
const DEFAULT_DTYPE: TransformersDtype = 'q8';
const DEFAULT_TIMEOUT_MS = 300_000;

/**
 * Light sampling (evidence-driven, live-corpus tuning): greedy decoding of
 * the 0.5B model deterministically drifted into prose and malformed arrays —
 * retrying an identical greedy draw would change nothing, so every retry is
 * a fresh sampled draw. Deliberately NO `repetition_penalty`: transformers
 * applies it to the FULL `input_ids` INCLUDING the prompt for decoder-only
 * models (`RepetitionPenaltyLogitsProcessor`, src/generation/logits_process.js
 * — its docstring: "the considered tokens include the prompt"), dividing
 * every prompt-token logit by the penalty. At temperature 0.4 that compounds
 * over the chapter text and punishes exactly the verbatim copying the
 * grounding evaluator scores on — fabricated quotes were the observed
 * result (probe #4 root cause). Fail-closed validation is unchanged: retries
 * only ever trade latency for contract compliance, never honesty.
 */
export const GENERATION_OPTIONS: GenerationOptions = {
  max_new_tokens: 768,
  do_sample: true,
  temperature: 0.4,
};

/** One contract-breaking draw → fresh sampled draw; never an endless loop. */
const MAX_GENERATION_ATTEMPTS = 3;

export interface TransformersLoaderSpec {
  model: string;
  dtype: TransformersDtype;
  device: TransformersDevice;
  /** Overrides the Hugging Face Hub host (test/mirror seam); null = default. */
  remoteHost: string | null;
  onProgress: (progress: ModelLoadProgress) => void;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerationOptions {
  max_new_tokens: number;
  do_sample: boolean;
  temperature?: number;
  // No `repetition_penalty` field on purpose: transformers applies it to
  // prompt tokens too (see GENERATION_OPTIONS) — do not re-add.
}

/** Minimal structural shape of a Transformers.js text-generation pipeline. */
export interface TextGenerationPipe {
  (messages: ChatMessage[], options: GenerationOptions): Promise<unknown>;
}

/** Test seam: replaces the dynamic `@huggingface/transformers` import. */
export type TransformersLoader = (spec: TransformersLoaderSpec) => Promise<TextGenerationPipe>;

/** Injectable probes behind `device: 'auto'` (test seams). */
export interface DeviceSelectionDeps {
  gpuProbe?: () => Promise<unknown>;
  isNode?: boolean;
}

export interface TransformersEditorialPluginOptions {
  model?: string;
  dtype?: TransformersDtype;
  /**
   * `auto` (default): WebGPU when an adapter is actually acquired, else the
   * portable backend for this runtime (browser `wasm`, Node `cpu`).
   */
  device?: TransformersDevice | 'auto';
  remoteHost?: string;
  timeoutMs?: number;
  engine?: string;
  /** Injectable loader — the offline unit-test seam. */
  loader?: TransformersLoader;
  /** Injectable WebGPU probe — test seam for `auto` device selection. */
  gpuProbe?: () => Promise<unknown>;
  /** Injectable runtime detection — test seam for `auto` device selection. */
  isNode?: boolean;
}

export interface ModelLoadState {
  loaded: boolean;
  device: TransformersDevice | null;
  model: string;
}

export interface TransformersEditorialCapability extends EditorialReviewCapability {
  readonly model: string;
  readonly dtype: TransformersDtype;
  /** Resolved device after `load()`; null while unloaded. */
  readonly device: TransformersDevice | null;
  /**
   * Labelled on-demand load: dynamic-imports the engine code, downloads the
   * quantized model (progress events), instantiates the pipeline. Idempotent;
   * concurrent calls share one attempt. Throws `AiProviderUnavailableError`
   * on failure and leaves `hasEngine()` false.
   */
  load(onProgress?: (progress: ModelLoadProgress) => void): Promise<ModelLoadState>;
}

export interface TransformersEditorialPlugin extends AiPlugin {
  readonly capabilities: AiPluginCapabilities & {
    readonly editorial: TransformersEditorialCapability;
  };
}

/**
 * Device selection. v4 validates per runtime: browsers accept
 * {wasm, webgpu, …}, Node accepts {cpu, webgpu, cuda} — passing the wrong one
 * throws `Unsupported device`. So `auto` mirrors that: WebGPU when an adapter
 * can actually be acquired, otherwise the portable backend for this runtime
 * (browser WASM; Node `cpu` → onnxruntime-node, whose prebuilt Linux/x64
 * binding ships in the tarball — no build script executes).
 */
export async function resolveInferenceDevice(
  option: TransformersDevice | 'auto',
  deps: DeviceSelectionDeps = {},
): Promise<TransformersDevice> {
  if (option !== 'auto') return option;
  const probe = deps.gpuProbe ?? defaultGpuProbe;
  try {
    const adapter = await probe();
    if (adapter) return 'webgpu';
  } catch {
    // No adapter — fall through to the portable backend.
  }
  return (deps.isNode ?? isNodeRuntime()) ? 'cpu' : 'wasm';
}

async function defaultGpuProbe(): Promise<unknown> {
  const nav: unknown = typeof navigator === 'object' ? navigator : null;
  const gpu = nav && typeof nav === 'object' && 'gpu' in nav
    ? (nav as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu
    : undefined;
  if (!gpu?.requestAdapter) return null;
  return gpu.requestAdapter();
}

/**
 * Runtime detection matching Transformers.js's own `IS_NODE_ENV` probe — both
 * key off `process.versions.node`, so device resolution agrees with the
 * vocabulary the loaded build validates against. Walked as `unknown` because
 * bundlers may define a partial `process` in the browser.
 */
function isNodeRuntime(): boolean {
  const proc: unknown = typeof process === 'undefined' ? undefined : process;
  if (typeof proc !== 'object' || proc === null) return false;
  const versions: unknown = (proc as { versions?: unknown }).versions;
  if (typeof versions !== 'object' || versions === null) return false;
  return typeof (versions as { node?: unknown }).node === 'string';
}

/**
 * Default loader: the ONLY place `@huggingface/transformers` is referenced.
 * Dynamic on purpose — the module (and its ~1 MB of engine code) must stay out
 * of every static import graph so the bundle baseline does not move and the
 * code itself is fetched only when the user asks for the engine.
 */
const defaultLoader: TransformersLoader = async (spec) => {
  const mod = await import('@huggingface/transformers');
  // v4 reads `env.remoteHost` from the file resolver; passing it as a
  // pipeline option would be silently ignored.
  if (spec.remoteHost) mod.env.remoteHost = spec.remoteHost;
  const pipe = await mod.pipeline('text-generation', spec.model, {
    dtype: spec.dtype,
    device: spec.device,
    // ORT's CPU memory arena caches allocation across token steps. Measured
    // cost of keeping it: +1486 MB RSS spike per review vs +460 MB without,
    // which drove `available` into the container kill band on 8 GB/no-swap
    // hosts mid-corpus-run (live corpus worker death, LEARNINGS #546). The
    // arena only amortizes per-step allocator reuse — noise at 0.5B scale;
    // surviving the run is not.
    session_options: { enableCpuMemArena: false },
    progress_callback: (event: unknown) => {
      const mapped = mapProgressEvent(event);
      if (mapped) spec.onProgress(mapped);
    },
  });
  // Transformers.js types the text-generation pipeline loosely; narrow to the
  // structural shape this adapter relies on instead of `any`.
  if (typeof pipe !== 'function') {
    throw new Error('text-generation pipeline did not initialize as a callable');
  }
  return pipe as unknown as TextGenerationPipe;
};

export function createTransformersEditorialPlugin(
  options: TransformersEditorialPluginOptions = {},
): TransformersEditorialPlugin {
  const model = options.model ?? DEFAULT_MODEL;
  const dtype = options.dtype ?? DEFAULT_DTYPE;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const engineName = options.engine ?? 'transformers.js';
  const remoteHost = options.remoteHost ?? null;
  const loader: TransformersLoader = options.loader ?? defaultLoader;
  const selection: DeviceSelectionDeps = {
    gpuProbe: options.gpuProbe,
    isNode: options.isNode,
  };

  let pipe: TextGenerationPipe | null = null;
  let device: TransformersDevice | null = null;
  let loadAttempt: Promise<ModelLoadState> | null = null;
  // Progress listeners for the current/last attempt. A stable UI callback
  // (useCallback) dedupes via Set identity; late (concurrent) callers still
  // receive every subsequent event of the attempt they joined.
  const progressListeners = new Set<(progress: ModelLoadProgress) => void>();
  const forward = (progress: ModelLoadProgress): void => {
    for (const listener of progressListeners) listener(progress);
  };

  async function load(
    onProgress?: (progress: ModelLoadProgress) => void,
  ): Promise<ModelLoadState> {
    if (onProgress) progressListeners.add(onProgress);
    if (pipe) return { loaded: true, device, model };
    loadAttempt ??= (async () => {
      forward({ phase: 'code', file: null, loadedBytes: null, totalBytes: null, percent: null });
      try {
        const requested = options.device ?? 'auto';
        const resolved = await resolveInferenceDevice(requested, selection);
        const attempt = (target: TransformersDevice): Promise<TextGenerationPipe> =>
          loader({ model, dtype, device: target, remoteHost, onProgress: forward });
        let loaded: TextGenerationPipe;
        let chosen = resolved;
        try {
          loaded = await attempt(resolved);
        } catch (primary) {
          // WebGPU advertised but failing to initialise: one retry on the
          // portable backend — but only under `auto`. A forced device fails
          // closed rather than silently degrading (ADR-999 honest states).
          const canFallback = requested === 'auto' && resolved === 'webgpu';
          if (!canFallback) throw primary;
          chosen = (selection.isNode ?? isNodeRuntime()) ? 'cpu' : 'wasm';
          loaded = await attempt(chosen);
        }
        pipe = loaded;
        device = chosen;
        return { loaded: true, device: chosen, model };
      } catch (err) {
        loadAttempt = null;
        const reason = err instanceof Error ? err.message : String(err);
        throw new AiProviderUnavailableError(reason);
      }
    })();
    return loadAttempt;
  }

  async function review(request: EditorialReviewRequest): Promise<EditorialReviewOutcome> {
    // This adapter answers story/logic only (A2's selection rule, mirrored).
    const wantsUnanswerable = request.categories.length === 0
      || request.categories.some(
        (category) => !TRANSFORMERS_EDITORIAL_CATEGORIES.includes(category),
      );
    if (wantsUnanswerable) {
      return { status: 'unavailable', reason: 'incomplete_analysis' };
    }
    if (request.language === null) {
      return { status: 'unavailable', reason: 'unsupported_language' };
    }
    // Never download implicitly: the model fetch is a labelled user action
    // (load()); review() without a present engine reports it honestly.
    if (!pipe) {
      return { status: 'unavailable', reason: 'engine_missing' };
    }
    const chapters = buildChapters(request);
    if (chapters === null || chapters.length === 0) {
      // Nothing reviewable is NOT a clean story run — a truncating or empty
      // review must never read as "checked, found nothing".
      return { status: 'unavailable', reason: 'incomplete_analysis' };
    }

    // Few-shot + contract-after-text ordering, quote citations: tuned against
    // observed 0.5B format drift in the live corpus — see buildMessages.
    const messages = buildMessages(chapters);
    const deadline = Date.now() + timeoutMs;

    /** One draw → a terminal outcome, or null when this draw must be retried. */
    const evaluate = (raw: unknown): EditorialReviewOutcome | null => {
      const text = extractAssistantText(raw);
      if (text === null) return null;
      const { candidates, parseable } = parseCandidates(text, request.categories);
      if (!parseable) return null;
      if (candidates.length > MAX_FINDINGS) {
        // The prompt caps findings at MAX_FINDINGS; more means the model broke
        // its contract (or output was cut). Retrying a fresh draw beats
        // silently discarding concerns the engine actually raised.
        return null;
      }
      // Echo backstop (probe #4): a question that restates the prompt — an
      // unfilled schema slot, the few-shot demo's own question, or a chapter
      // sentence copied verbatim — is a degenerate draw. Retry it; surfacing
      // it would be a silent fake pass.
      if (candidates.some((candidate) => isPromptEcho(candidate.question, messages))) {
        return null;
      }
      const byRef = new Map(chapters.map((chapter) => [chapter.ref, chapter]));
      const findings: EditorialFinding[] = [];
      for (const candidate of candidates) {
        // Grounding: resolve every citation to the real passage. An
        // unresolvable citation retries, then fails the run — dropping it
        // would silently discard a raised concern; keeping it unresolved
        // would fabricate a quote.
        const spans: CitedSpan[] = [];
        let resolved = candidate.spans.length > 0;
        for (const cited of candidate.spans) {
          const chapter = byRef.get(cited.chapterRef);
          const quote = chapter
            ? resolveCitation(chapter, request.chapterText[chapter.ref] ?? null, cited)
            : null;
          if (!chapter || quote === null) {
            resolved = false;
            break;
          }
          spans.push({
            chapterRef: chapter.ref,
            cfi: null,
            quote,
            sourceSha256: request.chapterSha256[chapter.ref] ?? null,
            start: 0,
            end: quote.length,
          });
        }
        if (!resolved || spans.length === 0 || candidate.question.trim().length === 0) {
          return null;
        }
        findings.push({
          category: candidate.category,
          // Questions only: assistance may ask, never assert or rewrite.
          severity: 'question',
          explanation: candidate.question.trim(),
          spans,
          replacement: null,
          referenceIds: [],
          referenceRevisions: {},
          styleRevision: request.styleRevision,
          uncertainty: candidate.uncertainty,
          provenance: {
            engine: engineName,
            model: `${model} (${dtype}/${device ?? 'unresolved'})`,
            ruleId: null,
          },
        });
      }

      const referenceRevisions: Record<string, number> = {};
      for (const [id, reference] of Object.entries(request.references)) {
        referenceRevisions[id] = reference.revision;
      }
      const validation = validateEditorialFindings(findings, {
        chapterText: request.chapterText,
        chapterSha256: request.chapterSha256,
        referenceRevisions,
        styleRevision: request.styleRevision,
      });
      if (validation.rejected.length > 0) {
        // Citations are sliced from the request text, so a rejection here means
        // the adapter mis-mapped — retry a draw, fail honestly if it persists.
        return null;
      }
      if (validation.accepted.length === 0) {
        return { status: 'no_supported_findings' };
      }
      return { status: 'ok', findings: validation.accepted };
    };

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return { status: 'unavailable', reason: 'timeout' };
      }
      let raw: unknown;
      try {
        raw = await Promise.race([
          pipe(messages, GENERATION_OPTIONS),
          new Promise<never>((_, reject) => {
            const timer = setTimeout(() => {
              const error = new Error('generation timed out');
              error.name = 'TimeoutError';
              reject(error);
            }, remaining);
            // Node/browser timers: never keep the race alive past settlement.
            if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
              (timer as { unref: () => void }).unref();
            }
          }),
        ]);
      } catch (err) {
        if (err instanceof Error && err.name === 'TimeoutError') {
          return { status: 'unavailable', reason: 'timeout' };
        }
        // The pipeline object stays present; a failed generation is an analysis
        // failure, not an engine disappearance.
        return { status: 'unavailable', reason: 'incomplete_analysis' };
      }
      const outcome = evaluate(raw);
      if (outcome !== null) return outcome;
      // Contract-breaking draw — loop for a fresh sampled draw while time lasts.
    }
    // Every draw broke the contract: honest incompleteness, never a guess.
    return { status: 'unavailable', reason: 'incomplete_analysis' };
  }

  const capability: TransformersEditorialCapability = {
    kind: 'editorial',
    model,
    dtype,
    get device() {
      return device;
    },
    // Fail-closed: true only once a pipeline actually instantiated.
    hasEngine: () => pipe !== null,
    load,
    review,
  };

  return {
    id: 'transformers-editorial',
    title: `On-device story/logic review (${model})`,
    version: '0.1.0',
    capabilities: { editorial: capability },
  };
}
