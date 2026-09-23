/**
 * Shared deterministic fixtures and loader helpers for the transformers.js
 * editorial unit tests (GOAP-273 Phase B1).
 *
 * Deliberately NOT named `*.test.ts`: vitest imports this module but must
 * never collect it as a suite. The fake loader seam keeps every consumer
 * offline — real engine behaviour belongs in
 * `transformers-editorial.live.test.ts` (opt-in via E2E_LIVE=1).
 */
import { type EditorialFinding, type EditorialReviewOutcome } from '../editorial-findings';
import {
  createTransformersEditorialPlugin,
  type TextGenerationPipe,
  type TransformersLoader,
} from '../plugins/transformers-editorial';
import type { EditorialReviewRequest } from '../types';

export const C1 = 'The peace was signed the year Mara turned thirty. The dates never quite agreed.';
export const C2 = 'Mara remembered the winter of the peace. She had been thirty-two that January.';
export const S_C1_1 = 'The peace was signed the year Mara turned thirty.';
export const CHAPTER_SHA = { c1: 'sha256:unit-1', c2: 'sha256:unit-2' };

export function request(overrides: Partial<EditorialReviewRequest> = {}): EditorialReviewRequest {
  return {
    categories: ['story', 'logic'],
    chapterText: { c1: C1, c2: C2 },
    chapterSha256: CHAPTER_SHA,
    references: {},
    styleRevision: 3,
    language: 'en-US',
    ...overrides,
  };
}

/** Fake engine: resolves with a fixed pipeline payload (string or chat shape). */
export function fakeLoader(payload: unknown, opts: { fail?: boolean } = {}): TransformersLoader {
  return () => {
    if (opts.fail) return Promise.reject(new Error('wasm fetch failed'));
    const pipe: TextGenerationPipe = () => Promise.resolve(payload);
    return Promise.resolve(pipe);
  };
}

/** Chat-shaped pipeline result: `[{ generated_text: messages }]`. */
export function chatPayload(assistantContent: string): unknown {
  return [
    {
      generated_text: [
        { role: 'user', content: 'prompt' },
        { role: 'assistant', content: assistantContent },
      ],
    },
  ];
}

export async function run(
  loader: TransformersLoader,
  req: EditorialReviewRequest = request(),
): Promise<EditorialReviewOutcome> {
  const plugin = createTransformersEditorialPlugin({ loader });
  await plugin.capabilities.editorial.load();
  return plugin.capabilities.editorial.review(req);
}

export async function runOk(
  loader: TransformersLoader,
  req: EditorialReviewRequest = request(),
): Promise<EditorialFinding[]> {
  const outcome = await run(loader, req);
  if (outcome.status !== 'ok') {
    const reason = outcome.status === 'unavailable' ? `: ${outcome.reason}` : '';
    throw new Error(`expected ok outcome, received ${outcome.status}${reason}`);
  }
  return outcome.findings;
}
