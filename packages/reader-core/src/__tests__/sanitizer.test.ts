import { afterEach, describe, expect, it, vi } from 'vitest';
import DOMPurify from 'dompurify';
import { sanitizeSvg, sanitizeDom, sanitizeEpubDocument, createSvgSanitizerHook, createEpubSanitizerHook, SANITIZER_POLICY_VERSION, buildExternalUrlCsp, createExternalUrlGuardHook, isAllowedExternalHost } from '../sanitizer';

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

  // GOAP-224 A1 acceptance: the ALLOWED_TAGS allowlist must strip arbitrary
  // HTML (script, foreignObject) smuggled inside an SVG while preserving
  // allowed SVG elements (path) and dropping event-handler attributes.
  it('strips HTML tags and event handlers while keeping allowed SVG tags', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<script>alert(1)</script>' +
      '<foreignObject><body onload="alert(1)"></body></foreignObject>' +
      '<path d="M0 0h10v10H0z" onload="alert(2)"/>' +
      '</svg>';
    const result = sanitizeSvg(html);
    expect(result).toContain('<path');
    expect(result).not.toContain('script');
    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('foreignobject');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert');
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

describe('isAllowedExternalHost', () => {
  const allow = (hosts: string[]) => ({ mode: 'allowlist' as const, hosts });

  it('matches exact host', () => {
    expect(isAllowedExternalHost('https://example.com/a.svg', allow(['example.com']))).toBe(true);
  });

  it('matches strict subdomains of an allowlist entry', () => {
    expect(isAllowedExternalHost('https://cdn.example.com/a.svg', allow(['example.com']))).toBe(true);
    expect(isAllowedExternalHost('https://a.b.example.com/x', allow(['example.com']))).toBe(true);
  });

  it('rejects a host that only contains the entry as a suffix of its own label', () => {
    // `example.com.evil.org` ends with neither `.example.com` nor `example.com`.
    expect(isAllowedExternalHost('https://example.com.evil.org/x', allow(['example.com']))).toBe(false);
    expect(isAllowedExternalHost('https://notexample.com/x', allow(['example.com']))).toBe(false);
  });

  it('normalizes a trailing dot on both host and entry', () => {
    expect(isAllowedExternalHost('https://example.com.:8443/a', allow(['example.com.']))).toBe(true);
  });

  it('normalizes port, userinfo and host case', () => {
    expect(isAllowedExternalHost('https://user:pass@EXAMPLE.COM:8443/a.svg', allow(['example.com']))).toBe(true);
  });

  it('denies the whole allowlist under block-all', () => {
    expect(isAllowedExternalHost('https://example.com/a', { mode: 'block-all' })).toBe(false);
  });

  it('denies unparseable / malformed hosts (safe default)', () => {
    expect(isAllowedExternalHost('http:///no-host/x', allow(['example.com']))).toBe(false);
    expect(isAllowedExternalHost('https://exa mple.com/x', allow(['example.com']))).toBe(false);
    expect(isAllowedExternalHost('https://[::1]/x', allow(['example.com']))).toBe(false);
  });

  it('denies a host longer than the DNS bound', () => {
    const longHost = `${'a'.repeat(253)}.example.com`;
    expect(isAllowedExternalHost(`https://${longHost}/x`, allow(['example.com']))).toBe(false);
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

  it('removes javascript: href from use/image elements by scheme', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<use href="javascript:alert(1)"/>' +
      '<image href="javascript:evil()"/>' +
      '</svg>';
    const doc = createDoc(html);
    sanitizeDom(doc);
    expect(doc.querySelector('use')?.getAttribute('href')).toBeNull();
    expect(doc.querySelector('image')?.getAttribute('href')).toBeNull();
  });

  it('removes mixed-case and non-http(s)/mailto schemes on linkable elements', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<use href="JaVaScRiPt:alert(1)"/>' +
      '<use href="data:text/html;base64,PHNjcmlwdD4="/>' +
      '<use href="vbscript:msgbox(1)"/>' +
      '<use href="ftp://host/file.svg"/>' +
      '</svg>';
    const doc = createDoc(html);
    sanitizeDom(doc);
    const uses = doc.querySelectorAll('use');
    expect(uses).toHaveLength(4);
    uses.forEach((use) => {
      expect(use.getAttribute('href')).toBeNull();
    });
  });

  it('keeps mailto but strips http/https hrefs on use/image by default (host allowlist)', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<use href="http://example.com/a.svg"/>' +
      '<use href="https://example.com/b.svg"/>' +
      '<image href="mailto:user@example.com"/>' +
      '</svg>';
    const doc = createDoc(html);
    sanitizeDom(doc);
    // GoAP-224 hardening: absolute http(s) hosts are default-deny (block-all),
    // so the browser cannot egress to an arbitrary CDN/host from EPUB content.
    expect(doc.querySelectorAll('use')[0]?.getAttribute('href')).toBeNull();
    expect(doc.querySelectorAll('use')[1]?.getAttribute('href')).toBeNull();
    expect(doc.querySelector('image')?.getAttribute('href')).toBe('mailto:user@example.com');
  });

  it('keeps http/https hrefs whose host is allowlisted', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<use href="https://example.com/a.svg"/>' +
      '<use href="https://cdn.example.com/b.svg"/>' +
      '<use href="https://evil.org/c.svg"/>' +
      '</svg>';
    const doc = createDoc(html);
    const policy = { mode: 'allowlist' as const, hosts: ['example.com'] };
    sanitizeDom(doc, undefined, undefined, undefined, policy);
    const uses = doc.querySelectorAll('use');
    expect(uses[0]?.getAttribute('href')).toBe('https://example.com/a.svg');
    // Strict subdomains of an entry are allowed.
    expect(uses[1]?.getAttribute('href')).toBe('https://cdn.example.com/b.svg');
    // Non-allowlisted host is stripped.
    expect(uses[2]?.getAttribute('href')).toBeNull();
  });

  it('normalizes ports, userinfo and scheme case in allowlist matching', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<use href="https://user:pass@EXAMPLE.com:8443/a.svg"/>' +
      '<use href="http://example.com.evil.org/x.svg"/>' +
      '<use href="https://sub.example.co/y.svg"/>' +
      '</svg>';
    const doc = createDoc(html);
    const policy = { mode: 'allowlist' as const, hosts: ['example.com'] };
    sanitizeDom(doc, undefined, undefined, undefined, policy);
    const uses = doc.querySelectorAll('use');
    // Host case, port and userinfo are normalized away; entry matches.
    expect(uses[0]?.getAttribute('href')).toBe('https://user:pass@EXAMPLE.com:8443/a.svg');
    // `example.com.evil.org` is NOT a subdomain of `example.com` (boundary match).
    expect(uses[1]?.getAttribute('href')).toBeNull();
    // `sub.example.co` does not match `example.com`.
    expect(uses[2]?.getAttribute('href')).toBeNull();
  });

  it('block-all policy strips http(s) but keeps relative/fragment/mailto', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<use href="https://evil.com/glyph.svg"/>' +
      '<use href="images/icon.svg"/>' +
      '<use href="#glyph"/>' +
      '</svg>';
    const doc = createDoc(html);
    const policy = { mode: 'block-all' as const };
    sanitizeDom(doc, undefined, undefined, undefined, policy);
    const uses = doc.querySelectorAll('use');
    expect(uses[0]?.getAttribute('href')).toBeNull();
    expect(uses[1]?.getAttribute('href')).toBe('images/icon.svg');
    expect(uses[2]?.getAttribute('href')).toBe('#glyph');
  });

  it('strips malformed/unparseable http hrefs (parse failure = deny)', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<use href="http:///no-host/path.svg"/>' +
      '<use href="http://exa mple.com/x.svg"/>' +
      '<use href="http://[::1]/x.svg"/>' +
      '</svg>';
    const doc = createDoc(html);
    const policy = { mode: 'allowlist' as const, hosts: ['example.com'] };
    sanitizeDom(doc, undefined, undefined, undefined, policy);
    const uses = doc.querySelectorAll('use');
    uses.forEach((use) => {
      expect(use.getAttribute('href')).toBeNull();
    });
  });

  it('keeps scheme-less relative and fragment hrefs on use/image elements', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<use href="images/icon.svg"/>' +
      '<use href="#glyph"/>' +
      '</svg>';
    const doc = createDoc(html);
    sanitizeDom(doc);
    const uses = doc.querySelectorAll('use');
    expect(uses[0]?.getAttribute('href')).toBe('images/icon.svg');
    expect(uses[1]?.getAttribute('href')).toBe('#glyph');
  });

  it('removes hrefs with schemes longer than 32 chars (equivalence with old regex)', () => {
    // Old code matched any [a-zA-Z][a-zA-Z0-9+.-]* scheme up to the 2048-char
    // matchBounded window and removed it unless whitelisted. getScheme must
    // match that: a 64-char scheme prefix is a real scheme, not "no scheme",
    // and must be removed — not kept via an arbitrary short cap.
    const longScheme = 'a'.repeat(64);
    const html =
      `<svg xmlns="http://www.w3.org/2000/svg">` +
      `<use href="${longScheme}:evil"/>` +
      `</svg>`;
    const doc = createDoc(html);
    sanitizeDom(doc);
    expect(doc.querySelector('use')?.getAttribute('href')).toBeNull();
  });

  it('keeps hrefs whose colon sits beyond the 2048-char scan bound', () => {
    // A 5000-char alpha prefix with the ':' at index 5000 is beyond the
    // matchBounded window the old regex operated in (it returned null and kept
    // the attribute); no browser-executable scheme is 5000 chars, so keeping
    // it is not a javascript:/data:/vbscript: vector and matches OLD behavior.
    const hugePrefix = 'b'.repeat(5000);
    const html =
      `<svg xmlns="http://www.w3.org/2000/svg">` +
      `<use href="${hugePrefix}:evil"/>` +
      `</svg>`;
    const doc = createDoc(html);
    sanitizeDom(doc);
    expect(doc.querySelector('use')?.getAttribute('href')).not.toBeNull();
  });

  it('removes hrefs with schemes up to the 2048-char scan bound', () => {
    const nearBoundScheme = 'c'.repeat(2048);
    const html =
      `<svg xmlns="http://www.w3.org/2000/svg">` +
      `<use href="${nearBoundScheme}:evil"/>` +
      `</svg>`;
    const doc = createDoc(html);
    sanitizeDom(doc);
    expect(doc.querySelector('use')?.getAttribute('href')).toBeNull();
  });

  it('removes non-whitelisted-scheme hrefs from feImage (SSRF gap fix)', () => {
    // feImage references an external raster/filter resource via href/xlink:href;
    // the EPUB pipeline (sanitizeEpubDocument pass (a)) permits `href` on
    // allowed SVG tags, so only this scheme pass protects it. javascript:/data:/
    // non-http(s)/mailto schemes must be stripped.
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<feImage href="data:text/html;base64,PHNjcmlwdD4="/>' +
      '<feImage xlink:href="javascript:alert(1)"/>' +
      '<feImage href="ftp://host/filter.png"/>' +
      '</svg>';
    const doc = createDoc(html);
    sanitizeDom(doc);
    const images = doc.querySelectorAll('feImage');
    expect(images).toHaveLength(3);
    images.forEach((img) => {
      expect(img.getAttribute('href')).toBeNull();
      expect(img.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBeNull();
    });
  });

  it('strips http/https hrefs on feImage by default and keeps allowlisted hosts', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<feImage href="https://example.com/filter.svg"/>' +
      '</svg>';
    const doc = createDoc(html);
    // default = block-all → stripped
    sanitizeDom(doc);
    expect(doc.querySelector('feImage')?.getAttribute('href')).toBeNull();

    // allowlisted host → kept
    const allowDoc = createDoc(html);
    sanitizeDom(allowDoc, undefined, undefined, undefined, { mode: 'allowlist', hosts: ['example.com'] });
    expect(allowDoc.querySelector('feImage')?.getAttribute('href')).toBe('https://example.com/filter.svg');
  });

  it('strips non-whitelisted-scheme feImage hrefs through the EPUB document pipeline', () => {
    const html =
      '<html><body>' +
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<feImage href="data:text/html;base64,PHNjcmlwdD4="/>' +
      '</svg>' +
      '</body></html>';
    const doc = createDoc(html);
    sanitizeEpubDocument(doc);
    expect(doc.querySelector('feImage')?.getAttribute('href')).toBeNull();
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

  it('applies the externalUrlPolicy option through the EPUB document pipeline', () => {
    const externalImg =
      '<html><body>' +
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<image href="https://cdn.example.com/cover.jpg"/>' +
      '<use href="https://evil.org/track.svg"/>' +
      '</svg>' +
      '</body></html>';

    // default (block-all): external hosts stripped
    const blockDoc = createDoc(externalImg);
    sanitizeEpubDocument(blockDoc);
    expect(blockDoc.querySelector('image')?.getAttribute('href')).toBeNull();

    // allowlist permits example.com (exact + subdomain), strips others
    const allowDoc = createDoc(externalImg);
    sanitizeEpubDocument(allowDoc, { externalUrlPolicy: { mode: 'allowlist', hosts: ['example.com'] } });
    expect(allowDoc.querySelector('image')?.getAttribute('href')).toBe('https://cdn.example.com/cover.jpg');
    expect(allowDoc.querySelector('use')?.getAttribute('href')).toBeNull();
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

  // GOAP-224 B18 + C14: the cache-HIT path must reproduce the MISS output
  // byte-for-byte (including the DOMPurify 3-pass result) and sync the live
  // <html> attributes — otherwise re-rendering a cached chapter drops lang/dir.
  it('produces byte-identical output on cache HIT and syncs html attributes (B18/C14)', () => {
    const { hook } = createEpubSanitizerHook();
    const sanitizeSpy = vi.spyOn(DOMPurify, 'sanitize');

    const input = '<html lang="ar" dir="rtl"><head><script>alert(1)</script><title>Ch</title></head><body><p onclick="x()">Hello</p></body></html>';

    const missDoc = new DOMParser().parseFromString(input, 'text/html');
    hook({ document: missDoc, href: 'chapter1.xhtml' });
    const missOutput = missDoc.documentElement.outerHTML;
    const missCount = sanitizeSpy.mock.calls.length;
    expect(missCount).toBeGreaterThan(0);

    // Same raw input for the same href — a cache HIT must not re-run the
    // DOMPurify pipeline.
    const hitDoc = new DOMParser().parseFromString(input, 'text/html');
    hook({ document: hitDoc, href: 'chapter1.xhtml' });
    expect(sanitizeSpy.mock.calls.length).toBe(missCount);

    expect(hitDoc.documentElement.outerHTML).toBe(missOutput);
    expect(hitDoc.querySelector('script')).toBeNull();
    expect(hitDoc.querySelector('p')?.getAttribute('onclick')).toBeNull();
    // C14: <html> attributes (lang, dir) synced on HIT exactly like MISS.
    expect(hitDoc.documentElement.getAttribute('lang')).toBe('ar');
    expect(hitDoc.documentElement.getAttribute('dir')).toBe('rtl');
  });

  // GOAP-224 C8: policy-version invalidation is tested across hook instances,
  // not as a runtime bump of the module constant. This is the correct observable
  // contract for this design: a hook captures `policyVersion` (and its own Map)
  // at construction, so a bump affects only hooks created afterwards — there is
  // no shared/global cache a mid-session constant change could invalidate. Two
  // hooks with different versions must never share cached output.
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

  it('applies externalUrlPolicy to nested svg use/image hrefs', () => {
    const hook = createSvgSanitizerHook({ externalUrlPolicy: { mode: 'allowlist', hosts: ['example.com'] } });
    const doc = new DOMParser().parseFromString(
      '<html><body>' +
        '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<use href="https://example.com/a.svg"/>' +
        '<use href="https://evil.org/b.svg"/>' +
        '</svg>' +
        '</body></html>',
      'text/html',
    );
    hook({ document: doc });
    const uses = doc.querySelectorAll('use');
    expect(uses[0]?.getAttribute('href')).toBe('https://example.com/a.svg');
    expect(uses[1]?.getAttribute('href')).toBeNull();
  });
});

describe('buildExternalUrlCsp', () => {
  it('block-all policy default-denies every external subresource source', () => {
    const csp = buildExternalUrlCsp({ mode: 'block-all' });
    const directives = new Map(
      csp.split(';').map((d) => {
        const [k, ...rest] = d.trim().split(' ');
        return [k, rest.join(' ')];
      }),
    );
    // No external origin appears anywhere.
    expect(csp).not.toContain('https://');
    // Book-local resources still work.
    expect(directives.get('img-src')).toContain('blob:');
    expect(directives.get('img-src')).toContain('data:');
    expect(directives.get('img-src')).toContain("'self'");
    expect(directives.get('style-src')).toContain("'unsafe-inline'");
    expect(directives.get('object-src')).toBe("'none'");
    expect(directives.get('frame-src')).toBe("'none'");
    expect(directives.get('base-uri')).toBe("'none'");
    expect(directives.get('form-action')).toBe("'none'");
    expect(directives.get('connect-src')).toBe("'self'");
  });

  it('allowlist policy adds https origins to subresource directives', () => {
    const csp = buildExternalUrlCsp({ mode: 'allowlist', hosts: ['example.com', 'cdn.example.com'] });
    const directives = new Map(
      csp.split(';').map((d) => {
        const [k, ...rest] = d.trim().split(' ');
        return [k, rest.join(' ')];
      }),
    );
    expect(directives.get('img-src')).toContain('https://example.com');
    expect(directives.get('connect-src')).toContain('https://example.com');
  });
});

describe('createExternalUrlGuardHook', () => {
  function docFrom(html: string): Document {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  it('injects a strict CSP meta into the chapter head (block-all default)', () => {
    const { hook } = createExternalUrlGuardHook();
    const doc = docFrom('<html><head><title>Ch</title></head><body><p>x</p></body></html>');
    hook({ document: doc });
    const meta = doc.head?.querySelector('meta[http-equiv="Content-Security-Policy"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toContain("img-src 'self' blob: data:");
    expect(meta?.getAttribute('content')).not.toContain('https://');
  });

  it('accepts a raw Document payload (epubjs section hook path)', () => {
    const { hook } = createExternalUrlGuardHook();
    const doc = docFrom('<html><head></head><body><p>x</p></body></html>');
    hook(doc);
    expect(doc.head?.querySelector('meta[http-equiv="Content-Security-Policy"]')).not.toBeNull();
  });

  it('is idempotent across repeated invocation', () => {
    const { hook } = createExternalUrlGuardHook();
    const doc = docFrom('<html><head></head><body></body></html>');
    hook({ document: doc });
    hook({ document: doc });
    expect(doc.head?.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')).toHaveLength(1);
  });

  it('does not throw when the document has no head', () => {
    const { hook } = createExternalUrlGuardHook();
    expect(() => hook({})).not.toThrow();
    expect(() => hook({ document: undefined })).not.toThrow();
  });
});
