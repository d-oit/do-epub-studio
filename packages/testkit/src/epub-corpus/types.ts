/**
 * Corpus entry types for the durable EPUB corpus (issue #1483).
 *
 * The manifest is the single source of truth shared by the unit layer
 * (reader-core Vitest), the browser layer (apps/tests Playwright) and the
 * optional EPUBCheck differential job.
 */

export type CorpusCategory =
  | 'standards'
  | 'layout-i18n'
  | 'embedded-resources'
  | 'media-annotation'
  | 'malformed'
  | 'security';

/** How the fixture's security-relevant payload is expected to be resolved. */
export type SecurityVerdict =
  | { kind: 'none' }
  | { kind: 'graceful-reject'; at: 'archive' | 'parse' | 'render' }
  | { kind: 'sanitized'; what: string };

/** Archive-level validation outcome the fixture is expected to produce. */
export type ExpectedArchiveOutcome =
  | { kind: 'ok' }
  | { kind: 'reject'; reason: 'traversal' | 'corrupt' | 'ratio' | 'oversize' | 'too-many' };

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * A corpus-defined diagnostic. Codes are stable identifiers checked by
 * Layer 1 and reconciled against EPUBCheck findings by the differential job.
 */
export interface CorpusDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  /** Archive-relative path the finding applies to (null = package-level). */
  path: string | null;
}

export interface ExpectedMetadata {
  title?: string;
  language?: string;
  direction?: 'ltr' | 'rtl';
  epubVersion?: '2.0' | '3.0';
}

export interface CorpusEntry {
  /** Stable slug; also the fixture id used by both test layers. */
  id: string;
  category: CorpusCategory;
  /** Provenance — every fixture must be traceable to a CC0/generated origin. */
  provenance: {
    source: string;
    license: string;
    note: string;
  };
  featureTags: readonly string[];
  /** Whether the archive-parse pipeline is expected to succeed. */
  expectedParses: boolean;
  expectedArchive: ExpectedArchiveOutcome;
  expectedDiagnostics: readonly CorpusDiagnostic[];
  expectedMetadata: ExpectedMetadata;
  securityVerdict: SecurityVerdict;
  /**
   * Whether the fixture is safe and meaningful to load in a real browser
   * (Layer 2). Malformed archives and payloads that only exist to be rejected
   * are unit-layer only.
   */
  browserable: boolean;
}

export const CORPUS_LICENSE = 'CC0-1.0';

export function fixtureProvenance(note: string): CorpusEntry['provenance'] {
  return {
    source: 'd-oit/do-epub-studio',
    license: CORPUS_LICENSE,
    note,
  };
}
