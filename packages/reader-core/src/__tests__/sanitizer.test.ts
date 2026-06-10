import { describe, expect, it } from 'vitest';
import { sanitizeSvg, sanitizeDom, sanitizeEpubDocument, createSvgSanitizerHook, createEpubSanitizerHook } from '../sanitizer';

function createDocument(htmlContent: string): Document {
  return new DOMParser().parseFromString(htmlContent, 'text/html');
}

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

  it('allows safe href attributes', () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"><use href="#mySymbol"/><image href="image.png"/></svg>';
    const result = sanitizeSvg(html);
    expect(result).toContain('#mySymbol');
    expect(result).toContain('image.png');
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
    const firstPassMarkup = doc.documentElement.innerHTML;

    sanitizeEpubDocument(doc);
    const secondPassMarkup = doc.documentElement.innerHTML;

    expect(firstPassMarkup).toBe(secondPassMarkup);
    expect(doc.querySelector('script')).toBeNull();
  });
});

describe('createEpubSanitizerHook', () => {
  it('returns a function that does not throw with empty contents', () => {
    const hook = createEpubSanitizerHook();
    expect(() => hook({})).not.toThrow();
  });

  it('sanitizes the document passed to the hook', () => {
    const hook = createEpubSanitizerHook();
    const doc = createDocument('<html><body><script>alert(1)</script></body></html>');
    hook({ document: doc });
    expect(doc.querySelector('script')).toBeNull();
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
