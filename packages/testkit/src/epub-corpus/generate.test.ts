import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildEpubFromSpec, chapterBody } from './generate';
import { generateCorpusEntry } from './entries';
import { generateMinimalTtf, generatePng, generateWav } from './resources';
import { CORPUS_ENTRY_IDS } from './manifest';

describe('corpus generators', () => {
  it('produces deterministic archives for every manifest id', () => {
    for (const id of CORPUS_ENTRY_IDS) {
      const a = generateCorpusEntry(id);
      const b = generateCorpusEntry(id);
      expect(Buffer.from(a).equals(Buffer.from(b)), id).toBe(true);
    }
  }, 30_000);

  it('builds a spec archive with mimetype first and readable OPF', () => {
    const zip = buildEpubFromSpec({
      version: '3.0',
      title: 'T',
      language: 'en',
      chapters: [
        { href: 'chapter1.xhtml', title: 'C', body: '<html><body><p>x</p></body></html>' },
      ],
    });
    const entries = unzipSync(zip);
    expect(entries['mimetype']).toBeDefined();
    const opfBytes = entries['OEBPS/content.opf'];
    expect(opfBytes).toBeDefined();
    const opf = strFromU8(opfBytes ?? new Uint8Array());
    expect(opf).toContain('version="3.0"');
    expect(opf).toContain('<dc:title>T</dc:title>');
    expect(opf).toBeTruthy();
  });

  it('generates seeded chapter bodies that are bounded in size', () => {
    const body = chapterBody(42, 3);
    expect(body.length).toBeGreaterThan(100);
    expect(body.length).toBeLessThan(5000);
    expect(chapterBody(42, 3)).toBe(body);
  });

  it('synthesizes well-formed PNG/TTF/WAV resources', () => {
    const png = generatePng(1);
    expect(png.subarray(0, 8)).toEqual(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    const ttf = generateMinimalTtf();
    // SFNT version tag at offset 0; table count at offset 4.
    expect(ttf.subarray(0, 4)).toEqual(Uint8Array.from([0, 1, 0, 0]));
    expect(((ttf[4] ?? 0) << 8) | (ttf[5] ?? 0)).toBe(9); // number of tables
    const wav = generateWav(200);
    expect(strFromU8(wav.subarray(0, 4))).toBe('RIFF');
    expect(strFromU8(wav.subarray(8, 12))).toBe('WAVE');
  });
});
