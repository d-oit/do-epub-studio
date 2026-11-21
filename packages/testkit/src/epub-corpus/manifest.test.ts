import { describe, expect, it } from 'vitest';
import { CORPUS_ENTRIES, getCorpusEntry } from './manifest';
import { KNOWN_DIFFS } from './known-diffs';

describe('corpus manifest invariants', () => {
  it('has unique ids and a valid category/severity vocabulary', () => {
    const ids = new Set<string>();
    for (const entry of CORPUS_ENTRIES) {
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);
      expect(entry.category).toMatch(/standards|layout-i18n|embedded-resources|media-annotation|malformed|security/);
      for (const d of entry.expectedDiagnostics) {
        expect(d.severity).toMatch(/error|warning|info/);
        expect(typeof d.code).toBe('string');
      }
    }
    expect(ids.size).toBe(CORPUS_ENTRIES.length);
  });

  it('browserable fixtures must be valid archives that parse', () => {
    for (const entry of CORPUS_ENTRIES) {
      if (entry.browserable) {
        expect(entry.expectedArchive.kind).toBe('ok');
        expect(entry.expectedParses).toBe(true);
      }
    }
  });

  it('every entry has provenance with a license', () => {
    for (const entry of CORPUS_ENTRIES) {
      expect(entry.provenance.source.length).toBeGreaterThan(0);
      expect(entry.provenance.license).toBe('CC0-1.0');
      expect(entry.provenance.note.length).toBeGreaterThan(10);
      expect(entry.featureTags.length).toBeGreaterThan(0);
    }
  });

  it('known-diffs reference existing fixtures and are documented', () => {
    for (const diff of KNOWN_DIFFS) {
      expect(() => getCorpusEntry(diff.fixtureId)).not.toThrow();
      expect(diff.expectation.length).toBeGreaterThan(10);
      expect(diff.rationale.length).toBeGreaterThan(10);
      expect(typeof diff.verified).toBe('boolean');
    }
  });
});
