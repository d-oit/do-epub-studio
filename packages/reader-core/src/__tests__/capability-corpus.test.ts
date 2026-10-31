import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readZipEntries } from './fixtures/epub-helpers';
import { sanitizeEpubDocument } from '../sanitizer';

const CORPUS = resolve(import.meta.dirname, 'fixtures/capability-corpus');
const fixtures = [
  ['epub2-reflow', 'version="2.0"', 'toc.ncx'],
  ['epub3-0-reflow-nav', 'version="3.0"', 'epub:type="toc"'],
  ['epub3-1-reflow', 'version="3.0"', 'A later reflow edition'],
  ['epub3-2-reflow', 'version="3.0"', 'A later reflow edition'],
  ['epub3-3-reflow', 'version="3.0"', 'A later reflow edition'],
  ['headings-landmarks-language', 'epub:type="landmarks"', 'lang="fr"'],
  ['image-alternative', 'alt="A round seed with two leaves"', 'seed.svg'],
  ['complex-table', '<th id="season" scope="col">', 'headers="spring rain"'],
  ['ruby-annotation', '<ruby>山<rt>やま</rt></ruby>', '<rt>'],
  ['mathml-equation', 'http://www.w3.org/1998/Math/MathML', '<mi>x</mi>'],
  ['svg-vector', 'aria-labelledby="label"', '<title id="label">A blue circle</title>'],
  ['vertical-writing', 'writing-mode:vertical-rl', 'class="vertical"'],
  ['rtl-direction', 'dir="rtl"', 'lang="ar"'],
  ['media-overlay', 'media-overlay="smil"', '<smil'],
  ['fixed-layout', 'rendition:layout', 'pre-paginated'],
  ['multiple-renditions', 'OEBPS/alternate.opf', 'alternate-rendition'],
  ['scripted-content', 'onclick=', 'No script'],
  ['remote-resource', 'https://invalid.example/never-request.png', 'Remote test resource'],
  ['dictionary-glossary', '<dl>', '<dt id="dew">Dew</dt>'],
  ['accessibility-metadata', 'schema:accessibilityFeature', 'not a certification'],
  ['malformed-navigation', 'href="missing.xhtml#absent"', 'Broken map'],
  ['epub34-preview', 'version="3.0"', 'EPUB 3.3-era structures'],
] as const;

const behaviorSelectors: Record<(typeof fixtures)[number][0], string> = {
  'epub2-reflow': 'h1',
  'epub3-0-reflow-nav': 'h1',
  'epub3-1-reflow': 'h1',
  'epub3-2-reflow': 'h1',
  'epub3-3-reflow': 'h1',
  'headings-landmarks-language': 'h2',
  'image-alternative': 'img[alt]',
  'complex-table': 'td[headers]',
  'ruby-annotation': 'ruby rt',
  'mathml-equation': 'math mi',
  'svg-vector': 'svg title',
  'vertical-writing': 'p.vertical',
  'rtl-direction': 'p[dir="rtl"]',
  'media-overlay': 'p#line',
  'fixed-layout': 'h1',
  'multiple-renditions': 'h1',
  'scripted-content': 'button[onclick]',
  'remote-resource': 'img[src^="https://"]',
  'dictionary-glossary': 'dl dt',
  'accessibility-metadata': 'h1',
  'malformed-navigation': 'h1',
  'epub34-preview': 'h1',
};

describe('generated synthetic EPUB capability corpus', () => {
  it.each(fixtures)(
    '%s contains its asserted capability behavior',
    (id, packageMarker, contentMarker) => {
      const archive = readZipEntries(readFileSync(resolve(CORPUS, `${id}.epub`)));
      const archiveText = [...archive.values()].map((entry) => entry.toString('utf8')).join(' ');
      const chapter = archive.get('OEBPS/chapter.xhtml')?.toString('utf8') ?? '';
      const document = new DOMParser().parseFromString(chapter, 'application/xhtml+xml');
      expect(archive.get('mimetype')?.toString('utf8')).toBe('application/epub+zip');
      expect(archiveText).toContain(packageMarker);
      expect(archiveText).toContain(contentMarker);
      expect(document.querySelector(behaviorSelectors[id])).not.toBeNull();
    },
  );

  it('keeps the two controlled security examples explicit in synthetic content', () => {
    const scripted = readZipEntries(readFileSync(resolve(CORPUS, 'scripted-content.epub')));
    const remote = readZipEntries(readFileSync(resolve(CORPUS, 'remote-resource.epub')));
    const scriptContent = scripted.get('OEBPS/chapter.xhtml')?.toString('utf8') ?? '';
    const remoteContent = remote.get('OEBPS/chapter.xhtml')?.toString('utf8') ?? '';
    expect(scriptContent).toContain('onclick=');
    expect(remoteContent).toContain('https://invalid.example/never-request.png');
    expect([...scripted.keys()]).not.toContain('script.js');
    expect([...remote.keys()]).not.toContain('never-request.png');
  });

  it('strips executable handlers and blocks remote resource URLs from generated content', () => {
    const scriptedArchive = readZipEntries(readFileSync(resolve(CORPUS, 'scripted-content.epub')));
    const scriptedSource = scriptedArchive.get('OEBPS/chapter.xhtml')?.toString('utf8') ?? '';
    const scriptedDocument = new DOMParser().parseFromString(
      scriptedSource,
      'application/xhtml+xml',
    );
    sanitizeEpubDocument(scriptedDocument);
    expect(scriptedDocument.querySelector('[onclick]')).toBeNull();

    const remoteArchive = readZipEntries(readFileSync(resolve(CORPUS, 'remote-resource.epub')));
    const remoteSource = remoteArchive.get('OEBPS/chapter.xhtml')?.toString('utf8') ?? '';
    const remoteDocument = new DOMParser().parseFromString(remoteSource, 'application/xhtml+xml');
    sanitizeEpubDocument(remoteDocument);
    expect(remoteDocument.querySelector('img')?.getAttribute('src')).toBeNull();
    expect(remoteDocument.querySelector('img')?.getAttribute('alt')).toBe('Remote test resource');
  });
});
