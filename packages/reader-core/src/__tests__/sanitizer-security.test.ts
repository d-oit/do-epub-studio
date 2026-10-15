import { describe, expect, it } from 'vitest';
import { sanitizeEpubDocument, sanitizeSvg, sanitizeCssText } from '../sanitizer';
import {
  MALICIOUS_XHTML_PAYLOADS,
  MALICIOUS_SVG_PAYLOADS,
  MALICIOUS_CSS_PAYLOADS,
  MALICIOUS_MATHML_PAYLOADS,
  LEGITIMATE_EPUB3_CONTENT,
} from './fixtures/malicious-epub';

function createDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function verifyNoDangerousSchemes(urlValue: string): void {
  const lower = urlValue.toLowerCase().trim();
  expect(lower.startsWith('javascript:')).toBe(false);
  expect(lower.startsWith('vbscript:')).toBe(false);
  expect(lower.startsWith('data:')).toBe(false);
}

describe('XHTML Security Vectors', () => {
  it('strips all malicious XHTML payloads', () => {
    for (const payload of MALICIOUS_XHTML_PAYLOADS) {
      const doc = createDoc(payload);
      sanitizeEpubDocument(doc);

      expect(doc.querySelector('script')).toBeNull();
      expect(doc.querySelector('iframe')).toBeNull();
      expect(doc.querySelector('object')).toBeNull();
      expect(doc.querySelector('form')).toBeNull();

      const allElements = doc.querySelectorAll('*');
      for (const el of allElements) {
        for (const attr of Array.from(el.attributes)) {
          expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
          if (attr.name === 'href' || attr.name === 'src') {
            verifyNoDangerousSchemes(attr.value);
          }
        }
      }
    }
  });
  describe('EPUB resource URL security', () => {
    it('blocks external subresource URLs before rendered chapters can fetch them', () => {
      const doc = createDoc(
        '<html><body>' +
          '<img id="remote" src="https://evil.test/pixel.png" srcset="https://evil.test/2x.png 2x, ../Images/large.png 3x">' +
          '<source id="protocol-relative" src="//evil.test/media.mp4">' +
          '<source id="backslash" src="\\\\evil.test\\media.mp4">' +
          '<img id="data" src="data:image/svg+xml,%3Csvg%3E">' +
          '<img id="local" src="../Images/local.png">' +
          '<a id="link" href="https://example.test/chapter">External link</a>' +
          '<a id="local-link" href="../chapter.xhtml">Local link</a>' +
          '<svg xmlns="http://www.w3.org/2000/svg"><image id="svg-remote" href="//evil.test/image.svg"/></svg>' +
          '</body></html>',
      );

      sanitizeEpubDocument(doc);

      expect(doc.querySelector('#remote')?.hasAttribute('src')).toBe(false);
      expect(doc.querySelector('#remote')?.hasAttribute('srcset')).toBe(false);
      expect(doc.querySelector('#protocol-relative')?.hasAttribute('src')).toBe(false);
      expect(doc.querySelector('#backslash')?.hasAttribute('src')).toBe(false);
      expect(doc.querySelector('#data')?.hasAttribute('src')).toBe(false);
      expect(doc.querySelector('#local')?.getAttribute('src')).toBe('../Images/local.png');
      expect(doc.querySelector('#link')?.hasAttribute('href')).toBe(false);
      expect(doc.querySelector('#local-link')?.getAttribute('href')).toBe('../chapter.xhtml');
      expect(doc.querySelector('#svg-remote')?.hasAttribute('href')).toBe(false);
    });

    it('allows only subresources on an explicit external host allowlist', () => {
      const doc = createDoc(
        '<html><body>' +
          '<img id="allowed" src="https://cdn.example.test/cover.jpg">' +
          '<img id="blocked" src="https://evil.test/track.png">' +
          '<source id="allowed-relative" src="//cdn.example.test/media.mp4">' +
          '<a id="allowed-link" href="https://cdn.example.test/chapter.xhtml">Allowed</a>' +
          '<a id="blocked-link" href="https://evil.test/chapter.xhtml">Blocked</a>' +
          '</body></html>',
      );

      sanitizeEpubDocument(doc, {
        externalUrlPolicy: { mode: 'allowlist', hosts: ['example.test'] },
      });

      expect(doc.querySelector('#allowed')?.getAttribute('src')).toBe(
        'https://cdn.example.test/cover.jpg',
      );
      expect(doc.querySelector('#blocked')?.hasAttribute('src')).toBe(false);
      expect(doc.querySelector('#allowed-relative')?.getAttribute('src')).toBe(
        '//cdn.example.test/media.mp4',
      );
      expect(doc.querySelector('#allowed-link')?.getAttribute('href')).toBe(
        'https://cdn.example.test/chapter.xhtml',
      );
      expect(doc.querySelector('#blocked-link')?.hasAttribute('href')).toBe(false);
    });
  });

  it('strips obfuscated control character javascript links', () => {
    const payloads = [
      '<html><body><svg xmlns="http://www.w3.org/2000/svg"><use href="java\nscript:alert(1)"/></svg></body></html>',
      '<html><body><svg xmlns="http://www.w3.org/2000/svg"><use href="java\tscript:alert(1)"/></svg></body></html>',
      '<html><body><svg xmlns="http://www.w3.org/2000/svg"><use href="java\rscript:alert(1)"/></svg></body></html>',
    ];

    for (const payload of payloads) {
      const doc = createDoc(payload);
      sanitizeEpubDocument(doc);
      const useEl = doc.querySelector('use');
      expect(useEl?.getAttribute('href')).toBeNull();
    }
  });
});

describe('SVG Security Vectors', () => {
  it('strips all malicious SVG payloads in sanitizeSvg', () => {
    for (const payload of MALICIOUS_SVG_PAYLOADS) {
      const sanitized = sanitizeSvg(payload);
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('vbscript:');
      expect(sanitized).not.toContain('foreignObject');
      expect(sanitized).not.toContain('onclick');
    }
  });

  it('strips malicious SVG tags and event attributes in EPUB documents', () => {
    for (const payload of MALICIOUS_SVG_PAYLOADS) {
      const doc = createDoc(`<html><body>${payload}</body></html>`);
      sanitizeEpubDocument(doc);

      expect(doc.querySelector('script')).toBeNull();
      expect(doc.querySelector('foreignObject')).toBeNull();

      const svgElements = doc.querySelectorAll('svg *');
      for (const el of svgElements) {
        for (const attr of Array.from(el.attributes)) {
          expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
          if (attr.name === 'href' || attr.name === 'xlink:href') {
            verifyNoDangerousSchemes(attr.value);
          }
        }
      }
    }
  });
});

describe('CSS Security Vectors', () => {
  it('strips dangerous schemes and expressions from CSS', () => {
    for (const cssPayload of MALICIOUS_CSS_PAYLOADS) {
      const clean = sanitizeCssText(cssPayload);
      expect(clean).not.toContain('javascript:');
      expect(clean).not.toContain('vbscript:');
      expect(clean).not.toContain('data:');
      expect(clean).not.toContain('expression(');
      expect(clean).not.toContain('-moz-binding');
      expect(clean).not.toContain('evil.com');
    }
  });

  it('strips multiline CSS expression constructs', () => {
    const multilineCss = `
      div {
        width: expression(
          alert(1)
        );
        height: expression
          (
            alert(2)
          );
      }
    `;
    const clean = sanitizeCssText(multilineCss);
    expect(clean).not.toContain('expression');
    expect(clean).not.toContain('alert(1)');
    expect(clean).not.toContain('alert(2)');
  });

  it('preserves local CSS URLs and rejects active schemes', () => {
    const clean = sanitizeCssText(
      "a{background:url('../Images/a.png')} b{fill:url(#gradient)} c{background:url(data:image/png;base64,AAAA)} d{background:url(vbscript:alert(1))} e{background:url(javascript:alert(1))} f{background:url(//cdn.example.test/a.png)}",
    );
    expect(clean).toContain("url('../Images/a.png')");
    expect(clean).toContain('url(#gradient)');
    expect(clean).not.toContain('cdn.example.test');
    expect(clean).not.toContain('data:');
    expect(clean).not.toContain('vbscript:');
    expect(clean).not.toContain('javascript:');
  });
  it('decodes escaped URL syntax and consumes malformed URL suffixes once', () => {
    const escaped = sanitizeCssText(
      'a{background:u\\72l(javascript\\3a alert(1))} @import "\\68 ttps://evil.test/style.css";',
    );
    expect(escaped).not.toContain('javascript:');
    expect(escaped).not.toContain('evil.test');
    expect(escaped).toContain('url("")');

    const malformed = sanitizeCssText(`color:red;${'url('.repeat(2_000)}`);
    expect(malformed).toContain('color:red;');
    expect(malformed).not.toContain('url(url(');
  });

  it('removes complete @import at-rules using url() syntax', () => {
    const clean = sanitizeCssText(
      '@import url("https://evil.test/style.css") screen; ' +
        '@import url(https://evil.test/print.css) layer(theme) print; ' +
        'p { color: red; }',
    );

    expect(clean).not.toContain('@import url');
    expect(clean).not.toContain('evil.test');
    expect(clean).toContain('color: red');
  });

  it('removes repeated nested expression attacks in one pass', () => {
    const hostile = 'width:expression(alert((1)));'.repeat(2_000);
    const clean = sanitizeCssText(`${hostile}color: red`);
    expect(clean).not.toContain('expression(');
    expect(clean).not.toContain('alert(');
    expect(clean).toContain('color: red');
  });

  it('sanitizes inline style attributes in EPUB document', () => {
    const html =
      '<html><body><p style="background: url(\'javascript:alert(1)\'); color: red;">Test</p></body></html>';
    const doc = createDoc(html);
    sanitizeEpubDocument(doc);

    const p = doc.querySelector('p');
    expect(p?.getAttribute('style')).not.toContain('javascript:');
    expect(p?.getAttribute('style')).toContain('color: red');
  });

  it('sanitizes <style> blocks in EPUB document', () => {
    const html =
      '<html><head><style>p { background: url("javascript:alert(1)"); color: blue; }</style></head><body><p>Test</p></body></html>';
    const doc = createDoc(html);
    sanitizeEpubDocument(doc);

    const style = doc.querySelector('style');
    expect(style?.textContent).not.toContain('javascript:');
    expect(style?.textContent).toContain('color: blue');
  });
});

describe('MathML Security Vectors', () => {
  it('sanitizes MathML elements and removes embedded scripts and event handlers', () => {
    for (const mathPayload of MALICIOUS_MATHML_PAYLOADS) {
      const doc = createDoc(`<html><body>${mathPayload}</body></html>`);
      sanitizeEpubDocument(doc);

      expect(doc.querySelector('script')).toBeNull();
      const mathElements = doc.querySelectorAll('math, math *');
      for (const el of mathElements) {
        for (const attr of Array.from(el.attributes)) {
          expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
          if (attr.name === 'href' || attr.name === 'xlink:href') {
            verifyNoDangerousSchemes(attr.value);
          }
        }
      }
    }
  });
});

describe('Legitimate EPUB3 Content Preservation', () => {
  it('preserves legitimate EPUB3 typography and inline styles', () => {
    const doc = createDoc(LEGITIMATE_EPUB3_CONTENT.typography);
    sanitizeEpubDocument(doc);

    expect(doc.querySelector('h1')?.textContent).toBe('Chapter 1: The Beginning');
    expect(doc.querySelector('p')?.textContent).toContain('standard EPUB3 text');
    expect(doc.querySelector('style')?.textContent).toContain('font-family');
  });

  it('preserves valid SVG illustrations and gradients', () => {
    const doc = createDoc(`<html><body>${LEGITIMATE_EPUB3_CONTENT.illustration}</body></html>`);
    sanitizeEpubDocument(doc);

    expect(doc.querySelector('svg')).not.toBeNull();
    expect(doc.querySelector('linearGradient')).not.toBeNull();
    expect(doc.querySelector('circle')?.getAttribute('fill')).toBe('url(#grad1)');
  });

  it('preserves valid MathML formulas', () => {
    const doc = createDoc(`<html><body>${LEGITIMATE_EPUB3_CONTENT.formula}</body></html>`);
    sanitizeEpubDocument(doc);

    expect(doc.querySelector('math')).not.toBeNull();
    expect(doc.querySelector('msup')).not.toBeNull();
    expect(doc.querySelector('mn')?.textContent).toBe('2');
  });
});
