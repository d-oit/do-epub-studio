import { bench, describe } from 'vitest';
import { JSDOM } from 'jsdom';
import { sanitizeDom } from './sanitizer';

describe('sanitizer performance', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const doc = dom.window.document;
  const body = doc.body;

  // Create a document with many elements, some having event attributes, some linkable, some empty
  for (let i = 0; i < 2000; i++) {
    let el: HTMLElement;
    if (i % 5 === 0) {
      el = doc.createElement('div');
      el.setAttribute('id', `item-${i}`);
      el.setAttribute('class', 'item-class');
    } else if (i % 5 === 1) {
      el = doc.createElement('span');
      // No attributes
    } else if (i % 5 === 2) {
      el = doc.createElement('a');
      el.setAttribute('href', 'https://example.com');
      if (i % 10 === 2) {
        el.setAttribute('onclick', 'doSomething()');
      }
    } else if (i % 5 === 3) {
      // SVG-like elements (localName will be lowercase)
      el = doc.createElementNS('http://www.w3.org/2000/svg', 'image') as unknown as HTMLElement;
      el.setAttribute('xlink:href', 'image.png');
    } else {
      el = doc.createElement('p');
      el.setAttribute('style', 'color: red');
      el.setAttribute('data-info', 'some-data');
    }
    body.appendChild(el);
  }

  bench('sanitizeDom (2000 elements mixed)', () => {
    const clone = doc.cloneNode(true) as Document;
    sanitizeDom(clone);
  });

  bench('clone only (baseline)', () => {
    doc.cloneNode(true);
  });
});
