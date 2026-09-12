/**
 * Grounded editorial assistance — finding contract and deterministic
 * validation (GOAP-999 Wave 4, AI-01/AI-03; ADR-999 D4).
 *
 * The validator is engine-independent: it decides whether a candidate finding
 * is actually supported by the supplied book text, retained references and
 * revision pins. Engines may be wrong; nothing reaches a reviewer without
 * passing here. Rejections are returned, never silently dropped.
 *
 * No network, no engine, no model: this module is pure so the corpus in
 * `__tests__/editorial-findings.test.ts` can pin its behaviour deterministically.
 */

export type EditorialCategory = 'spelling' | 'grammar' | 'story' | 'logic';

/** How the finding should read to a reviewer. */
export type EditorialSeverity = 'info' | 'question' | 'suggestion';

export type EditorialUncertainty =
  | 'none'
  | 'review_needed'
  | 'insufficient_context';

/** A passage the finding relies on, with the source identity it came from. */
export interface CitedSpan {
  chapterRef: string | null;
  cfi: string | null;
  /** Exact source text the finding depends on. */
  quote: string;
  /** `book_files.sha256` the quote was taken from, when known. */
  sourceSha256: string | null;
  /** Optional character offsets within the quoted paragraph. */
  start?: number;
  end?: number;
}

export interface EditorialProvenance {
  engine: string;
  model: string;
  ruleId: string | null;
}

export interface EditorialFinding {
  category: EditorialCategory;
  severity: EditorialSeverity;
  /** Why it matters, in reviewer-facing terms. */
  explanation: string;
  /** At least one; story/logic findings may cite several passages. */
  spans: CitedSpan[];
  /** Minimal local edit when the finding proposes one, else null. */
  replacement: string | null;
  /** Ids of retained references relied upon. */
  referenceIds: string[];
  /** Reference revisions pinned when the finding was produced. */
  referenceRevisions: Record<string, number>;
  styleRevision: number | null;
  uncertainty: EditorialUncertainty;
  provenance: EditorialProvenance;
}

export type EditorialUnavailableReason =
  | 'engine_missing'
  | 'unsupported_language'
  | 'timeout'
  | 'refused'
  | 'incomplete_analysis'
  | 'cloud_not_qualified';

/**
 * Outcome union. `no_supported_findings` is a *successful* clean run and is
 * deliberately distinct from every failure mode: reporting "nothing found" for
 * a missing engine or a timeout would be a fabricated result.
 */
export type EditorialReviewOutcome =
  | { status: 'ok'; findings: EditorialFinding[] }
  | { status: 'no_supported_findings' }
  | { status: 'unavailable'; reason: EditorialUnavailableReason };

export type FindingRejectionReason =
  | 'empty_spans'
  | 'empty_quote'
  | 'empty_explanation'
  | 'unknown_category'
  | 'quote_not_found'
  | 'stale_citation'
  | 'unknown_reference'
  | 'reference_revision_mismatch'
  | 'missing_span_for_replacement';

export interface RejectedFinding {
  finding: EditorialFinding;
  reason: FindingRejectionReason;
}

export interface ValidationResult {
  accepted: EditorialFinding[];
  rejected: RejectedFinding[];
}

/** Source material a finding must be checked against. */
export interface ValidationContext {
  /** Chapter text keyed by `chapterRef` (null key = book-level text). */
  chapterText: Record<string, string>;
  /** Current `book_files.sha256` per `chapterRef`, when known. */
  chapterSha256: Record<string, string | null>;
  /** Known retained references: id → current revision. */
  referenceRevisions: Record<string, number>;
  /** Current style-profile revision, when one exists. */
  styleRevision?: number | null;
}

const CATEGORIES: readonly EditorialCategory[] = ['spelling', 'grammar', 'story', 'logic'];

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

function spanTextKey(span: CitedSpan): string {
  return span.chapterRef ?? '';
}

/**
 * Validate candidate findings against supplied source material.
 *
 * Rejects (never repairs): fabricated quotes, stale source identity, invented
 * or drifted references, empty spans/explanations, unknown categories, and
 * spelling/grammar replacements that do not identify an exact span.
 */
export function validateEditorialFindings(
  findings: readonly EditorialFinding[],
  context: ValidationContext,
): ValidationResult {
  const accepted: EditorialFinding[] = [];
  const rejected: RejectedFinding[] = [];

  for (const finding of findings) {
    const reject = (reason: FindingRejectionReason): void => {
      rejected.push({ finding, reason });
    };

    if (!CATEGORIES.includes(finding.category)) {
      reject('unknown_category');
      continue;
    }
    if (finding.spans.length === 0) {
      reject('empty_spans');
      continue;
    }
    if (isBlank(finding.explanation)) {
      reject('empty_explanation');
      continue;
    }
    if (finding.spans.some((span) => isBlank(span.quote))) {
      reject('empty_quote');
      continue;
    }

    // Grounding first: a fabricated quote or stale source is the more
    // fundamental failure, and reporting the minimal-edit rule ahead of it
    // would misdirect the reviewer.
    let quoteMissing = false;
    let stale = false;
    for (const span of finding.spans) {
      const text = context.chapterText[spanTextKey(span)];
      if (typeof text !== 'string' || !text.includes(span.quote)) {
        quoteMissing = true;
        break;
      }
      const currentSha = context.chapterSha256[spanTextKey(span)] ?? null;
      if (span.sourceSha256 !== null && currentSha !== null && span.sourceSha256 !== currentSha) {
        stale = true;
        break;
      }
    }
    if (quoteMissing) {
      reject('quote_not_found');
      continue;
    }
    if (stale) {
      reject('stale_citation');
      continue;
    }

    let referenceProblem: FindingRejectionReason | null = null;
    for (const id of finding.referenceIds) {
      const current = context.referenceRevisions[id];
      if (current === undefined) {
        referenceProblem = 'unknown_reference';
        break;
      }
      const pinned = finding.referenceRevisions[id];
      if (pinned !== undefined && pinned !== current) {
        referenceProblem = 'reference_revision_mismatch';
        break;
      }
    }
    if (referenceProblem) {
      reject(referenceProblem);
      continue;
    }

    // A minimal edit must point at an exact span, otherwise the reviewer has
    // no way to see what would change.
    const needsSpanOffsets = finding.category === 'spelling' || finding.category === 'grammar';
    if (needsSpanOffsets && finding.replacement !== null) {
      const first = finding.spans[0];
      if (!first || first.start === undefined || first.end === undefined) {
        reject('missing_span_for_replacement');
        continue;
      }
    }

    accepted.push(finding);
  }

  return { accepted, rejected };
}
