import { describe, expect, it, vi, afterEach } from 'vitest';
import { TimeoutError } from '@do-epub-studio/shared';
import { sanitizeEpubDocument, createEpubSanitizerHook } from '../sanitizer';

// eslint-disable-next-line security/detect-non-literal-fs-filename -- Test fixture: HTML string for DOMParser, not XSS
function createDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('Sanitizer timeout integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sanitizes a normal document within deadline', () => {
    const doc = createDoc('<html><body><p>Hello world</p></body></html>');
    sanitizeEpubDocument(doc);
    expect(doc.querySelector('p')).not.toBeNull();
    expect(doc.querySelector('p')?.textContent).toBe('Hello world');
  });

  it('throws TimeoutError when deadline is exceeded', () => {
    const doc = createDoc('<html><body><p>Test</p></body></html>');
    // createDeadline calls performance.now() once, then checkDeadline calls it again.
    // Return 0 for the first call (createDeadline), then a huge value for checkDeadline.
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValue(100_000);
    expect(() => {
      sanitizeEpubDocument(doc, { timeoutMs: 5000 });
    }).toThrow(TimeoutError);
  });

  it('passes traceId through to TimeoutError', () => {
    const doc = createDoc('<html><body><p>Test</p></body></html>');
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
    const doc = createDoc(
      '<html><body><p onclick="alert(1)">Click me</p><a href="javascript:void(0)">Bad link</a><a href="https://example.com">Good link</a></body></html>',
    );
    sanitizeEpubDocument(doc);
    const p = doc.querySelector('p');
    expect(p?.hasAttribute('onclick')).toBe(false);
    // DOMPurify keeps the <a> element but strips javascript: href via sanitizeDom
    const links = doc.querySelectorAll('a');
    expect(links.length).toBe(2);
    // javascript: href should be stripped
    const badLink = Array.from(links).find(
      (a) => a.textContent === 'Bad link',
    );
    expect(badLink?.getAttribute('href')).toBeNull();
    // Safe href should be preserved
    const goodLink = Array.from(links).find(
      (a) => a.textContent === 'Good link',
    );
    expect(goodLink?.getAttribute('href')).toBe('https://example.com');
  });
});

describe('createEpubSanitizerHook timeout integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hook propagates traceId to TimeoutError', () => {
    const hook = createEpubSanitizerHook({ timeoutMs: 5000, traceId: 'hook-trace-42' });
    const doc = createDoc('<html><body><p>Test</p></body></html>');
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
