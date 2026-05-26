/**
 * Security headers applied to ALL Worker responses.
 * These headers harden the API against common web vulnerabilities.
 *
 * @see https://owasp.org/www-project-secure-headers/
 */

/**
 * Security headers map — applied via `applySecurityHeaders()`.
 * Non-JSON responses (file downloads, 204 OPTIONS) receive a subset.
 */
export const securityHeaders: Readonly<Record<string, string>> = Object.freeze({
  // Prevent MIME-type sniffing
  'X-Content-Type-Options': 'nosniff',

  // HSTS — enforce HTTPS for 1 year, include subdomains
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Prevent clickjacking — deny all framing
  'X-Frame-Options': 'DENY',

  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Restrict browser features (no camera, mic, payment, etc.)
  'Permissions-Policy': 'camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',

  // Content Security Policy — restrict resource loading for API responses
  // API endpoints should not render content; this is a defense-in-depth measure
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",

  // Cross-Origin isolation — prevent cross-origin data leaks
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
});

/**
 * Minimal security headers for non-JSON responses (e.g., file downloads, 204).
 * Omits CSP which may interfere with legitimate file serving.
 */
export const minimalSecurityHeaders: Readonly<Record<string, string>> = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
});

/**
 * Apply security headers to a response (mutates in place, returns for chaining).
 */
export function applySecurityHeaders(response: Response): Response {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * Apply minimal security headers to a response.
 * Use for file downloads or responses that may serve non-JSON content.
 */
export function applyMinimalSecurityHeaders(response: Response): Response {
  Object.entries(minimalSecurityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
