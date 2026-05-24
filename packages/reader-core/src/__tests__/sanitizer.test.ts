import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeEpubDocument } from '../sanitizer';

describe('sanitizeEpubDocument', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('Test');
  });

  it('injects CSP meta tag', () => {
    sanitizeEpubDocument(doc);
    const meta = doc.querySelector('meta[http-equiv="Content-Security-Policy"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toContain("default-src 'none'");
    expect(meta?.getAttribute('content')).toContain("style-src 'unsafe-inline' blob:");
  });

  it('removes script tags', () => {
    doc.body.innerHTML = '<div>Safe</div><script>alert("xss")</script>';
    sanitizeEpubDocument(doc);
    expect(doc.body.querySelectorAll('script')).toHaveLength(0);
    expect(doc.body.innerHTML).toBe('<div>Safe</div>');
  });

  it('removes event handlers', () => {
    doc.body.innerHTML = '<button onclick="alert(\'xss\')">Click me</button>';
    sanitizeEpubDocument(doc);
    const button = doc.querySelector('button');
    expect(button?.hasAttribute('onclick')).toBe(false);
  });

  it('removes javascript: URIs', () => {
    doc.body.innerHTML = '<a href="javascript:alert(\'xss\')">Link</a>';
    sanitizeEpubDocument(doc);
    const a = doc.querySelector('a');
    expect(a?.hasAttribute('href')).toBe(false);
  });

  it('removes iframes and objects', () => {
    doc.body.innerHTML = '<iframe src="https://evil.com"></iframe><object data="evil.swf"></object>';
    sanitizeEpubDocument(doc);
    expect(doc.body.querySelectorAll('iframe')).toHaveLength(0);
    expect(doc.body.querySelectorAll('object')).toHaveLength(0);
  });

  it('preserves safe formatting and attributes', () => {
    const html = '<p class="text">Hello <b>World</b></p><img src="test.jpg" alt="Test">';
    doc.body.innerHTML = html;
    sanitizeEpubDocument(doc);
    expect(doc.body.querySelector('p')?.className).toBe('text');
    expect(doc.body.querySelector('b')?.textContent).toBe('World');
    expect(doc.body.querySelector('img')?.getAttribute('src')).toBe('test.jpg');
  });

  it('handles documents without a head', () => {
    // createHTMLDocument always has a head, but let's try to simulate or at least ensure no crash
    const docNoHead = document.implementation.createDocument(null, 'html', null);
    // Note: Document created this way might not have body/head like HTMLDocument
    expect(() => sanitizeEpubDocument(docNoHead)).not.toThrow();
  });
});
