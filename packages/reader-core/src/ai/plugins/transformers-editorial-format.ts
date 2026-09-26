/**
 * Text encoding/parsing + progress mapping for the Transformers.js story/logic
 * engine (GOAP-273 Phase B1; ADR-999 D4, ADR-034).
 *
 * Split from `transformers-editorial.ts` (500-line cap), with model-output
 * extraction further split into `transformers-editorial-output.ts` (same cap).
 * Dependency direction stays one-way — the engine imports FROM these modules,
 * never the reverse — so there is no import cycle.
 *
 * Two safety rules live here (the output module mirrors them):
 *  - **No regular expression ever runs over book text or model output**
 *    (ADR-034 / safe-regex-authoring): sentences are split by a character
 *    loop, and the model's JSON array is extracted by bounded character
 *    scans in the output module. Untrusted input cannot trigger backtracking
 *    because there is nothing to backtrack.
 *  - **Every citation is verified before it becomes a quote**: a
 *    `{chapter, sentence}` number is sliced from the real passage; a copied
 *    `quote` (the form a 0.5B model reliably produces) must locate as an
 *    exact substring via `locateQuote`/`resolveCitation`. Nothing unverified
 *    ever surfaces — quotes stay substrings of the supplied manuscript by
 *    construction.
 *
 * Progress mapping mirrors the v4 `progress_callback` vocabulary
 * (`initiate | download | progress | progress_total | done | ready`), pinned
 * by test so a library upgrade that renames statuses fails loudly instead of
 * silently dropping the download label.
 */

import type { EditorialCategory } from '../editorial-findings';
import type { EditorialReviewRequest } from '../types';
import { extractJson, isRecord } from './transformers-editorial-output';

/** Quantization: `q8` → `model_quantized.onnx` (~488 MB), `q4` → `model_q4.onnx`. */
export type TransformersDtype = 'q4' | 'q8';

/**
 * Inference backend. v4 validates per runtime — browsers accept
 * {wasm, webgpu, webnn*}, Node accepts {cpu, webgpu, cuda} — so a value is
 * only valid in its own environment; `resolveInferenceDevice` mirrors that.
 */
export type TransformersDevice = 'webgpu' | 'wasm' | 'cpu';

/** Progress for the labelled on-demand load (surfaced verbatim by the UI). */
export interface ModelLoadProgress {
  phase: 'code' | 'download' | 'initialize';
  file: string | null;
  loadedBytes: number | null;
  totalBytes: number | null;
  percent: number | null;
}

/**
 * Bounded review scope: refusing to silently drop chapters the engine cannot
 * fit in one pass. An over-limit request is `incomplete_analysis`, not a
 * truncated review that would read as complete.
 */
export const MAX_MANUSCRIPT_CHARS = 90_000;
function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Maps a Transformers.js `progress_callback` event onto the load contract.
 * v4 statuses: `initiate | download | progress | progress_total | done` are
 * download phases, `ready` is initialization; anything else is noise
 * (returns null and is never forwarded to the UI).
 */
export function mapProgressEvent(event: unknown): ModelLoadProgress | null {
  if (typeof event !== 'object' || event === null) return null;
  const raw = event as Record<string, unknown>;
  const status = asStringOrNull(raw.status);
  if (status === 'progress') {
    const total = asNumberOrNull(raw.total);
    const loaded = asNumberOrNull(raw.loaded);
    return {
      phase: 'download',
      file: asStringOrNull(raw.file),
      loadedBytes: loaded,
      totalBytes: total,
      percent:
        total !== null && total > 0 && loaded !== null
          ? Math.round((loaded / total) * 100)
          : asNumberOrNull(raw.progress),
    };
  }
  if (
    status === 'initiate' ||
    status === 'download' ||
    status === 'progress_total' ||
    status === 'done'
  ) {
    return {
      phase: 'download',
      file: asStringOrNull(raw.file),
      loadedBytes: asNumberOrNull(raw.loaded),
      totalBytes: asNumberOrNull(raw.total),
      percent: null,
    };
  }
  if (status === 'ready') {
    return {
      phase: 'initialize',
      file: asStringOrNull(raw.file),
      loadedBytes: null,
      totalBytes: null,
      percent: null,
    };
  }
  return null;
}

/**
 * Hand-rolled sentence splitter (no regex — ADR-034: book text is untrusted).
 * Returns exact substrings of `text`; a terminator only ends a sentence when
 * followed by whitespace or the end, so decimals ("1985.5") and abbreviations
 * stay intact where ambiguous.
 */
export function splitSentences(text: string): string[] {
  const closers = '"\'”’)]';
  const sentences: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    let end = i + 1;
    while (end < text.length && closers.includes(text[end] ?? '')) end += 1;
    const next = text[end];
    if (end < text.length && next !== ' ' && next !== '\n' && next !== '\r' && next !== '\t') {
      continue;
    }
    const sentence = text.slice(start, end);
    // A segment fully wrapped in quotes is embedded speech, not a boundary
    // ("Done?" she asked) — defer so closing-quote sentences still terminate
    // at their own terminator while quoted exclamations stay attached.
    const wrapped =
      sentence.length >= 2 &&
      (sentence.startsWith('"') || sentence.startsWith('“') || sentence.startsWith('‘')) &&
      closers.includes(sentence[sentence.length - 1] ?? '');
    if (wrapped) continue;
    if (sentence.trim().length > 0) sentences.push(sentence);
    start = end + 1;
    i = end;
  }
  const rest = text.slice(start);
  if (rest.trim().length > 0) sentences.push(rest);
  return sentences;
}

/**
 * Minimum length a trimmed quote must keep — a slice shorter than this is too
 * generic to count as evidence for a citation.
 */
const MIN_TRIMMED_QUOTE_CHARS = 12;

/**
 * Resolves a copied quote to an exact substring of `text` (indexOf only, no
 * regex — ADR-034). Exact copy wins; a case-only drift (observed 0.5B:
 * "Winter" vs "winter") falls back to a length-preserving case fold that
 * still returns the manuscript's own casing; a drifted tail (observed 0.5B:
 * wrong ending punctuation, invented continuation) is trimmed back over word
 * boundaries until a prefix verifiably occurs in the manuscript. Returns null
 * when nothing of substance matches — the caller fails the run rather than
 * guess.
 */
export function locateQuote(text: string, wanted: string): string | null {
  const needle = wanted.trim();
  if (needle.length === 0) return null;
  if (text.indexOf(needle) !== -1) return needle;
  // Case-fold fallback: toLowerCase is not a regex (ADR-034) and is trusted
  // only when it preserves length, so folded offsets stay 1:1 with the
  // original text — the returned slice keeps the manuscript's own casing.
  const foldedText = text.toLowerCase();
  const foldedNeedle = needle.toLowerCase();
  if (foldedText.length === text.length && foldedNeedle.length === needle.length) {
    const at = foldedText.indexOf(foldedNeedle);
    if (at !== -1) return text.slice(at, at + needle.length);
  }
  let end = needle.length;
  while (end >= MIN_TRIMMED_QUOTE_CHARS) {
    const space = needle.lastIndexOf(' ', end - 1);
    if (space < MIN_TRIMMED_QUOTE_CHARS) return null;
    const prefix = needle.slice(0, space);
    if (text.indexOf(prefix) !== -1) return prefix;
    end = space;
  }
  return null;
}

/** A chapter already numbered into citable sentences (exact substrings). */
export interface NumberedChapter {
  ref: string;
  sentences: string[];
}

interface CandidateSpan {
  chapterRef: string;
  /** Set when the model cited a sentence NUMBER; null when it copied text. */
  sentenceIndex: number | null;
  /** Set when the model cited copied text (quote field or string sentence). */
  quote: string | null;
}

/**
 * Resolves one citation against the real manuscript: a sentence number is
 * sliced from the numbered chapter; a copied quote must locate as an exact
 * substring of the chapter's own text. Null = unresolvable → the run retries,
 * then fails honestly (ADR-999 never a fabricated quote).
 */
export function resolveCitation(
  chapter: NumberedChapter,
  chapterText: string | null,
  cited: CandidateSpan,
): string | null {
  if (cited.sentenceIndex !== null) {
    const sliced = chapter.sentences[cited.sentenceIndex - 1];
    return typeof sliced === 'string' && sliced.trim().length > 0 ? sliced : null;
  }
  if (cited.quote === null || chapterText === null) return null;
  return locateQuote(chapterText, cited.quote);
}

interface RawCandidate {
  category: EditorialCategory;
  spans: CandidateSpan[];
  question: string;
  uncertainty: 'review_needed' | 'insufficient_context';
}

/**
 * Parses model output into candidates. Returns `parseable: false` when the
 * output is not a JSON array (the run fails honestly). Category selection
 * happens here: story/logic only, and only categories the caller requested
 * (selection, not rejection — the A2 rule); unresolved citations fail later
 * during grounding, in the engine.
 */
export function parseCandidates(
  output: string,
  requested: readonly EditorialCategory[],
): { candidates: RawCandidate[]; parseable: boolean } {
  const arr = extractJson(output);
  if (arr === null) return { candidates: [], parseable: false };
  const candidates: RawCandidate[] = [];
  for (const entry of arr) {
    if (!isRecord(entry)) continue;
    const category = asStringOrNull(entry.category);
    // Selection: out-of-scope or unrequested categories are never escalated.
    if (category !== 'story' && category !== 'logic') continue;
    if (!requested.includes(category)) continue;
    const rawSpans = Array.isArray(entry.spans) ? entry.spans : [];
    const spans: CandidateSpan[] = [];
    for (const rawSpan of rawSpans) {
      if (!isRecord(rawSpan)) continue;
      const chapterRef = asStringOrNull(rawSpan.chapter);
      if (chapterRef === null) continue;
      const sentence = asNumberOrNull(rawSpan.sentence);
      if (sentence !== null) {
        spans.push({ chapterRef, sentenceIndex: Math.trunc(sentence), quote: null });
        continue;
      }
      // Observed 0.5B drift: the model cites the sentence TEXT instead of its
      // number — in `quote`, or wrongly inside `sentence`. Both resolve as
      // verified quotes in the engine; junk skips the span (→ retry/fail).
      const copied = asStringOrNull(rawSpan.quote) ?? asStringOrNull(rawSpan.sentence);
      if (copied === null || copied.trim().length === 0) continue;
      spans.push({ chapterRef, sentenceIndex: null, quote: copied });
    }
    const question = asStringOrNull(entry.question) ?? '';
    const uncertainty =
      asStringOrNull(entry.uncertainty) === 'insufficient_context'
        ? 'insufficient_context'
        : 'review_needed';
    candidates.push({ category, spans, question, uncertainty });
  }
  return { candidates, parseable: true };
}

/** A chat turn for the engine's chat-templated prompt (structurally ChatMessage). */
export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const MIN_ECHO_QUESTION_CHARS = 40;

/**
 * Lowercase + collapse whitespace runs without touching a regex over
 * untrusted model output (ADR-034): a hand-rolled scan over the four ASCII
 * whitespace code points is linear, bounded, and cannot backtrack.
 */
function normalizeEchoText(value: string): string {
  let out = '';
  let pendingSpace = false;
  for (const ch of value.toLowerCase()) {
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      pendingSpace = out.length > 0;
      continue;
    }
    if (pendingSpace) {
      out += ' ';
      pendingSpace = false;
    }
    out += ch;
  }
  return out;
}

export function isPromptEcho(question: string, messages: readonly PromptMessage[]): boolean {
  const q = question.trim();
  if (q.includes('<question') || q.includes('<chapter id') || q.includes('<copied sentence>')) {
    // Unfilled schema slot copied as the question (observed probes #2/#4).
    return true;
  }
  if (q.length < MIN_ECHO_QUESTION_CHARS) return false;
  const nq = normalizeEchoText(q);
  if (nq.length < MIN_ECHO_QUESTION_CHARS) return false;
  for (const message of messages) {
    if (normalizeEchoText(message.content).includes(nq)) return true;
  }
  return false;
}

/** Numbers the request's chapters; null when the manuscript exceeds the cap. */
export function buildChapters(request: EditorialReviewRequest): NumberedChapter[] | null {
  let total = 0;
  const chapters: NumberedChapter[] = [];
  for (const [ref, text] of Object.entries(request.chapterText)) {
    if (typeof text !== 'string' || text.trim().length === 0) continue;
    total += text.length;
    if (total > MAX_MANUSCRIPT_CHARS) return null;
    chapters.push({ ref, sentences: splitSentences(text) });
  }
  return chapters;
}

/** Pulls the assistant text out of pipeline result shapes (string or chat messages). */
export function extractAssistantText(result: unknown): string | null {
  if (typeof result === 'string') return result;
  if (!Array.isArray(result) || result.length === 0) return null;
  const first: unknown = result[0];
  if (!isRecord(first)) return null;
  const generated = first.generated_text;
  if (typeof generated === 'string') return generated;
  if (Array.isArray(generated)) {
    for (let i = generated.length - 1; i >= 0; i -= 1) {
      const message: unknown = generated[i];
      if (isRecord(message) && message.role === 'assistant') {
        return asStringOrNull(message.content);
      }
    }
    const last: unknown = generated[generated.length - 1];
    if (isRecord(last)) return asStringOrNull(last.content);
  }
  return null;
}
