/**
 * Runtime seam for the quantized Transformers.js editorial engine: device
 * resolution, the Node/browser detection it depends on, and the single
 * dynamic-import loader. Extracted from `transformers-editorial.ts` (ADR-278
 * warn-zone extraction); the plugin re-exports the public names so callers and
 * tests keep importing them from the engine module.
 *
 * v4's device vocabulary is environment-specific — browsers validate
 * {wasm, webgpu}, Node validates {cpu, webgpu, cuda} — so `auto` mirrors that
 * instead of hardcoding one value.
 */
import type {
  ModelLoadProgress,
  TransformersDevice,
  TransformersDtype,
} from './transformers-editorial-format';
import { mapProgressEvent } from './transformers-editorial-format';

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

/**
 * The portable backend for the current runtime: browser WASM; Node `cpu`
 * (onnxruntime-node, whose prebuilt Linux/x64 binding ships in the tarball —
 * no build script executes). Single source of the runtime-vocabulary rule,
 * shared by `auto` resolution and the WebGPU-init fallback.
 */
export function portableBackendFor(deps: DeviceSelectionDeps = {}): TransformersDevice {
  return (deps.isNode ?? isNodeRuntime()) ? 'cpu' : 'wasm';
}

/**
 * Device selection. `auto` uses WebGPU when an adapter can actually be
 * acquired, otherwise `portableBackendFor` this runtime.
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
  return portableBackendFor(deps);
}

async function defaultGpuProbe(): Promise<unknown> {
  const nav: unknown = typeof navigator === 'object' ? navigator : null;
  if (typeof nav !== 'object' || nav === null || !('gpu' in nav)) return null;
  const gpu = nav.gpu;
  if (typeof gpu !== 'object' || gpu === null || !('requestAdapter' in gpu)) return null;
  const requestAdapter = gpu.requestAdapter;
  if (typeof requestAdapter !== 'function') return null;
  // `typeof === 'function'` only narrows to `Function`; WebGPU has no DOM
  // typing in this target, so call through this checked structural view.
  const callAdapter = requestAdapter as () => Promise<unknown>;
  return await callAdapter.call(gpu);
}

/**
 * Runtime detection matching Transformers.js's own `IS_NODE_ENV` probe — both
 * key off `process.versions.node`, so device resolution agrees with the
 * vocabulary the loaded build validates against. Walked as `unknown` because
 * bundlers may define a partial `process` in the browser.
 */
function isNodeRuntime(): boolean {
  const proc: unknown = typeof process === 'undefined' ? undefined : process;
  if (typeof proc !== 'object' || proc === null || !('versions' in proc)) return false;
  const versions = proc.versions;
  if (typeof versions !== 'object' || versions === null || !('node' in versions)) return false;
  return typeof versions.node === 'string';
}

/**
 * Default loader: the ONLY place `@huggingface/transformers` is referenced.
 * Dynamic on purpose — the module (and its ~1 MB of engine code) must stay out
 * of every static import graph so the bundle baseline does not move and the
 * code itself is fetched only when the user asks for the engine.
 */
export const defaultLoader: TransformersLoader = async (spec) => {
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
