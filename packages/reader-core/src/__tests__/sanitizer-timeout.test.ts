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
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValue(100_000);
    expect(() => {
      sanitizeEpubDocument(doc, { timeoutMs: 5000 });
    }).toThrow(TimeoutError);
  });

  it('passes traceId through to TimeoutError', () => {
    const doc = createDoc();
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValue(100_000);
    try {
      sanitizeEpubDocument(doc, { timeoutMs: 5000, traceId: 'trace-sanitize-1' });
      expect.fail('Expected TimeoutError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).traceId).toBe('trace-sanitize-1');
    }
  });

  it('existing sanitizer behavior is preserved', () => {
    const doc = createDoc();
    const p = doc.createElement('p');
    p.setAttribute('onclick', 'alert(1)');
    p.textContent = 'Click me';
    doc.body.appendChild(p);
    const badLink = doc.createElement('a');
    badLink.setAttribute('href', 'javascript:void(0)');
    badLink.textContent = 'Bad link';
    doc.body.appendChild(badLink);
    const goodLink = doc.createElement('a');
    goodLink.setAttribute('href', 'https://example.com');
    goodLink.textContent = 'Good link';
    doc.body.appendChild(goodLink);
    sanitizeEpubDocument(doc);
    const resultP = doc.querySelector('p');
    expect(resultP?.hasAttribute('onclick')).toBe(false);
    const links = doc.querySelectorAll('a');
    expect(links.length).toBe(2);
    const resultBadLink = Array.from(links).find(
      (a) => a.textContent === 'Bad link',
    );
    expect(resultBadLink?.getAttribute('href')).toBeNull();
    const resultGoodLink = Array.from(links).find(
      (a) => a.textContent === 'Good link',
    );
    expect(resultGoodLink?.getAttribute('href')).toBe('https://example.com');
  });
});

describe('createEpubSanitizerHook timeout integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hook propagates traceId to TimeoutError', () => {
    const hook = createEpubSanitizerHook({ timeoutMs: 5000, traceId: 'hook-trace-42' });
    const doc = createDoc();
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValue(100_000);
    try {
      hook({ document: doc });
      expect.fail('Expected TimeoutError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).traceId).toBe('hook-trace-42');
    }
  });
});
