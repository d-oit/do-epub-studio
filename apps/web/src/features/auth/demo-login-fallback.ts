/**
 * Credential login is only a fallback when the dedicated demo endpoint cannot
 * be reached or its response is an SPA document instead of API JSON. A coded
 * API error or an HTTP status is a server decision, not a fallback case.
 *
 * Codes are compared by type because `DOMException` carries a legacy numeric
 * `code` (23 for `TimeoutError`, 20 for `AbortError`) while `apiRequest`
 * attaches the API's string error code. Only the latter is a refusal.
 */
export function shouldUseDemoCredentialFallback(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;

  const details = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
    status?: unknown;
  };

  if (typeof details.code === 'string' && details.code !== '') return false;
  if (details.status !== undefined) {
    return (
      typeof details.status === 'number' &&
      details.status >= 200 &&
      details.status < 300 &&
      details.message === 'Invalid server response'
    );
  }

  return details.name === 'TypeError' || details.name === 'TimeoutError';
}
