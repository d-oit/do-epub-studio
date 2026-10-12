/**
 * Shared assertion helpers for the web unit suites.
 *
 * `noUncheckedIndexedAccess` makes every `arr[0]` / `record[key]` read
 * `T | undefined`. A test that reaches for element zero usually means "the code
 * under test must have produced this" — `defined` states that intent and fails
 * loudly with the element's name instead of letting `undefined` travel into an
 * assertion that then reports something unrelated.
 */
export function defined<T>(value: T | undefined, what = 'value'): T {
  if (value === undefined) {
    throw new Error(`expected ${what} to be defined`);
  }
  return value;
}
