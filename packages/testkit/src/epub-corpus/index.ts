/**
 * The #1483 EPUB corpus harness.
 *
 * Exports the shared manifest (single source of truth), deterministic
 * generators, and the triaged EPUBCheck known-diffs table. Consumed by the
 * unit layer (reader-core), the browser layer (apps/tests) and the optional
 * differential job (scripts/diff-corpus-epubcheck.mjs).
 */
export * from './types';
export {
  CORPUS_ENTRIES,
  CORPUS_ENTRY_IDS,
  getCorpusEntry,
  EPUB_CORPUS_ISSUE,
  EPUB_CORPUS_ISSUE_LINK,
  EPUB_CORPUS_EXTENDS,
} from './manifest';
export { KNOWN_DIFFS, type KnownDiff } from './known-diffs';
export {
  buildCorpus,
  generateCorpusEntry,
  buildEpubFromSpec,
  xhtmlDoc,
  containerXml,
  opfXml,
  ncxXml,
  navDocXml,
  chapterBody,
  prng,
  generatePng,
  generateMinimalTtf,
  generateWav,
  type EpubSpec,
  type Chapter,
  type ExtraItem,
} from './generate';
export { buildZip, crc32, findLocalEntryOffset, listLocalEntryNames, type ZipEntry, type BuildZipOptions } from './zip';
