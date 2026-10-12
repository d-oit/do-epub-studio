import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import {
  validateEditorialFindings,
  type EditorialCategory,
  type EditorialFinding,
  type EditorialReviewOutcome,
} from '@do-epub-studio/reader-core';
import { dispatchEditorialReview, type EditorialEngine } from './editorial-dispatch';

interface EngineStub extends EditorialEngine {
  review: Mock;
}

function engine(
  categories: readonly EditorialCategory[],
  options: { hasEngine: boolean; review?: Mock },
): EngineStub {
  const review =
    options.review ??
    vi.fn((): Promise<EditorialReviewOutcome> =>
      Promise.resolve({ status: 'no_supported_findings' }),
    );
  return {
    categories,
    plugin: {
      capabilities: {
        editorial: {
          kind: 'editorial',
          hasEngine: () => options.hasEngine,
          review: review as never,
        },
      },
    },
    review,
  };
}

function baseInput(categories: readonly EditorialCategory[]) {
  return {
    categories,
    chapterText: { 'c1.xhtml': 'Once upon a time, Mariselleth waited.' },
    chapterSha256: { 'c1.xhtml': 'sha256:x' },
    references: { 'ref-1': { revision: 2, content: 'Mariselleth is a coinage.' } },
    styleRevision: 4,
    language: 'en',
  };
}

const ALL: readonly EditorialCategory[] = ['spelling', 'grammar', 'story', 'logic'];

function groundedFinding(): EditorialFinding {
  return {
    category: 'logic',
    severity: 'question',
    explanation: 'Does the timeline hold?',
    spans: [
      { chapterRef: 'c1.xhtml', cfi: null, quote: 'Once upon a time', sourceSha256: 'sha256:x' },
    ],
    replacement: null,
    referenceIds: ['ref-1'],
    referenceRevisions: { 'ref-1': 2 },
    styleRevision: 4,
    uncertainty: 'review_needed',
    provenance: { engine: 'stub', model: 'stub', ruleId: null },
  };
}

describe('dispatchEditorialReview (GOAP-293)', () => {
  it('routes each category only to its owning engine with the full request context', async () => {
    const languageTool = engine(['spelling', 'grammar'], { hasEngine: true });
    const transformers = engine(['story', 'logic'], { hasEngine: true });

    const result = await dispatchEditorialReview([languageTool, transformers], baseInput(ALL));

    expect(result.outcome).toEqual({ status: 'no_supported_findings' });
    expect(result.enginesRun).toBe(2);
    expect(languageTool.review).toHaveBeenCalledTimes(1);
    expect(transformers.review).toHaveBeenCalledTimes(1);
    expect(languageTool.review.mock.calls[0]?.[0]).toMatchObject({
      categories: ['spelling', 'grammar'],
      chapterText: { 'c1.xhtml': 'Once upon a time, Mariselleth waited.' },
      chapterSha256: { 'c1.xhtml': 'sha256:x' },
      references: { 'ref-1': { revision: 2, content: 'Mariselleth is a coinage.' } },
      styleRevision: 4,
      language: 'en',
    });
    expect(transformers.review.mock.calls[0]?.[0]).toMatchObject({
      categories: ['story', 'logic'],
    });
  });

  it('merges findings, prefers a failure over a clean run, and reports engine_missing only when uncovered', async () => {
    const findings = [groundedFinding()];
    const withFindings = engine(['story', 'logic'], {
      hasEngine: true,
      review: vi.fn((): Promise<EditorialReviewOutcome> =>
        Promise.resolve({ status: 'ok', findings }),
      ),
    });
    const clean = engine(['spelling', 'grammar'], { hasEngine: true });
    const ok = await dispatchEditorialReview([withFindings, clean], baseInput(ALL));
    expect(ok.outcome).toEqual({ status: 'ok', findings });

    // Valid findings are never discarded because a parallel engine failed.
    const timingOut = engine(['spelling', 'grammar'], {
      hasEngine: true,
      review: vi.fn((): Promise<EditorialReviewOutcome> =>
        Promise.resolve({
          status: 'unavailable',
          reason: 'timeout',
        }),
      ),
    });
    const mixed = await dispatchEditorialReview([withFindings, timingOut], baseInput(ALL));
    expect(mixed.outcome).toEqual({ status: 'ok', findings });

    // With no findings anywhere, an unfinished engine outranks a clean run.
    const cleanOnly = engine(['story', 'logic'], { hasEngine: true });
    const partial = await dispatchEditorialReview([cleanOnly, timingOut], baseInput(ALL));
    expect(partial.outcome).toEqual({ status: 'unavailable', reason: 'timeout' });

    const missing = engine(['spelling', 'grammar'], { hasEngine: false });
    const uncovered = await dispatchEditorialReview([withFindings, missing], baseInput(ALL));
    expect(uncovered.outcome).toEqual({ status: 'ok', findings });
    expect(uncovered.missingCategories).toEqual(['spelling', 'grammar']);
    expect(uncovered.enginesRun).toBe(1);

    const none = await dispatchEditorialReview([missing], baseInput(ALL));
    expect(none.outcome).toEqual({ status: 'unavailable', reason: 'engine_missing' });
    expect(none.enginesRun).toBe(0);
  });

  it('a finding produced from the dispatched request passes real grounding validation', async () => {
    const transformers = engine(['story', 'logic'], {
      hasEngine: true,
      review: vi.fn((): Promise<EditorialReviewOutcome> =>
        Promise.resolve({
          status: 'ok',
          findings: [groundedFinding()],
        }),
      ),
    });
    const input = baseInput(ALL);
    const result = await dispatchEditorialReview([transformers], input);
    expect(result.outcome.status).toBe('ok');
    if (result.outcome.status !== 'ok') throw new Error('expected findings');
    const validation = validateEditorialFindings(result.outcome.findings, {
      chapterText: input.chapterText,
      chapterSha256: input.chapterSha256,
      referenceRevisions: { 'ref-1': 2 },
      styleRevision: 4,
    });
    expect(validation.rejected).toEqual([]);
    expect(validation.accepted).toHaveLength(1);

    // Negative control: a quote absent from the chapter text must be rejected.
    const fabricated: EditorialFinding = {
      ...groundedFinding(),
      spans: [
        { chapterRef: 'c1.xhtml', cfi: null, quote: 'not in the text', sourceSha256: 'sha256:x' },
      ],
    };
    const negative = validateEditorialFindings([fabricated], {
      chapterText: input.chapterText,
      chapterSha256: input.chapterSha256,
      referenceRevisions: { 'ref-1': 2 },
      styleRevision: 4,
    });
    expect(negative.rejected.map((rejection) => rejection.reason)).toEqual(['quote_not_found']);
  });
});
