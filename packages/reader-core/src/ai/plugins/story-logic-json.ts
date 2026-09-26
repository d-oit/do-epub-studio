/**
 * Tolerant JSON scanner for generative-engine output (GOAP-273 B1).
 *
 * Split out of `story-logic-editorial.ts` to keep both files under the 500-line
 * cap (ADR-278); it has no dependency on the adapter, and its two repairs below
 * are pinned directly in `story-logic-editorial.test.ts`.
 */

/**
 * Extract the first JSON value an engine returned, tolerating the untidy
 * output small instruct models actually produce. Anything still unparseable is
 * a genuine failure and must not be guessed at — the caller reports
 * `incomplete_analysis` rather than a fabricated finding.
 *
 * Two slips are repaired, because both were observed from a real run and both
 * otherwise discard a correct answer:
 *  - **A swapped closer**: `{"findings":[{…}` — an array closed with `}`. A
 *    brace-only scanner stops here and hands `JSON.parse` a truncated object.
 *  - **A truncated tail**: `{"findings":[{` — cut off by the token cap, needing
 *    `}]}` rather than just the outermost `}`.
 */
export function extractJsonObject(raw: string): unknown {
  const start = raw.indexOf('{');
  if (start === -1) {
    return null;
  }
  // Built up as characters so a swapped closer can be corrected in place
  // instead of by re-entering this function (which would not terminate).
  const out: string[] = [];
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i] ?? '';
    if (escaped) {
      escaped = false;
      out.push(ch);
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      out.push(ch);
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out.push(ch);
      continue;
    }
    if (inString) {
      out.push(ch);
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch);
      out.push(ch);
      continue;
    }
    if (ch === '}' || ch === ']') {
      const top = stack[stack.length - 1];
      if (top === undefined) {
        // A stray closer: stop at the value we already have.
        break;
      }
      // Repair a swapped closer by closing the container that is actually open
      // and letting the model's own token close the one it meant: for
      // `{"f":[{…}` we emit `]}` and drop the stray brace. Testing only
      // `top === ch` misses this, because the model closes the *outer* object.
      const wantsTop = top === (ch === '}' ? '[' : '{');
      if (wantsTop) {
        out.push(top === '{' ? '}' : ']');
        stack.pop();
      }
      out.push(ch);
      if (top !== ch) {
        stack.pop();
      }
      if (stack.length === 0) {
        return parseLenientJson(out.join(''));
      }
    } else {
      out.push(ch);
    }
  }
  // Truncated tail: close every container still open, innermost first.
  if (stack.length === 0) {
    return null;
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    out.push(stack[i] === '{' ? '}' : ']');
  }
  return parseLenientJson(out.join(''));
}

/** Parse, or null. Kept separate so a repaired slice gets exactly one try. */
function parseLenientJson(slice: string): unknown {
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}
