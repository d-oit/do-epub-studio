import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeEpubDocument } from '../sanitizer';

describe('sanitizeEpubDocument', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('test');
  });

  it('should remove script tags from SVG', () => {
    doc.body.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert("xss")</script>
        <circle cx="50" cy="50" r="40" />
      </svg>
    `;

    sanitizeEpubDocument(doc);

    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('circle')).not.toBeNull();
  });

  it('should remove event handlers from SVG elements', () => {
    doc.body.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert('xss')">
        <rect x="10" y="10" width="100" height="100" onclick="alert('xss')" />
      </svg>
    `;

    sanitizeEpubDocument(doc);

    const svg = doc.querySelector('svg');
    const rect = doc.querySelector('rect');

    expect(svg?.getAttribute('onload')).toBeNull();
    expect(rect?.getAttribute('onclick')).toBeNull();
    expect(rect?.getAttribute('width')).toBe('100');
  });

  it('should remove foreignObject elements', () => {
    doc.body.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <foreignObject width="100" height="100">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <script>alert('xss')</script>
            Some HTML
          </div>
        </foreignObject>
        <path d="M10 10 L20 20" />
      </svg>
    `;

    sanitizeEpubDocument(doc);

    expect(doc.querySelector('foreignObject')).toBeNull();
    expect(doc.querySelector('div')).toBeNull();
    expect(doc.querySelector('path')).not.toBeNull();
  });

  it('should preserve safe SVG elements and attributes', () => {
    const svgHtml = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <linearGradient id="grad1">
          <stop offset="0%" stop-color="red" />
          <stop offset="100%" stop-color="blue" />
        </linearGradient>
        <circle cx="50" cy="50" r="40" fill="url(#grad1)" />
        <text x="10" y="20">Hello SVG</text>
      </svg>
    `;
    doc.body.innerHTML = svgHtml;

    sanitizeEpubDocument(doc);

    expect(doc.querySelector('svg')).not.toBeNull();
    expect(doc.querySelector('circle')).not.toBeNull();
    expect(doc.querySelector('linearGradient')).not.toBeNull();
    expect(doc.querySelector('stop')).not.toBeNull();
    expect(doc.querySelector('text')?.textContent).toBe('Hello SVG');
    expect(doc.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 100 100');
  });

  it('should handle non-SVG XSS as well', () => {
    doc.body.innerHTML = `
      <div>
        <img src="x" onerror="alert('xss')" />
        <script>console.log('bad')</script>
        <p>Safe text</p>
      </div>
    `;

    sanitizeEpubDocument(doc);

    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('img')?.getAttribute('onerror')).toBeNull();
    expect(doc.querySelector('p')?.textContent).toBe('Safe text');
  });
});
