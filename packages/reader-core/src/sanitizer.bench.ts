import { bench, describe } from 'vitest';
import { JSDOM } from 'jsdom';
import { sanitizeDom, sanitizeEpubDocument } from './sanitizer';

// ---------------------------------------------------------------------------
// Helpers — build a synthetic DOM with mixed element types
// ---------------------------------------------------------------------------

function buildMixedDoc(nodeCount: number): Document {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
  const doc = dom.window.document;
  const body = doc.body;

  for (let i = 0; i < nodeCount; i++) {
    let el: Element;
    if (i % 5 === 0) {
      el = doc.createElement('div');
      el.setAttribute('id', `item-${i}`);
      el.setAttribute('class', 'item-class');
    } else if (i % 5 === 1) {
      el = doc.createElement('span');
    } else if (i % 5 === 2) {
      el = doc.createElement('a');
      el.setAttribute('href', 'https://example.com');
      if (i % 10 === 2) {
        el.setAttribute('onclick', 'doSomething()');
      }
    } else if (i % 5 === 3) {
      el = doc.createElementNS('http://www.w3.org/2000/svg', 'image');
      el.setAttribute('xlink:href', 'image.png');
    } else {
      el = doc.createElement('p');
      el.setAttribute('style', 'color: red');
      el.setAttribute('data-info', 'some-data');
    }
    body.appendChild(el);
  }
  return doc;
}

function buildEpubLikeDoc(nodeCount: number): Document {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
  const doc = dom.window.document;
  const body = doc.body;

  for (let i = 0; i < nodeCount; i++) {
    let el: Element;
    const r = i % 6;
    if (r === 0) {
      el = doc.createElement('div');
      el.setAttribute('id', `sec-${i}`);
      el.setAttribute('class', 'chapter');
    } else if (r === 1) {
      el = doc.createElement('p');
      el.textContent = `Paragraph ${i}`;
    } else if (r === 2) {
      el = doc.createElement('a');
      el.setAttribute('href', `ch${i}.xhtml`);
      if (i % 20 === 0) el.setAttribute('onclick', 'evil()');
    } else if (r === 3) {
      el = doc.createElement('img');
      el.setAttribute('src', `img${i}.png`);
      el.setAttribute('alt', `Image ${i}`);
    } else if (r === 4) {
      el = doc.createElement('h2');
      el.textContent = `Section ${i}`;
    } else {
      el = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('viewBox', '0 0 100 100');
      el.setAttribute('onclick', 'svgEvil()');
    }
    body.appendChild(el);
  }
  return doc;
}

// ---------------------------------------------------------------------------
// sanitizeDom — original benchmark at various sizes
// ---------------------------------------------------------------------------

describe('sanitizeDom performance', () => {
  const sizes = [500, 2000, 5000] as const;

  for (const count of sizes) {
    const doc = buildMixedDoc(count);

    bench(`sanitizeDom (${count} elements mixed)`, () => {
      const clone = doc.cloneNode(true) as Document;
      sanitizeDom(clone);
    });
  }

  // Baseline: clone only
  const baselineDoc = buildMixedDoc(2000);
  bench('clone only (baseline, 2000 elements)', () => {
    baselineDoc.cloneNode(true);
  });
});

// ---------------------------------------------------------------------------
// sanitizeEpubDocument — full 3-pass pipeline at various DOM sizes
// ---------------------------------------------------------------------------

describe('sanitizeEpubDocument performance', () => {
  const sizes = [500, 2000, 5000] as const;

  for (const count of sizes) {
    bench(`sanitizeEpubDocument (${count} elements)`, () => {
      const doc = buildEpubLikeDoc(count);
      sanitizeEpubDocument(doc);
    });
  }
});
