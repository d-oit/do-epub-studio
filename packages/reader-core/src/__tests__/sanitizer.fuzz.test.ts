import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { sanitizeEpubDocument, sanitizeSvg, sanitizeCssText } from '../sanitizer';

function createDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function verifyNoDangerousSchemes(urlValue: string): void {
  const lower = urlValue.toLowerCase().trim();
  expect(lower.startsWith('javascript:')).toBe(false);
  expect(lower.startsWith('vbscript:')).toBe(false);
  expect(lower.startsWith('data:')).toBe(false);
}

describe('Sanitizer Fuzzing & Property Tests', () => {
  it('never leaves script tags or on* event attributes in HTML documents', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 500 }),
        fc.string({ maxLength: 100 }),
        (randomContent, tag) => {
          const safeTag = tag.replace(/[^a-zA-Z0-9]/g, 'div') || 'div';
          const rawHtml = `<html><body><${safeTag} data-test="${randomContent}">${randomContent}</${safeTag}></body></html>`;

          let doc: Document;
          try {
            doc = createDoc(rawHtml);
          } catch {
            return;
          }

          sanitizeEpubDocument(doc);

          expect(doc.querySelector('script')).toBeNull();
          const elements = doc.querySelectorAll('*');
          for (const el of elements) {
            for (const attr of Array.from(el.attributes)) {
              expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
              if (attr.name === 'href' || attr.name === 'src') {
                verifyNoDangerousSchemes(attr.value);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('sanitizeSvg never throws and strips script tags for arbitrary SVG strings', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (randomSvg) => {
        let result = '';
        expect(() => {
          result = sanitizeSvg(randomSvg);
        }).not.toThrow();

        expect(result).not.toContain('<script');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('vbscript:');
        expect(result).not.toContain('data:');
      }),
      { numRuns: 100 },
    );
  });

  it('sanitizeCssText never throws and removes javascript: and expression()', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (randomCss) => {
        let result = '';
        expect(() => {
          result = sanitizeCssText(randomCss);
        }).not.toThrow();

        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('vbscript:');
        expect(result).not.toContain('data:');
        expect(result).not.toContain('expression(');
      }),
      { numRuns: 100 },
    );
  });
});
