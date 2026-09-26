/**
 * Model-output extraction for the Transformers.js story/logic engine
 * (GOAP-273 Phase B1; ADR-999 D4, ADR-034).
 *
 * Split from `transformers-editorial-format.ts` (500-line cap). Dependency
 * direction is one-way — format imports FROM here, never the reverse — so
 * there is no import cycle, and the engine's import surface is unchanged
 * (`parseCandidates` keeps calling in from the format module).
 *
 * Two safety rules (mirrored from the format module header):
 *  - **No regular expression ever runs over model output.** Everything here
 *    is a character loop or `indexOf` slice after a hard length cap: fences
 *    are cut with slices, trailing commas removed in one string-aware pass,
 *    complete objects collected by a balanced-depth scan. Untrusted input
 *    cannot trigger backtracking because there is nothing to backtrack.
 *  - **Salvage repairs structure, never content.** A trailing comma, an
 *    unclosed array wrapper, or a code fence around COMPLETE objects is
 *    recovered (observed 0.5B drift, probes #3/#4); truncated objects and
 *    keys split across objects are NOT repaired — those runs retry and fail
 *    honestly instead of surfacing a mangled finding.
 */

/** Model output never exceeds a few KB; slice before any parsing runs (ADR-034). */
const MAX_OUTPUT_CHARS = 32_768;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Minimal shape of a finding the adapter can actually consume. */
function looksLikeFinding(value: Record<string, unknown>): boolean {
  return 'category' in value || 'question' in value || 'spans' in value;
}

/**
 * Drops trailing commas before `}`/`]` — one string-aware pass, no regex
 * (ADR-034). Quote-aware: a comma inside a string value is never touched.
 */
function stripTrailingCommas(text: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < text.length && ' \n\r\t'.includes(text[j] ?? '')) j += 1;
      const next = text[j];
      if (next !== '}' && next !== ']') out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

function tryParseObject(text: string): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripTrailingCommas(text));
  } catch {
    return null;
  }
  if (!isRecord(parsed) || Array.isArray(parsed) || !looksLikeFinding(parsed)) return null;
  return parsed;
}

function tryParseArray(text: string): unknown[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripTrailingCommas(text));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const entries: unknown[] = parsed;
  // `[]` is a completed analysis. A non-empty array with no finding shape at
  // all (e.g. salvaged sub-objects) broke the contract — say so honestly.
  if (entries.length === 0) return entries;
  const hasFinding = entries.some((entry) => isRecord(entry) && looksLikeFinding(entry));
  return hasFinding ? entries : null;
}

/**
 * Collects COMPLETE top-level `{...}` objects with a balanced-depth scan
 * (string-aware, single pass — ADR-034): recovers findings whose array
 * wrapper was left unclosed (observed 0.5B drift, probe #4). Nested objects
 * stay inside their parent; a truncated object is skipped, never half-read.
 */
function scanTopLevelObjects(text: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (ch === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const obj = tryParseObject(text.slice(start, i + 1));
        if (obj !== null) found.push(obj);
        start = -1;
      }
    }
  }
  return found;
}

/**
 * Extracts the model's answer with bounded slices — no regex over untrusted
 * output (ADR-034). Tolerates the observed 0.5B shapes: a top-level array,
 * a single finding object, prose/code-fence wrappers, trailing commas and
 * unclosed array wrappers (probes #3/#4). Returns null when nothing
 * contract-shaped parses — truncated objects are never half-repaired.
 */
export function extractJson(output: string): unknown[] | null {
  const bounded = output.length > MAX_OUTPUT_CHARS ? output.slice(0, MAX_OUTPUT_CHARS) : output;
  // Leading code fence: drop its opener LINE (backticks never occur in the
  // prompt — models escape to them, probe #3); the buried-slice paths below
  // recover the rest of any wrapper.
  const firstNl = bounded.indexOf('\n');
  const unfenced = bounded.startsWith('`') && firstNl !== -1 ? bounded.slice(firstNl + 1) : bounded;
  const trimmed = unfenced.trim();
  // Starts with an object → the model answered with one finding, not an array.
  if (trimmed.startsWith('{')) {
    const obj = tryParseObject(trimmed);
    if (obj !== null) return [obj];
    // Complete object + trailing prose (probe #6: valid JSON, then a
    // degeneration loop after the close). Falling through lets the slice and
    // balanced-scan paths below recover the complete object — the junk tail
    // is structure, never content, and is never repaired (module contract).
  }
  const whole = tryParseArray(trimmed);
  if (whole !== null) return whole;
  const arrStart = unfenced.indexOf('[');
  const arrEnd = unfenced.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    const arr = tryParseArray(unfenced.slice(arrStart, arrEnd + 1));
    if (arr !== null) return arr;
  }
  const objStart = unfenced.indexOf('{');
  const objEnd = unfenced.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    const obj = tryParseObject(unfenced.slice(objStart, objEnd + 1));
    if (obj !== null) return [obj];
  }
  // Salvage of last resort: unclosed/truncated array — collect whatever
  // complete top-level objects survived. Structural repair only.
  const objects = scanTopLevelObjects(unfenced);
  return objects.length > 0 ? objects : null;
}
