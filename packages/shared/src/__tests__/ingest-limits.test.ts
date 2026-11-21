import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ARCHIVE_REJECTION_CODES,
  ArchiveRejectionError,
  archiveRejection,
  archiveRejectionFromError,
  archiveRejectionStatusCode,
  checkXmlDocumentBudget,
  isXmlDocumentName,
  resolveIngestLimits,
  DEFAULT_INGEST_LIMITS,
  type ArchiveRejectionCode,
} from '../ingest-limits';

describe('ingest limits policy', () => {
  it('defaults are frozen and resolve overrides deterministically', () => {
    expect(Object.isFrozen(DEFAULT_INGEST_LIMITS)).toBe(true);
    const defaults = resolveIngestLimits();
    expect(defaults).toEqual(DEFAULT_INGEST_LIMITS);
    expect(defaults).not.toBe(DEFAULT_INGEST_LIMITS);
    const narrowed = resolveIngestLimits({ maxEntryCount: 5 });
    expect(narrowed.maxEntryCount).toBe(5);
    expect(narrowed.maxCompressedBytes).toBe(DEFAULT_INGEST_LIMITS.maxCompressedBytes);
  });

  it('every reject code has a message, a status, and no internals', () => {
    for (const code of ARCHIVE_REJECTION_CODES) {
      const rejection = archiveRejection(code);
      expect(rejection.kind).toBe('rejection');
      expect(rejection.code).toBe(code);
      expect(typeof rejection.message).toBe('string');
      expect(rejection.message.length).toBeGreaterThan(0);
      expect(rejection.message).not.toMatch(/inner|stack|at /i);
      const status = archiveRejectionStatusCode(code);
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    }
  });

  it('size/entry rejections map to 413, timeouts to 504, unsafe to 422', () => {
    expect(archiveRejectionStatusCode('compressed-size')).toBe(413);
    expect(archiveRejectionStatusCode('entry-count')).toBe(413);
    expect(archiveRejectionStatusCode('expanded-size')).toBe(413);
    expect(archiveRejectionStatusCode('per-entry-size')).toBe(413);
    expect(archiveRejectionStatusCode('timeout')).toBe(504);
    for (const code of [
      'invalid-archive',
      'ratio',
      'unsafe-path',
      'duplicate-path',
      'symlink-entry',
      'unsupported-entry',
      'encrypted-entry',
      'xml-budget',
    ]) {
      expect(archiveRejectionStatusCode(code as ArchiveRejectionCode)).toBe(422);
    }
  });

  it('ArchiveRejectionError carries the typed rejection and stable code', () => {
    const error = new ArchiveRejectionError(
      archiveRejection('unsafe-path', { entry: '../up', limit: 1 }),
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ArchiveRejectionError');
    expect(error.code).toBe('unsafe-path');
    expect(error.entry).toBe('../up');
    expect(error.message).toBe(error.rejection.message);
    expect(error.kind).toBe('rejection');
  });

  it('entry names are sanitized and truncated in rejections', () => {
    const dirty = new ArchiveRejectionError(archiveRejection('unsafe-path', { entry: 'a\u0000b' }));
    expect(dirty.entry).not.toContain('\u0000');
    const long = 'x'.repeat(500);
    const truncated = new ArchiveRejectionError(archiveRejection('unsafe-path', { entry: long }));
    expect(truncated.entry?.length).toBeLessThanOrEqual(121);
  });

  it('archiveRejectionFromError maps timeouts and unknown errors to typed codes', () => {
    const timeoutError = new Error('Operation "x" timed out after 1ms');
    timeoutError.name = 'TimeoutError';
    expect(archiveRejectionFromError(timeoutError).code).toBe('timeout');
    expect(archiveRejectionFromError(new Error('boom')).code).toBe('invalid-archive');
    expect(archiveRejectionFromError('weird').code).toBe('invalid-archive');
    const existing = new ArchiveRejectionError(archiveRejection('ratio'));
    expect(archiveRejectionFromError(existing)).toBe(existing);
  });

  it('isXmlDocumentName recognizes XML/SMIL-like extensions only', () => {
    expect(isXmlDocumentName('OEBPS/chapter.xhtml')).toBe(true);
    expect(isXmlDocumentName('META-INF/container.xml')).toBe(true);
    expect(isXmlDocumentName('OEBPS/content.opf')).toBe(true);
    expect(isXmlDocumentName('media/media.smil')).toBe(true);
    expect(isXmlDocumentName('OEBPS/cover.svg')).toBe(true);
    expect(isXmlDocumentName('OEBPS/cover.png')).toBe(false);
    expect(isXmlDocumentName('OEBPS/font.woff2')).toBe(false);
    expect(isXmlDocumentName('OEBPS/noext')).toBe(false);
    expect(isXmlDocumentName('README')).toBe(false);
  });
});

describe('checkXmlDocumentBudget', () => {
  const limits = { maxXmlNestingDepth: 5, maxXmlElementCount: 20 };

  it('accepts well-formed shallow documents and skips comments/CDATA/PI', () => {
    const text = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN">',
      '<html><!-- a comment with <fake> inside -->',
      '<body><p title="a > b">Hi &amp; bye</p>',
      '<![CDATA[<not-an-element/>]]>',
      '</body></html>',
    ].join('');
    expect(checkXmlDocumentBudget(text, limits)).toBeNull();
  });

  it('accepts self-closing elements without increasing depth', () => {
    expect(checkXmlDocumentBudget('<a/><b/><c/>', limits)).toBeNull();
  });

  it('rejects nesting deeper than the budget', () => {
    const deep = '<a>'.repeat(10) + 'x' + '</a>'.repeat(10);
    const rejection = checkXmlDocumentBudget(deep, limits);
    expect(rejection?.code).toBe('xml-budget');
    expect(rejection?.limit).toBe(5);
  });

  it('rejects element counts above the budget', () => {
    const many = '<i/>'.repeat(30);
    const rejection = checkXmlDocumentBudget(many, limits);
    expect(rejection?.code).toBe('xml-budget');
    expect(rejection?.limit).toBe(20);
  });

  it('handles malformed tails without throwing', () => {
    expect(() => checkXmlDocumentBudget('<a><b', limits)).not.toThrow();
    expect(() => checkXmlDocumentBudget('<!-- unterminated', limits)).not.toThrow();
    expect(() => checkXmlDocumentBudget('', limits)).not.toThrow();
  });

  it('is deterministic across identical inputs (seeded)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('<a>', '</a>', '<i/>', 'x', '<!-- c -->'), {
          maxLength: 60,
        }),
        (parts) => {
          const text = parts.join('');
          const first = checkXmlDocumentBudget(text, limits);
          const second = checkXmlDocumentBudget(text, limits);
          expect(second).toEqual(first);
        },
      ),
      { seed: 1484, numRuns: 100 },
    );
  });
});
