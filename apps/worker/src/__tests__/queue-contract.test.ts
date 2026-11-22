import { describe, it, expect, vi } from 'vitest';
import { EpubValidationMessageSchema, EpubRunnerResultSchema, EPUBCHECK_VERSION } from '@do-epub-studio/schema';
import { enqueueEpubValidation, processEpubValidationQueue, type EpubValidationMessage } from '../lib/epub-validation-queue';
import { makeEnv } from './fixtures';

describe('EPUB validation queue contract', () => {
  it('producer payload matches the shared schema (bookId + revisionId)', () => {
    const message: EpubValidationMessage = { bookId: 'b-1', revisionId: 'r-1' };
    expect(EpubValidationMessageSchema.safeParse(message).success).toBe(true);
    const bad = EpubValidationMessageSchema.safeParse({ bookId: '', revisionId: 'r-1' });
    expect(bad.success).toBe(false);
  });

  it('enqueueEpubValidation sends the schema-typed message', async () => {
    const env = makeEnv();
    const send = vi.fn().mockResolvedValue(undefined);
    env.EPUB_VALIDATION_QUEUE = { send } as never;

    await enqueueEpubValidation(env, { bookId: 'b-1', revisionId: 'r-1' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(EpubValidationMessageSchema.safeParse(send.mock.calls[0]?.[0]).success).toBe(true);
  });

  it('consumer defers a malformed batch message through retry (no ack)', async () => {
    const env = makeEnv();
    const retry = vi.fn();
    const ack = vi.fn();
    const message = {
      id: 'm1',
      timestamp: new Date(),
      attempts: 1,
      body: { bookId: '' },
      ack,
      retry,
    };
    const batch = { queue: 'epub-validation', messages: [message] } as never;

    await processEpubValidationQueue(batch, env);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(ack).not.toHaveBeenCalled();
  });

  it('runner result schema is pinned to the supported EPUBCHECK version', () => {
    expect(EPUBCHECK_VERSION).toBe('5.4.0');
    const profile = {
      spec: null,
      experimental: false,
      certification: 'not-certified',
      findings: [],
      evidence: [],
    };
    const valid = {
      validatorVersion: EPUBCHECK_VERSION,
      sha256: 'a'.repeat(64),
      epubVersion: '3.0',
      findings: [],
      accessibility: {
        metadata: [],
        advisories: [],
        manualReviewRequired: false,
        certification: 'not-certified',
        profiles: { '1.1': profile, '1.2-draft': profile },
      },
    };
    expect(EpubRunnerResultSchema.safeParse(valid).success).toBe(true);
    const wrongVersion = { ...valid, validatorVersion: '9.9.9' };
    expect(EpubRunnerResultSchema.safeParse(wrongVersion).success).toBe(false);
  });
});
