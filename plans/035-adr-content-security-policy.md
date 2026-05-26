# ADR-035: Content Security Policy (CSP) Implementation

## Status
Accepted

## Context
EPUB.js renders book content in sandboxed iframes. Without a strict Content Security Policy (CSP) on the Worker response headers, a malicious EPUB file could potentially inject scripts or exfiltrate reader data if the sandbox is bypassed or misconfigured.

## Decision
We will implement a defense-in-depth security model using strict CSP headers at multiple levels:

1. **Global Worker Responses**: All API and application responses will include a strict CSP that defaults to `'self'` and disables framing via `frame-ancestors 'none'`.
2. **EPUB Content Responses**: Files served from R2 via the `/api/files` route will have a custom CSP that prevents them from being framed by anything other than the main application (`frame-ancestors 'self'`) and restricts their internal resource loading (e.g., `script-src 'none'`).
3. **Frontend Sandboxing**: The EPUB rendition iframe will continue to use the `sandbox` attribute, now including `allow-scripts` to support EPUBs that require scripting. However, the CSP header on the file response (`script-src 'none'`) will act as the primary security barrier, blocking scripts by default for maximum security unless the policy is explicitly relaxed for specific trusted content.
4. **Violation Reporting**: A dedicated endpoint `/api/csp-report` will be implemented to collect and log CSP violations for monitoring and policy refinement.

## Policy Details

### Global CSP (`securityHeaders`)
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self';
frame-src 'self';
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
report-uri /api/csp-report
```

### EPUB Content CSP (`handleDownloadBookFile`)
```
default-src 'self';
script-src 'none';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'none';
frame-ancestors 'self';
sandbox allow-same-origin allow-scripts;
report-uri /api/csp-report
```

## Consequences
- **Security**: Significantly reduced risk of XSS and data exfiltration from malicious EPUB files.
- **Functionality**: Some highly interactive EPUBs that rely on external scripts or complex framing might be restricted.
- **Observability**: CSP violation reports provide visibility into potential attacks or policy over-restriction.
- **Migration**: The policy starts in "enforced" mode. If significant regressions are found, it can be temporarily moved to `Content-Security-Policy-Report-Only`.
