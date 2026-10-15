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
  if (lower.startsWith('data:')) {
    expect(lower.startsWith('data:text/html')).toBe(false);
    expect(lower.startsWith('data:text/javascript')).toBe(false);
    expect(lower.startsWith('data:application/javascript')).toBe(false);
  }
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
      expect(clean).not.toContain('expression(');
      expect(clean).not.toContain('-moz-binding');
      expect(clean).not.toContain('data:text/html');
      expect(clean).not.toContain('evil.com');
    }
  });

  it('strips multiline CSS expression constructs', () => {
    const multilineCss = `
      div {
        width: expression(
          alert(1)
        );
      }
    `;
    const clean = sanitizeCssText(multilineCss);
    expect(clean).not.toContain('expression(');
    expect(clean).not.toContain('alert(1)');
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
