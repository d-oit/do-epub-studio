/**
 * LanguageTool editorial engine adapter (GOAP-273 Phase A2; ADR-274 D1/D6).
 *
 * Talks to the deployment-local loopback server provisioned by
 * `scripts/dev/languagetool.sh` — local *service*, not browser-offline
 * (ADR-274 D1), so `hasEngine()` reflects a real last-contact health state
 * instead of a configured flag. It serves spelling + grammar only; story and
 * logic are the separate B-track (GOAP-273 Phase B).
 *
 * Three invariants, each pinned by test:
 *  - **Trust boundary**: engine matches are mapped faithfully and every
 *    candidate passes `validateEditorialFindings`. A candidate the validator
 *    rejects fails the whole run as `incomplete_analysis` — never a silently
 *    dropped flag, never an ungrounded finding.
 *  - **Selection before mapping**: out-of-scope LanguageTool categories
 *    (STYLE, redundancy, typography …), categories the caller did not request,
 *    and matches overlapping creator-approved terms are dropped up front.
 *    Dropping is selection, not rejection, and it is how dialogue, dialect and
 *    glossary terms survive without server dictionaries or rule suppression
 *    (ADR-999 D4; ADR-274 D6).
 *  - **Honest unavailability**: every failure mode maps to its own
 *    `EditorialUnavailableReason`; "nothing found" is only ever returned for a
 *    completed analysis.
 *
 * Consent (`consent.ts`) and qualification (`qualification.ts`) are untouched:
 * availability still composes `hasEngine()` with a milestone, and the
 * milestone flip is Phase A3 evidence work, not this file.
 */

import type {
  EditorialCategory,
  EditorialFinding,
  EditorialReviewOutcome,
  EditorialUnavailableReason,
} from '../editorial-findings';
import { validateEditorialFindings } from '../editorial-findings';
import type {
  AiPlugin,
  AiPluginCapabilities,
  EditorialReviewCapability,
  EditorialReviewRequest,
} from '../types';

/** Categories this adapter can answer (ADR-999 D4 spelling/grammar scope). */
export const LANGUAGE_TOOL_EDITORIAL_CATEGORIES: readonly EditorialCategory[] = [
  'spelling',
  'grammar',
];

/**
 * LanguageTool rule categories → grounded finding categories. Unlisted
 * categories are never escalated: dropping STYLE/redundancy/typography matches
 * is deliberate (voice and dialect are not errors — ADR-999 D4). Punctuation
 * maps to grammar because ADR-999 D4 names it inside the grammar scope.
 */
const LT_CATEGORY_MAP: Readonly<Record<string, EditorialCategory>> = {
  TYPOS: 'spelling',
  GRAMMAR: 'grammar',
  PUNCTUATION: 'grammar',
};

const DEFAULT_BASE_URL = 'http://127.0.0.1:8081';
const DEFAULT_TIMEOUT_MS = 15_000;

/** Structural fetch seam so tests can inject fakes without `any`. */
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface LanguageToolEditorialPluginOptions {
  /**
   * Base URL of the local server. The default is loopback (ADR-274 D5);
   * pointing this at a public host would break the deployment-local decision.
   */
  baseUrl?: string;
  /** Injectable fetch — the test seam; defaults to the global `fetch`. */
  fetchImpl?: FetchLike;
  /** Per-request timeout in milliseconds (default 15000). */
  timeoutMs?: number;
  /** Provenance overrides (qualification bookkeeping). */
  engine?: string;
  model?: string;
}

export interface LanguageToolEditorialCapability extends EditorialReviewCapability {
  /** Service base URL this capability talks to. */
  readonly baseUrl: string;
  /**
   * Fresh health probe. `hasEngine()` is fail-closed: it stays `false` until a
   * probe or a completed analysis has shown the service answering, so
   * availability reporting can never claim an engine nobody has contacted.
   * Any network-level failure flips it back to `false`.
   */
  probe(): Promise<boolean>;
}

export interface LanguageToolEditorialPlugin extends AiPlugin {
  readonly capabilities: AiPluginCapabilities & {
    readonly editorial: LanguageToolEditorialCapability;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * BCP-47 → LanguageTool language tag. No auto-detection: the server runs
 * without a fastText model (ADR-274 D1), so an unknown or missing language is
 * an honest `unsupported_language`, never a guessed analysis.
 */
function toLtLanguage(bcp47: string): string {
  const parts = bcp47.split('-');
  const primary = (parts[0] ?? '').toLowerCase();
  if (primary !== 'en') {
    return primary;
  }
  return (parts[1] ?? '').toLowerCase() === 'gb' ? 'en-GB' : 'en-US';
}

interface SentenceSpan {
  quote: string;
  start: number;
  end: number;
}

/**
 * Cited span: the engine-reported sentence when its ranges cover the match,
 * otherwise the matched fragment. Both are sliced from the request text, so
 * the quote is grounded by construction and `start`/`end` locate the match
 * inside it — the exact convention `validateEditorialFindings` checks.
 */
function sentenceWindow(
  text: string,
  offset: number,
  length: number,
  rawRanges: unknown,
): SentenceSpan {
  if (Array.isArray(rawRanges)) {
    const ranges: unknown[] = rawRanges;
    for (const entry of ranges) {
      if (!Array.isArray(entry)) {
        continue;
      }
      const pair: unknown[] = entry;
      const rangeStart = asNumber(pair[0]);
      const rangeEnd = asNumber(pair[1]);
      if (
        rangeStart !== null
        && rangeEnd !== null
        && rangeStart >= 0
        && rangeEnd <= text.length
        && rangeStart < rangeEnd
        && rangeStart <= offset
        && offset + length <= rangeEnd
      ) {
        return {
          quote: text.slice(rangeStart, rangeEnd),
          start: offset - rangeStart,
          end: offset + length - rangeStart,
        };
      }
    }
  }
  const quote = text.slice(offset, offset + length);
  return { quote, start: 0, end: quote.length };
}

/**
 * True when `[from, to)` overlaps any occurrence of a creator-approved term
 * (ADR-274 D6 mechanism: per-book index scans, deliberately regex-free — no
 * ReDoS surface and no server-side dictionary involved).
 */
function overlapsApprovedTerm(
  text: string,
  from: number,
  to: number,
  terms: readonly string[],
): boolean {
  for (const term of terms) {
    if (term.length === 0) {
      continue;
    }
    let index = text.indexOf(term);
    while (index !== -1) {
      if (from < index + term.length && to > index) {
        return true;
      }
      index = text.indexOf(term, index + 1);
    }
  }
  return false;
}

/** One `/v2/check` round-trip, reduced to what the mapper needs. */
type CheckOutcome =
  | { kind: 'answered'; matches: readonly unknown[]; sentenceRanges: unknown }
  | { kind: 'unavailable'; reason: EditorialUnavailableReason };

export function createLanguageToolEditorialPlugin(
  options: LanguageToolEditorialPluginOptions = {},
): LanguageToolEditorialPlugin {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const checkUrl = `${baseUrl}/v2/check`;
  const doFetch: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));

  /**
   * Last-contact health state backing `hasEngine()`: `true` once ANY HTTP
   * response was received (the service truly answered — the A2 rule), `false`
   * initially and after any network-level failure. Timeouts leave it
   * unchanged: no answer, but no proof of absence either.
   */
  let answered = false;
  let discoveredModel: string | null = null;

  function rememberVersion(raw: unknown): void {
    if (options.model !== undefined || !isRecord(raw) || !isRecord(raw.software)) {
      return;
    }
    const version = asString(raw.software.version);
    if (version !== null) {
      discoveredModel = version;
    }
  }

  async function probe(): Promise<boolean> {
    try {
      const res = await doFetch(`${checkUrl}?${new URLSearchParams({ language: 'en-US', text: 'hello' })}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      answered = true;
      if (res.ok) {
        try {
          rememberVersion(await res.json());
        } catch {
          // Present but unparseable — health stands on the HTTP answer itself.
        }
      }
      return answered;
    } catch {
      answered = false;
      return false;
    }
  }

  async function check(text: string, language: string): Promise<CheckOutcome> {
    let res: Response;
    try {
      res = await doFetch(checkUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ language, text }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') {
        return { kind: 'unavailable', reason: 'timeout' };
      }
      answered = false;
      return { kind: 'unavailable', reason: 'engine_missing' };
    }
    answered = true;
    if (res.status === 400) {
      // LanguageTool rejects unknown/unsupported language values with 400.
      return { kind: 'unavailable', reason: 'unsupported_language' };
    }
    if (!res.ok) {
      return { kind: 'unavailable', reason: 'incomplete_analysis' };
    }
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      return { kind: 'unavailable', reason: 'incomplete_analysis' };
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.matches)) {
      return { kind: 'unavailable', reason: 'incomplete_analysis' };
    }
    rememberVersion(parsed);
    const matches: unknown[] = parsed.matches;
    return { kind: 'answered', matches, sentenceRanges: parsed.sentenceRanges };
  }

  async function review(request: EditorialReviewRequest): Promise<EditorialReviewOutcome> {
    // This adapter answers spelling/grammar only. A request that also (or only)
    // asks for story/logic cannot be completed here, and returning "no
    // findings" for it would read as a clean story review that never ran —
    // callers ask per category (AssistancePanel iterates categories one by one).
    const wantsUnanswerable = request.categories.length === 0
      || request.categories.some(
        (category) => !LANGUAGE_TOOL_EDITORIAL_CATEGORIES.includes(category),
      );
    if (wantsUnanswerable) {
      return { status: 'unavailable', reason: 'incomplete_analysis' };
    }
    if (request.language === null) {
      return { status: 'unavailable', reason: 'unsupported_language' };
    }

    const language = toLtLanguage(request.language);
    const approvedTerms = request.approvedTerms ?? [];
    const findings: EditorialFinding[] = [];

    for (const [chapterRef, text] of Object.entries(request.chapterText)) {
      const checked = await check(text, language);
      if (checked.kind === 'unavailable') {
        return { status: 'unavailable', reason: checked.reason };
      }
      const sourceSha256 = request.chapterSha256[chapterRef] ?? null;

      for (const raw of checked.matches) {
        if (!isRecord(raw)) {
          // Not even an object: the response shape itself is broken.
          return { status: 'unavailable', reason: 'incomplete_analysis' };
        }
        const rule = isRecord(raw.rule) ? raw.rule : null;
        const categoryId = rule && isRecord(rule.category)
          ? asString(rule.category.id)
          : null;
        const category = categoryId !== null ? LT_CATEGORY_MAP[categoryId] : undefined;
        // Selection, not rejection: out-of-scope categories and categories the
        // caller did not request are dropped before mapping, so a spelling run
        // never surfaces grammar findings and voice is never standardized.
        if (category === undefined || !request.categories.includes(category)) {
          continue;
        }

        const offset = asNumber(raw.offset);
        const length = asNumber(raw.length);
        const span = offset !== null
          && length !== null
          && offset >= 0
          && length > 0
          && offset + length <= text.length
          ? { offset, length }
          : null;

        if (
          span
          && overlapsApprovedTerm(text, span.offset, span.offset + span.length, approvedTerms)
        ) {
          // ADR-274 D6: per-book approved-term suppression (glossary names,
          // invented terms, dialect spellings) instead of `disabledRules`
          // (kills global spell-check) or `dictPath` (deployment-wide).
          continue;
        }

        const window = span
          ? sentenceWindow(text, span.offset, span.length, checked.sentenceRanges)
          // Unreadable offsets: cite an empty quote so the validator rejects
          // this candidate (empty_quote) instead of the adapter slicing a
          // wrong span — map faithfully, let the trust boundary decide.
          : { quote: '', start: 0, end: 0 };
        const matchedText = span ? text.slice(span.offset, span.offset + span.length) : '';
        const replacements: readonly unknown[] = Array.isArray(raw.replacements)
          ? raw.replacements
          : [];
        const first = replacements[0];
        const proposed = isRecord(first) ? asString(first.value) : null;
        const replacement = proposed !== null && proposed.length > 0 && proposed !== matchedText
          ? proposed
          : null;

        findings.push({
          category,
          severity: replacement !== null ? 'suggestion' : 'question',
          // Blank explanations are left for the validator to reject
          // (empty_explanation) rather than papered over here.
          explanation: asString(raw.message) ?? asString(raw.shortMessage) ?? '',
          spans: [{
            chapterRef,
            cfi: null,
            quote: window.quote,
            sourceSha256,
            start: window.start,
            end: window.end,
          }],
          replacement,
          referenceIds: [],
          referenceRevisions: {},
          styleRevision: request.styleRevision,
          uncertainty: replacement !== null ? 'none' : 'review_needed',
          provenance: {
            engine: options.engine ?? 'LanguageTool',
            model: options.model ?? discoveredModel ?? 'unknown',
            ruleId: rule ? asString(rule.id) : null,
          },
        });
      }
    }

    const referenceRevisions: Record<string, number> = {};
    for (const [id, reference] of Object.entries(request.references)) {
      referenceRevisions[id] = reference.revision;
    }
    const validation = validateEditorialFindings(findings, {
      chapterText: request.chapterText,
      chapterSha256: request.chapterSha256,
      referenceRevisions,
      styleRevision: request.styleRevision,
    });
    if (validation.rejected.length > 0) {
      // The validator is the trust boundary: a rejection here means the
      // adapter mis-mapped the engine answer, so the run fails honestly as
      // incomplete — never a silent drop, never an ungrounded finding.
      return { status: 'unavailable', reason: 'incomplete_analysis' };
    }
    if (validation.accepted.length === 0) {
      return { status: 'no_supported_findings' };
    }
    return { status: 'ok', findings: validation.accepted };
  }

  const capability: LanguageToolEditorialCapability = {
    kind: 'editorial',
    baseUrl,
    hasEngine: () => answered,
    probe,
    review,
  };

  return {
    id: 'languagetool-editorial',
    title: `LanguageTool editorial review (local ${baseUrl})`,
    version: '0.1.0',
    capabilities: { editorial: capability },
  };
}
