import { describe, expect, it, vi, afterEach } from 'vitest';
import { TimeoutError } from '@do-epub-studio/shared';
import { sanitizeEpubDocument, createEpubSanitizerHook } from '../sanitizer';

function createDoc(): Document {
  return document.implementation.createHTMLDocument('');
}

describe('Sanitizer timeout integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sanitizes a normal document within deadline', () => {
    const doc = createDoc();
    const p = doc.createElement('p');
    p.textContent = 'Hello world';
    doc.body.appendChild(p);
    sanitizeEpubDocument(doc);
    expect(doc.querySelector('p')).not.toBeNull();
    expect(doc.querySelector('p')?.textContent).toBe('Hello world');
  });

  it('throws TimeoutError when deadline is exceeded', () => {
    const doc = createDoc();
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(100_000);
    expect(() => {
      sanitizeEpubDocument(doc, { timeoutMs: 5000 });
    }).toThrow(TimeoutError);
  });

  it('passes traceId through to TimeoutError', () => {
    const doc = createDoc();
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(100_000);
    try {
      sanitizeEpubDocument(doc, { timeoutMs: 5000, traceId: 'trace-sanitize-1' });
      expect.fail('Expected TimeoutError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).traceId).toBe('trace-sanitize-1');
    }
  });
});

describe('createEpubSanitizerHook timeout integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hook propagates traceId to TimeoutError', () => {
    const { hook } = createEpubSanitizerHook({ timeoutMs: 5000, traceId: 'hook-trace-42' });
    const doc = createDoc();
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(100_000);
    try {
      hook({ document: doc });
      expect.fail('Expected TimeoutError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).traceId).toBe('hook-trace-42');
    }
  });
});
