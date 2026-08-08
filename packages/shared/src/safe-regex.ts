/**
 * Execute a regex match only if the input is within a safe length bound.
 * Prevents ReDoS attacks by rejecting inputs that exceed maxLen before
 * executing the regex.
 *
 * @param re - The regular expression to test
 * @param input - The string to match against
 * @param maxLen - Maximum allowed input length
 * @returns The match result, or null if input exceeds maxLen or doesn't match
 */
export function matchBounded(re: RegExp, input: string, maxLen: number): RegExpExecArray | null {
  if (input.length > maxLen) return null;
  return re.exec(input);
}

/**
 * Test a regex pattern only if the input is within a safe length bound.
 * Prevents ReDoS attacks by rejecting inputs that exceed maxLen.
 *
 * @param re - The regular expression to test
 * @param input - The string to test against
 * @param maxLen - Maximum allowed input length
 * @returns true if the input matches, false otherwise
 */
export function testBounded(re: RegExp, input: string, maxLen: number): boolean {
  if (input.length > maxLen) return false;
  return re.test(input);
}

/**
 * Find all regex matches only if the input is within a safe length bound.
 * Returns an empty array if the input exceeds maxLen.
 *
 * @param re - The regular expression (must have g flag for multiple matches)
 * @param input - The string to search
 * @param maxLen - Maximum allowed input length
 * @returns Array of all matches, or empty array if input exceeds maxLen
 */
export function matchAllBounded(
  re: RegExp,
  input: string,
  maxLen: number,
): RegExpExecArray[] {
  if (input.length > maxLen) return [];
  return Array.from(input.matchAll(re));
}

/**
 * Escape special regex characters in a string so it can be used as a
 * literal pattern in a RegExp constructor.
 *
 * @param s - The string to escape
 * @returns The escaped string safe for use in new RegExp()
 */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
