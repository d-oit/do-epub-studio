import { afterEach, describe, expect, it, vi } from 'vitest';
import DOMPurify from 'dompurify';
import { sanitizeSvg, sanitizeDom, sanitizeEpubDocument, createSvgSanitizerHook, createEpubSanitizerHook, SANITIZER_POLICY_VERSION } from '../sanitizer';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sanitizeSvg', () => {
  it('allows safe SVG tags', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h100v100H0z"/><rect x="10" y="10" width="50" height="50"/><circle cx="50" cy="50" r="40"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).toContain('<svg');
    expect(result).toContain('</svg>');
    expect(result).toContain('<path');
    expect(result).toContain('<rect');
    expect(result).toContain('<circle');
  });

  it('removes event handlers from SVG elements', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" onclick="alert(1)" onload="alert(2)" onmouseover="evil()"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('onmouseover');
    expect(result).not.toContain('alert');
  });

  it('removes foreignObject elements', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="evil.com"></iframe></foreignObject><rect width="100" height="100"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('foreignobject');
    expect(result).not.toContain('iframe');
    expect(result).not.toContain('evil');
    expect(result).toContain('<rect');
  });

  it('strips script injection via SVG', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="100" height="100"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<rect');
  });

  it('blocks javascript: URLs in href attributes', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><use href="javascript:alert(1)"/><image xlink:href="javascript:alert(2)"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).not.toContain('javascript:');
  });

  it('strips all href and xlink:href attributes (SSRF prevention)', () => {
    // sanitizeSvg is for standalone SVG snippets — href is forbidden to block
    // feImage SSRF (external resource loading via <feImage href="https://..."/>)
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><use href="#mySymbol"/><image href="image.png"/><feImage href="https://evil.com/track.gif"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).not.toContain('href');
    expect(result).not.toContain('xlink:href');
    expect(result).not.toContain('evil.com');
    // Elements are still present — only the href attribute is removed
    expect(result).toContain('<use');
    expect(result).toContain('<image');
  });

  it('removes style elements from SVG', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><style>body { background: red; }</style><rect width="100" height="100"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).not.toContain('<style>');
    expect(result).not.toContain('background: red');
    expect(result).toContain('<rect');
  });

  it('preserves inline style attributes', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" style="fill: red; stroke: black;"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).toContain('fill: red');
    expect(result).toContain('stroke: black');
  });

  it('allows gradient and filter definitions', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="grad"><stop offset="0%" stop-color="red"/><stop offset="100%" stop-color="blue"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="3"/></filter></defs><rect width="100" height="100" fill="url(#grad)" filter="url(#blur)"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).toContain('<linearGradient');
    expect(result).toContain('<filter');
    expect(result).toContain('feGaussianBlur');
    expect(result).toContain('stop-color');
  });

  it('handles empty string gracefully', () => {
    const result = sanitizeSvg('');
    expect(result).toBe('');
  });

  it('blocks feImage href to prevent SSRF', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="f1"><feImage href="https://evil.com/track.gif" result="img"/></filter><rect width="100" height="100" filter="url(#f1)"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).not.toContain('href');
    expect(result).not.toContain('evil.com');
    // The feImage element itself remains (it is in SAFE_SVG_TAGS); only href is removed
    expect(result).toContain('<feImage');
  });

  it('sanitizes XSS via SVG animate elements', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><animate onbegin="alert(1)" attributeName="x" values="0;100" dur="1s"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).not.toContain('onbegin');
    expect(result).not.toContain('alert');
  });

  it('removes iframe from SVG', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><iframe src="https://evil.com"></iframe><rect width="100" height="100"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).not.toContain('iframe');
    expect(result).not.toContain('evil');
    expect(result).toContain('<rect');
  });
});

describe('sanitizeDom', () => {
  function createDoc(htmlContent: string): Document {
    return new DOMParser().parseFromString(htmlContent, 'text/html');
  }

  it('preserves foreignObject in SVG in DOM (handled by DOMPurify config instead)', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>test</div></foreignObject><rect width="100" height="100"/></svg>';
    const doc = createDoc(html);
    const svg = doc.querySelector('svg') as Element;
    expect(svg).not.toBeNull();
    sanitizeDom(svg);
    expect(svg.querySelector('foreignObject')).not.toBeNull();
    expect(svg.querySelector('rect')).not.toBeNull();
  });

  it('removes event handlers from SVG elements in DOM', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" onload="evil()"/></svg>';
    const doc = createDoc(html);
    const svg = doc.querySelector('svg') as Element;
    expect(svg).not.toBeNull();
    sanitizeDom(svg);
    const rect = svg.querySelector('rect') as Element;
    expect(rect).not.toBeNull();
    expect(rect.getAttribute('onclick')).toBeNull();
    expect(rect.getAttribute('onload')).toBeNull();
  });

  it('handles document with no SVGs', () => {
    const html = '<p>Hello</p>';
    const doc = createDoc(html);
    expect(() => {
      sanitizeDom(doc);
    }).not.toThrow();
  });
});

describe('sanitizeEpubDocument', () => {
  function createDoc(htmlContent: string): Document {
    return new DOMParser().parseFromString(htmlContent, 'text/html');
  }

  it('removes scripts from the document', () => {
    const html = '<html><body><script>alert(1)</script><p>Hello</p></body></html>';
    const doc = createDoc(html);
    sanitizeEpubDocument(doc);
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('p')).not.toBeNull();
  });

  it('preserves allowed styling tags', () => {
    const html = '<html><head><style>body { color: red; }</style><link rel="stylesheet" href="style.css"/><meta name="viewport" content="width=device-width"/></head><body><p>Hello</p></body></html>';
    const doc = createDoc(html);
    sanitizeEpubDocument(doc);
    expect(doc.querySelector('style')).not.toBeNull();
    expect(doc.querySelector('link')).not.toBeNull();
    expect(doc.querySelector('meta')).not.toBeNull();
  });

  it('removes dangerous tags', () => {
    const html = '<html><body><iframe src="evil.com"></iframe><object data="flash.swf"></object><embed src="plugin.exe"/></body></html>';
    const doc = createDoc(html);
    sanitizeEpubDocument(doc);
    expect(doc.querySelector('iframe')).toBeNull();
    expect(doc.querySelector('object')).toBeNull();
    expect(doc.querySelector('embed')).toBeNull();
  });

  it('removes event handlers', () => {
    const html = '<html><body><p onclick="alert(1)">Click</p></body></html>';
    const doc = createDoc(html);
    sanitizeEpubDocument(doc);
    const p = doc.querySelector('p');
    expect(p).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verified by expect above
    expect(p!.hasAttribute('onclick')).toBe(false);
  });

  it('blocks dangerous href schemes', () => {
    const html = '<html><body><a href="javascript:alert(1)">Link</a></body></html>';
    const doc = createDoc(html);
    sanitizeEpubDocument(doc);
    expect(doc.querySelector('a')?.getAttribute('href')).toBeNull();
  });

  it('removes form elements (prevents phishing)', () => {
    const html = '<html><body><form action="http://evil.com"><input type="text" name="user"/><button type="submit">Login</button></form></body></html>';
    const doc = createDoc(html);
    sanitizeEpubDocument(doc);
    expect(doc.querySelector('form')).toBeNull();
    expect(doc.querySelector('input')).toBeNull();
    expect(doc.querySelector('button')).toBeNull();
  });

  it('removes unknown/custom tags not in allowlist', () => {
    const html = '<html><body><danger-tag>evil</danger-tag><p>Safe</p></body></html>';
    const doc = createDoc(html);
    sanitizeEpubDocument(doc);
    expect(doc.querySelector('danger-tag')).toBeNull();
    expect(doc.querySelector('p')).not.toBeNull();
  });

  it('preserves structural tags (html, head, body)', () => {
    const html = '<html lang="en"><head><title>Test</title></head><body><p>Hello</p></body></html>';
    const doc = createDoc(html);
    sanitizeEpubDocument(doc);
    expect(doc.documentElement.tagName.toLowerCase()).toBe('html');
    expect(doc.documentElement.getAttribute('lang')).toBe('en');
    expect(doc.head).not.toBeNull();
    expect(doc.body).not.toBeNull();
    expect(doc.body.querySelector('p')).not.toBeNull();
  });

  it('is idempotent (safe to invoke multiple times)', () => {
    const html = '<html><body><p>Test</p><script>alert(1)</script></body></html>';
    const doc = createDoc(html);

    sanitizeEpubDocument(doc);
    const firstPass = doc.documentElement.innerHTML;

    sanitizeEpubDocument(doc);
    const secondPass = doc.documentElement.innerHTML;

    expect(firstPass).toBe(secondPass);
    expect(doc.querySelector('script')).toBeNull();
  });
});

describe('createEpubSanitizerHook', () => {
  it('returns an object with hook', () => {
    const { hook } = createEpubSanitizerHook();
    expect(typeof hook).toBe('function');
  });

  it('hook does not throw with empty contents', () => {
    const { hook } = createEpubSanitizerHook();
    expect(() => hook({})).not.toThrow();
  });

  it('sanitizes the document passed to the hook', () => {
    const { hook } = createEpubSanitizerHook();
    const doc = new DOMParser().parseFromString('<html><body><script>alert(1)</script></body></html>', 'text/html');
    hook({ document: doc });
    expect(doc.querySelector('script')).toBeNull();
  });

  it('sanitizes chapter with href (cache miss path)', () => {
    const { hook } = createEpubSanitizerHook();
    const doc = new DOMParser().parseFromString('<html><body><script>alert(1)</script></body></html>', 'text/html');
    hook({ document: doc, href: 'chapter1.xhtml' });
    expect(doc.querySelector('script')).toBeNull();
  });

  it('uses cache on second call with same href', () => {
    const { hook } = createEpubSanitizerHook();
    const doc1 = new DOMParser().parseFromString('<html><body><p>clean</p></body></html>', 'text/html');
    hook({ document: doc1, href: 'chapter1.xhtml' });
    const doc2 = new DOMParser().parseFromString('<html><body><script>alert(1)</script></body></html>', 'text/html');
    hook({ document: doc2, href: 'chapter1.xhtml' });
    expect(doc2.querySelector('script')).toBeNull();
  });

  it('serves cached output without re-running the DOMPurify 3-pass pipeline on a hit', () => {
    const { hook } = createEpubSanitizerHook();
    const sanitizeSpy = vi.spyOn(DOMPurify, 'sanitize');
    const doc = new DOMParser().parseFromString('<html><body><p>clean</p></body></html>', 'text/html');
    hook({ document: doc, href: 'chapter1.xhtml' });
    const hitCount = sanitizeSpy.mock.calls.length;
    expect(hitCount).toBeGreaterThan(0);

    // A later document for the same href is REPLACED by the cached sanitized
    // output and never re-sanitized by DOMPurify — but must remain script-free.
    const doc2 = new DOMParser().parseFromString('<html><body><script>alert(1)</script></body></html>', 'text/html');
    hook({ document: doc2, href: 'chapter1.xhtml' });
    expect(sanitizeSpy.mock.calls.length).toBe(hitCount);
    expect(doc2.querySelector('script')).toBeNull();
  });

  it('invalidates the cache when the sanitizer policy version changes', () => {
    const sanitizeSpy = vi.spyOn(DOMPurify, 'sanitize');
    const { hook: hookA } = createEpubSanitizerHook({ policyVersion: 1 });
    const { hook: hookB } = createEpubSanitizerHook({ policyVersion: 2 });

    const docA1 = new DOMParser().parseFromString('<html><body><script>alert(1)</script></body></html>', 'text/html');
    hookA({ document: docA1, href: 'chapter1.xhtml' });
    const countAfterA = sanitizeSpy.mock.calls.length;
    expect(countAfterA).toBeGreaterThan(0);

    // B has a different policy version and does not share A's primitive cache.
    const docA2 = new DOMParser().parseFromString('<html><body><script>alert(2)</script></body></html>', 'text/html');
    hookA({ document: docA2, href: 'chapter1.xhtml' });
    expect(sanitizeSpy.mock.calls.length).toBe(countAfterA);

    const docB = new DOMParser().parseFromString('<html><body><script>alert(3)</script></body></html>', 'text/html');
    hookB({ document: docB, href: 'chapter1.xhtml' });
    expect(sanitizeSpy.mock.calls.length).toBeGreaterThan(countAfterA);
    expect(docB.querySelector('script')).toBeNull();
  });

  it('evicts least-recently-used entries when the cache exceeds the max size', () => {
    const { hook } = createEpubSanitizerHook();
    const sanitizeSpy = vi.spyOn(DOMPurify, 'sanitize');

    // Fill exactly SANITIZE_CACHE_MAX distinct chapters plus one to force eviction.
    for (let i = 0; i < 11; i++) {
      const doc = new DOMParser().parseFromString(`<html><body><p>c${i}</p></body></html>`, 'text/html');
      hook({ document: doc, href: `c${i}.xhtml` });
    }
    const countAfterFill = sanitizeSpy.mock.calls.length;
    expect(countAfterFill).toBeGreaterThan(0);

    // Re-visiting the first chapter (least recently used, evicted) re-sanitizes.
    const rehit = new DOMParser().parseFromString('<html><body><script>alert(1)</script></body></html>', 'text/html');
    hook({ document: rehit, href: 'c0.xhtml' });
    expect(sanitizeSpy.mock.calls.length).toBeGreaterThan(countAfterFill);
    expect(rehit.querySelector('script')).toBeNull();
  });

  it('exports a reference policy version that can be bumped to invalidate caches', () => {
    expect(SANITIZER_POLICY_VERSION).toBeGreaterThanOrEqual(1);
  });
});

describe('createSvgSanitizerHook', () => {
  it('returns a function that does not throw with empty contents', () => {
    const hook = createSvgSanitizerHook();
    expect(() => hook({})).not.toThrow();
  });

  it('returns a function that handles null document', () => {
    const hook = createSvgSanitizerHook();
    expect(() => hook({ document: undefined })).not.toThrow();
  });
});
