/**
 * @vitest-environment node
 *
 * Transformers.js story/logic adapter — deterministic unit tests (GOAP-273
 * Phase B1).
 *
 * The engine is faked at the loader seam (`TransformersLoader`), so everything
 * here runs offline and downloads nothing: sentence splitting, quote location,
 * inference-device resolution, the labelled-load contract (review() must never
 * trigger a download), every honest unavailability reason, bounded retry, and
 * qualification composition. ADR-999 D4 grounding/mapping lives in
 * `transformers-editorial-grounding.test.ts`; shared fixtures and the fake
 * loader seam live in `transformers-editorial-helpers.ts`. Live engine
 * behaviour belongs in `transformers-editorial.live.test.ts`
 * (opt-in via E2E_LIVE=1).
 */

import { describe, expect, it, vi } from 'vitest';
import { type EditorialCategory } from '../editorial-findings';
import { effectiveCategoryAvailability, type QualificationMilestone } from '../qualification';
import {
  GENERATION_OPTIONS,
  createTransformersEditorialPlugin,
  resolveInferenceDevice,
  type TextGenerationPipe,
  type TransformersLoader,
} from '../plugins/transformers-editorial';
import {
  locateQuote,
  mapProgressEvent,
  splitSentences,
  type ModelLoadProgress,
  type TransformersDevice,
} from '../plugins/transformers-editorial-format';
import { C1, C2, S_C1_1, fakeLoader, request, run } from './transformers-editorial-helpers';

/**
 * Mocked `@huggingface/transformers` for the default-loader test: records
 * pipeline calls, exposes a mutable `env`, and emits v4-shaped progress
 * events through the callback the loader wires in.
 */
const loaderState = vi.hoisted(() => ({
  calls: [] as Array<{ task: string; model: string; opts: Record<string, unknown> }>,
  env: { remoteHost: 'https://huggingface.co/' },
}));

vi.mock('@huggingface/transformers', () => ({
  env: loaderState.env,
  pipeline: (task: string, model: string, opts: Record<string, unknown>) => {
    loaderState.calls.push({ task, model, opts });
    const callback = opts.progress_callback as ((event: unknown) => void) | undefined;
    callback?.({
      status: 'progress',
      file: 'onnx/model_quantized.onnx',
      loaded: 50,
      total: 100,
      progress: 50,
    });
    callback?.({ status: 'ready' });
    const pipe: TextGenerationPipe = () => Promise.resolve('[]');
    return Promise.resolve(pipe);
  },
}));

function localMilestone(categories: readonly EditorialCategory[]): QualificationMilestone {
  return {
    id: 'local-engine',
    status: 'met',
    qualifiedAt: '2026-09-22',
    categories,
    notes: 'test fixture',
  };
}

const CLOUD_UNMET: QualificationMilestone = {
  id: 'cloud-provider',
  status: 'unmet',
  qualifiedAt: null,
  categories: [],
  notes: 'test fixture',
};

describe('splitSentences (hand-rolled, no regex — ADR-034)', () => {
  it('returns exact substrings that rejoin to the original text', () => {
    const text = `${C1} ${C2}`;
    const sentences = splitSentences(text);
    expect(sentences).toHaveLength(4);
    for (const sentence of sentences) {
      expect(text.includes(sentence)).toBe(true);
    }
    expect(sentences.join(' ')).toBe(text);
  });

  it('keeps decimals intact, honours trailing quotes, defers wrapped speech', () => {
    const text = 'The vote was 4.5 points. "Done?" she asked. Yes!';
    expect(splitSentences(text)).toEqual([
      'The vote was 4.5 points.',
      '"Done?" she asked.',
      'Yes!',
    ]);
    // A sentence ending in a closing quote still terminates.
    expect(splitSentences('He said "stop." Then he left.')).toEqual([
      'He said "stop."',
      'Then he left.',
    ]);
  });
});

describe('locateQuote (quote citations, no regex — ADR-034)', () => {
  it('resolves exact copies and trims drifted tails to real substrings', () => {
    expect(locateQuote(C1, S_C1_1)).toBe(S_C1_1);
    // Drifted tail (observed 0.5B): invented continuation — trim over word
    // boundaries until a prefix verifiably occurs in the manuscript.
    expect(locateQuote(C1, `${S_C1_1} and other events`)).toBe(S_C1_1);
    expect(
      locateQuote(C1, 'The peace was signed the year Mara turned thirty and nobody explained it'),
    ).toBe('The peace was signed the year Mara turned thirty');
    // Unverifiable text never resolves — the run fails instead of guessing.
    expect(locateQuote(C1, 'The coronation happened in secret.')).toBeNull();
    expect(locateQuote(C1, '   ')).toBeNull();
    expect(locateQuote(C1, 'too short')).toBeNull();
  });

  it('resolves case-only drift via a length-preserving fold, still exact elsewhere', () => {
    // Observed 0.5B: capitalisation drift ("Winter" vs "winter"). The fold
    // returns the manuscript's own casing; a miss still fails closed.
    expect(locateQuote(C1, S_C1_1.toLowerCase())).toBe(S_C1_1);
    expect(locateQuote(C1, 'the coronation happened in secret.')).toBeNull();
  });
});

describe('resolveInferenceDevice (v4 per-runtime vocabulary)', () => {
  it('probes WebGPU for auto, else picks the portable backend per runtime', async () => {
    await expect(
      resolveInferenceDevice('auto', { gpuProbe: () => Promise.resolve({}) }),
    ).resolves.toBe('webgpu');
    // Browser vocabulary: no adapter → wasm.
    await expect(
      resolveInferenceDevice('auto', { gpuProbe: () => Promise.resolve(null), isNode: false }),
    ).resolves.toBe('wasm');
    await expect(
      resolveInferenceDevice('auto', {
        gpuProbe: () => Promise.reject(new Error('no gpu')),
        isNode: false,
      }),
    ).resolves.toBe('wasm');
    // Node vocabulary (this test env): no browser GPU → native cpu backend.
    await expect(
      resolveInferenceDevice('auto', { gpuProbe: () => Promise.resolve(null) }),
    ).resolves.toBe('cpu');
    // Explicit values pass through untouched.
    await expect(resolveInferenceDevice('cpu')).resolves.toBe('cpu');
    await expect(resolveInferenceDevice('wasm')).resolves.toBe('wasm');
    await expect(resolveInferenceDevice('webgpu')).resolves.toBe('webgpu');
  });
});

describe('load contract (labelled on-demand download)', () => {
  it('starts unloaded, forwards progress, then reports hasEngine() true', async () => {
    const seen: ModelLoadProgress[] = [];
    const plugin = createTransformersEditorialPlugin({ loader: fakeLoader('[]') });
    expect(plugin.capabilities.editorial.hasEngine()).toBe(false);
    expect(plugin.capabilities.editorial.device).toBeNull();

    await plugin.capabilities.editorial.load((p) => seen.push(p));

    expect(plugin.capabilities.editorial.hasEngine()).toBe(true);
    // Node test env: auto resolves the native cpu backend (v4 rejects
    // `wasm` in Node — device vocabulary is per-runtime).
    expect(plugin.capabilities.editorial.device).toBe('cpu');
    expect(seen[0]?.phase).toBe('code');
  });

  it('review() never downloads: without load() it reports engine_missing', async () => {
    const plugin = createTransformersEditorialPlugin({ loader: fakeLoader('[]') });
    const outcome = await plugin.capabilities.editorial.review(request());
    expect(outcome).toEqual({ status: 'unavailable', reason: 'engine_missing' });
  });

  it('a failed load throws and keeps hasEngine() false; retry stays possible', async () => {
    const plugin = createTransformersEditorialPlugin({
      loader: fakeLoader('[]', { fail: true }),
    });
    await expect(plugin.capabilities.editorial.load()).rejects.toThrow(/provider unavailable/i);
    expect(plugin.capabilities.editorial.hasEngine()).toBe(false);
    await expect(plugin.capabilities.editorial.load()).rejects.toThrow();
  });
});

describe('device fallback policy', () => {
  it('retries the portable backend when WebGPU is advertised but fails', async () => {
    const tried: TransformersDevice[] = [];
    const loader: TransformersLoader = (spec) => {
      tried.push(spec.device);
      if (spec.device === 'webgpu') return Promise.reject(new Error('adapter lost'));
      const pipe: TextGenerationPipe = () => Promise.resolve('[]');
      return Promise.resolve(pipe);
    };
    const plugin = createTransformersEditorialPlugin({
      loader,
      gpuProbe: () => Promise.resolve({}),
      isNode: false, // browser vocabulary → wasm fallback
    });
    const state = await plugin.capabilities.editorial.load();
    expect(tried).toEqual(['webgpu', 'wasm']);
    expect(state.device).toBe('wasm');
    expect(plugin.capabilities.editorial.hasEngine()).toBe(true);
  });

  it('a forced device fails closed instead of silently degrading', async () => {
    const plugin = createTransformersEditorialPlugin({
      loader: () => Promise.reject(new Error('no webgpu adapter')),
      device: 'webgpu',
    });
    await expect(plugin.capabilities.editorial.load()).rejects.toThrow(/provider unavailable/i);
    expect(plugin.capabilities.editorial.hasEngine()).toBe(false);
  });
});

describe('default loader (mocked @huggingface/transformers)', () => {
  it('imports engine code only on load() and maps v4 progress events', async () => {
    loaderState.calls.length = 0;
    loaderState.env.remoteHost = 'https://huggingface.co/';
    const seen: ModelLoadProgress[] = [];
    const plugin = createTransformersEditorialPlugin({ remoteHost: 'https://mirror.test/' });
    // Nothing static: the engine package is untouched until load() is asked.
    expect(loaderState.calls).toHaveLength(0);

    await plugin.capabilities.editorial.load((p) => seen.push(p));

    expect(loaderState.calls).toHaveLength(1);
    const call = loaderState.calls[0];
    if (!call) throw new Error('pipeline not called');
    expect(call.task).toBe('text-generation');
    expect(call.model).toBe('onnx-community/Qwen2.5-0.5B-Instruct');
    expect(call.opts.device).toBe('cpu'); // node runtime resolves native cpu
    expect(call.opts.dtype).toBe('q8');
    expect(loaderState.env.remoteHost).toBe('https://mirror.test/');
    expect(seen[0]?.phase).toBe('code');
    expect(seen).toContainEqual({
      phase: 'download',
      file: 'onnx/model_quantized.onnx',
      loadedBytes: 50,
      totalBytes: 100,
      percent: 50,
    });
    expect(seen.map((p) => p.phase)).toContain('initialize');
    expect(plugin.capabilities.editorial.hasEngine()).toBe(true);
  });
});

describe('mapProgressEvent (v4 progress_callback vocabulary)', () => {
  it('maps every v4 status family and rejects noise', () => {
    expect(mapProgressEvent({ status: 'initiate', file: 'cfg' })).toMatchObject({
      phase: 'download',
      file: 'cfg',
    });
    expect(mapProgressEvent({ status: 'download', file: 'm', total: 5 })).toMatchObject({
      phase: 'download',
      totalBytes: 5,
    });
    expect(mapProgressEvent({ status: 'progress_total', total: 488_400_000 })).toMatchObject({
      phase: 'download',
      totalBytes: 488_400_000,
    });
    expect(mapProgressEvent({ status: 'done', file: 'm' })).toMatchObject({ phase: 'download' });
    expect(mapProgressEvent({ status: 'ready' })).toMatchObject({ phase: 'initialize' });
    expect(mapProgressEvent({ status: 'progress', loaded: 10 })).toMatchObject({
      phase: 'download',
      percent: null,
    });
    expect(mapProgressEvent({ status: 'progress', loaded: 50, total: 200 })).toMatchObject({
      percent: 25,
    });
    expect(mapProgressEvent({ status: 'something_new' })).toBeNull();
    expect(mapProgressEvent(null)).toBeNull();
    expect(mapProgressEvent('noise')).toBeNull();
  });
});

describe('request gating (honest unavailability)', () => {
  it('rejects categories outside story/logic as incomplete', async () => {
    expect(await run(fakeLoader('[]'), request({ categories: ['spelling'] }))).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
    expect(await run(fakeLoader('[]'), request({ categories: [] }))).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
  });

  it('reports unsupported language for a null language', async () => {
    expect(await run(fakeLoader('[]'), request({ language: null }))).toEqual({
      status: 'unavailable',
      reason: 'unsupported_language',
    });
  });

  it('never reports a clean run for empty or oversized manuscripts', async () => {
    expect(await run(fakeLoader('[]'), request({ chapterText: {} }))).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
    const huge = { c1: 'x'.repeat(90_001) };
    expect(await run(fakeLoader('[]'), request({ chapterText: huge }))).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
  });

  it('fails honestly on unparseable model output', async () => {
    expect(await run(fakeLoader('I found nothing worth saying.'))).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
    expect(await run(fakeLoader('{"not":"an array"}'))).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
  });

  it('returns a clean run for a parsed empty array (completed analysis)', async () => {
    expect(await run(fakeLoader('[]'))).toEqual({ status: 'no_supported_findings' });
  });
});

describe('bounded retry (sampled draws, MAX_GENERATION_ATTEMPTS = 3)', () => {
  it('retries contract-breaking draws and accepts the next valid one', async () => {
    let draws = 0;
    const loader: TransformersLoader = () => {
      const pipe: TextGenerationPipe = () => {
        draws += 1;
        return Promise.resolve(draws < 3 ? 'prose instead of a JSON array' : '[]');
      };
      return Promise.resolve(pipe);
    };
    expect(await run(loader)).toEqual({ status: 'no_supported_findings' });
    expect(draws).toBe(3);
  });

  it('gives up after the attempt cap instead of looping forever', async () => {
    let draws = 0;
    const loader: TransformersLoader = () => {
      const pipe: TextGenerationPipe = () => {
        draws += 1;
        return Promise.resolve('prose instead of a JSON array');
      };
      return Promise.resolve(pipe);
    };
    expect(await run(loader)).toEqual({
      status: 'unavailable',
      reason: 'incomplete_analysis',
    });
    expect(draws).toBe(3);
  });

  it('pins the decoding contract (sampling, no repetition penalty)', () => {
    // No `repetition_penalty` on purpose: transformers applies it to the
    // FULL input_ids INCLUDING the prompt (logits_process.js) — at
    // temperature 0.4 it suppressed the verbatim grounding quotes the live
    // corpus requires (probe #4 root cause).
    expect(GENERATION_OPTIONS).toEqual({
      max_new_tokens: 768,
      do_sample: true,
      temperature: 0.4,
    });
  });
});

describe('qualification composition (milestone + hasEngine)', () => {
  it('story stays unavailable without a loaded engine, even with a met milestone', () => {
    const plugin = createTransformersEditorialPlugin({ loader: fakeLoader('[]') });
    expect(
      effectiveCategoryAvailability('story', {
        enginePresent: plugin.capabilities.editorial.hasEngine(),
        milestones: [localMilestone(['story']), CLOUD_UNMET],
      }),
    ).toBe('engine_missing');
  });

  it('a loaded engine cannot self-qualify; only engine AND milestone compose', async () => {
    const plugin = createTransformersEditorialPlugin({ loader: fakeLoader('[]') });
    await plugin.capabilities.editorial.load();
    expect(
      effectiveCategoryAvailability('story', {
        enginePresent: plugin.capabilities.editorial.hasEngine(),
        milestones: [localMilestone(['story']), CLOUD_UNMET],
      }),
    ).toBe('available');
    // The real milestone record lists only spelling+grammar (A3): a loaded
    // story engine alone keeps story/logic at engine_missing until B2.
    expect(
      effectiveCategoryAvailability('story', {
        enginePresent: plugin.capabilities.editorial.hasEngine(),
      }),
    ).toBe('engine_missing');
  });
});
