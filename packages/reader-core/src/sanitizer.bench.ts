import { bench, describe } from 'vitest';
import { JSDOM } from 'jsdom';
import { sanitizeDom } from './sanitizer';

describe('sanitizer performance', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const doc = dom.window.document;
  const body = doc.body;

  // Create a document with many elements, some having event attributes
  for (let i = 0; i < 1000; i++) {
    const div = doc.createElement('div');
    div.setAttribute('data-test', 'value');
    if (i % 10 === 0) {
      div.setAttribute('onclick', 'alert(1)');
    }
    body.appendChild(div);
  }

  bench('sanitizeDom (1000 elements)', () => {
    const clone = doc.cloneNode(true) as Document;
    sanitizeDom(clone);
  });

  bench('clone only (baseline)', () => {
    doc.cloneNode(true);
  });
});
