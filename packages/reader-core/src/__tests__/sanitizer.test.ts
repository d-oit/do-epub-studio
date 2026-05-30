import { describe, expect, it } from 'vitest';
import {
  sanitizeSvg,
  sanitizeDom,
  createSvgSanitizerHook,
  sanitizeEpubDocument,
} from '../sanitizer';

describe('sanitizeSvg', () => {
  it('allows safe SVG tags', () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h100v100H0z"/><rect x="10" y="10" width="50" height="50"/><circle cx="50" cy="50" r="40"/></svg>';
    const result = sanitizeSvg(svgContent);
    expect(result).toContain('<svg');
    expect(result).toContain('</svg>');
    expect(result).toContain('<path');
    expect(result).toContain('<rect');
    expect(result).toContain('<circle');
  });

  it('removes event handlers from SVG elements', () => {
    const svgWithEvents = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" onclick="alert(1)" onload="alert(2)" onmouseover="evil()"/></svg>';
    const result = sanitizeSvg(svgWithEvents);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('onmouseover');
    expect(result).not.toContain('alert');
  });

  it('removes foreignObject elements', () => {
    const svgWithForeignObject = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="evil.com"></iframe></foreignObject><rect width="100" height="100"/></svg>';
    const result = sanitizeSvg(svgWithForeignObject);
    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('foreignobject');
    expect(result).not.toContain('iframe');
    expect(result).not.toContain('evil');
    expect(result).toContain('<rect');
  });

  it('strips script injection via SVG', () => {
    const svgWithScript = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="100" height="100"/></svg>';
    const result = sanitizeSvg(svgWithScript);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<rect');
  });

  it('blocks javascript: URLs in href attributes', () => {
    const svgWithJsHref = '<svg xmlns="http://www.w3.org/2000/svg"><use href="javascript:alert(1)"/><image xlink:href="javascript:alert(2)"/></svg>';
    const result = sanitizeSvg(svgWithJsHref);
    expect(result).not.toContain('javascript:');
  });

  it('blocks javascript: URLs with leading spaces', () => {
    const svgWithSpacedJsHref = '<svg xmlns="http://www.w3.org/2000/svg"><use href="  javascript:alert(1)"/></svg>';
    const result = sanitizeSvg(svgWithSpacedJsHref);
    expect(result).not.toContain('javascript:');
  });

  it('blocks data: and vbscript: URLs', () => {
    const svgWithBadSchemes = '<svg xmlns="http://www.w3.org/2000/svg"><use href="data:text/html,<script>alert(1)</script>"/><image href="vbscript:msgbox(1)"/></svg>';
    const result = sanitizeSvg(svgWithBadSchemes);
    expect(result).not.toContain('data:');
    expect(result).not.toContain('vbscript:');
  });

  it('allows safe href attributes', () => {
    const svgWithSafeHref = '<svg xmlns="http://www.w3.org/2000/svg"><use href="#mySymbol"/><image href="image.png"/></svg>';
    const result = sanitizeSvg(svgWithSafeHref);
    expect(result).toContain('#mySymbol');
    expect(result).toContain('image.png');
  });

  it('removes style elements from SVG', () => {
    const svgWithStyle = '<svg xmlns="http://www.w3.org/2000/svg"><style>body { background: red; }</style><rect width="100" height="100"/></svg>';
    const result = sanitizeSvg(svgWithStyle);
    expect(result).not.toContain('<style>');
    expect(result).not.toContain('background: red');
    expect(result).toContain('<rect');
  });

  it('preserves inline style attributes', () => {
    const svgWithInlineStyle = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" style="fill: red; stroke: black;"/></svg>';
    const result = sanitizeSvg(svgWithInlineStyle);
    expect(result).toContain('fill: red');
    expect(result).toContain('stroke: black');
  });

  it('allows gradient and filter definitions', () => {
    const svgWithDefs = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="grad"><stop offset="0%" stop-color="red"/><stop offset="100%" stop-color="blue"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="3"/></filter></defs><rect width="100" height="100" fill="url(#grad)" filter="url(#blur)"/></svg>';
    const result = sanitizeSvg(svgWithDefs);
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
    const svgWithAnimateXss = '<svg xmlns="http://www.w3.org/2000/svg"><animate onbegin="alert(1)" attributeName="x" values="0;100" dur="1s"/></svg>';
    const result = sanitizeSvg(svgWithAnimateXss);
    expect(result).not.toContain('onbegin');
    expect(result).not.toContain('alert');
  });

  it('removes iframe from SVG', () => {
    const svgWithIframe = '<svg xmlns="http://www.w3.org/2000/svg"><iframe src="https://evil.com"></iframe><rect width="100" height="100"/></svg>';
    const result = sanitizeSvg(svgWithIframe);
    expect(result).not.toContain('iframe');
    expect(result).not.toContain('evil');
    expect(result).toContain('<rect');
  });
});

describe('sanitizeDom', () => {
  function createDocumentFromHtmlString(htmlString: string): Document {
    return new DOMParser().parseFromString(htmlString, 'text/html');
  }

  it('removes foreignObject from SVG in DOM', () => {
    const svgWithForeignObject = createDocumentFromHtmlString('<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>test</div></foreignObject><rect width="100" height="100"/></svg>');
    const svg = svgWithForeignObject.querySelector('svg') as Element;
    expect(svg).not.toBeNull();
    sanitizeDom(svg);
    expect(svg.querySelector('foreignObject')).toBeNull();
    expect(svg.querySelector('rect')).not.toBeNull();
  });

  it('removes event handlers from SVG elements in DOM', () => {
    const svgDocWithEvents = createDocumentFromHtmlString('<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" onload="evil()"/></svg>');
    const svg = svgDocWithEvents.querySelector('svg') as Element;
    expect(svg).not.toBeNull();
    sanitizeDom(svg);
    const rect = svg.querySelector('rect') as Element;
    expect(rect).not.toBeNull();
    expect(rect.getAttribute('onclick')).toBeNull();
    expect(rect.getAttribute('onload')).toBeNull();
  });

  it('handles document with no SVGs', () => {
    const simpleDoc = createDocumentFromHtmlString('<p>Hello</p>');
    expect(() => sanitizeDom(simpleDoc)).not.toThrow();
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

describe('sanitizeEpubDocument', () => {
  function createDocumentFromHtml(htmlContent: string): Document {
    return new DOMParser().parseFromString(htmlContent, 'text/html');
  }

  it('removes script tags from document', () => {
    const docWithScript = createDocumentFromHtml('<html><body><h1>Safe</h1><script>alert("xss")</script></body></html>');
    sanitizeEpubDocument(docWithScript);
    expect(docWithScript.querySelector('script')).toBeNull();
    expect(docWithScript.querySelector('h1')?.textContent).toBe('Safe');
  });

  it('removes event handlers from body and elements', () => {
    const docWithEvents = createDocumentFromHtml('<html onload="alert(1)"><body onclick="alert(2)"><div onmouseover="alert(3)">Test</div></body></html>');
    // Verify attributes are present before sanitization
    expect(docWithEvents.documentElement.getAttribute('onload')).toBe('alert(1)');
    expect(docWithEvents.body.getAttribute('onclick')).toBe('alert(2)');

    sanitizeEpubDocument(docWithEvents);
    expect(docWithEvents.documentElement.getAttribute('onload')).toBeNull();
    expect(docWithEvents.body.getAttribute('onclick')).toBeNull();
    expect(docWithEvents.querySelector('div')?.getAttribute('onmouseover')).toBeNull();
  });

  it('removes iframe and object tags', () => {
    const docWithIframe = createDocumentFromHtml('<div><iframe src="evil.com"></iframe><object data="evil.swf"></object></div>');
    sanitizeEpubDocument(docWithIframe);
    expect(docWithIframe.querySelector('iframe')).toBeNull();
    expect(docWithIframe.querySelector('object')).toBeNull();
  });

  it('removes SVG animation tags', () => {
    const docWithAnimate = createDocumentFromHtml('<svg><animate onbegin="alert(1)" /><rect /></svg>');
    sanitizeEpubDocument(docWithAnimate);
    expect(docWithAnimate.querySelector('animate')).toBeNull();
    expect(docWithAnimate.querySelector('rect')).not.toBeNull();
  });

  it('preserves safe HTML structure', () => {
    const safeDoc = createDocumentFromHtml('<html><head><title>Test</title></head><body><p>Hello World</p></body></html>');
    sanitizeEpubDocument(safeDoc);
    expect(safeDoc.querySelector('title')?.textContent).toBe('Test');
    expect(safeDoc.querySelector('p')?.textContent).toBe('Hello World');
  });
});
