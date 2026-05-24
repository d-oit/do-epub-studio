# Security Policy

## Supported Versions

Only the latest release in the 0.1.x series is actively supported.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a Vulnerability

To report a vulnerability, use **GitHub Security Advisories** (private disclosure):

[https://github.com/d-oit/do-epub-studio/security/advisories/new](https://github.com/d-oit/do-epub-studio/security/advisories/new)

Do **not** open a public issue or discussion for a vulnerability.

## Response SLA

| Severity | Triage       | Fix / Mitigation Plan |
|----------|--------------|-----------------------|
| HIGH+    | 5 business days | 30 calendar days    |
| MEDIUM   | 5 business days | 90 calendar days    |
| LOW      | 5 business days | Best effort       |

## Scope

Vulnerabilities in the following locations are in scope:

- `apps/**`
- `packages/**`

## CI/CD Supply Chain Security

To mitigate supply chain risks, the following policies are enforced:

- **GitHub Actions SHA Pinning**: All GitHub Actions used in workflows MUST be pinned to a full 40-character commit SHA. Mutable tags (e.g., `@v4`) are prohibited except in comments for readability.
- **Automated Auditing**: Workflows are continuously audited using OpenSSF Scorecard and validated with `actionlint` and `zizmor` during the CI process.
- **Dependabot**: Dependabot is configured to provide automated updates for GitHub Actions SHAs.

## Out of Scope

The following are out of scope:

- Third-party dependencies (report to upstream maintainers)
- Social engineering attacks
- Denial of service via legitimate API rate usage
- Theoretical attacks without a proven exploit

## Related Documents

- [ADR-034 (ReDoS)](plans/034-adr-redos.md)
- [docs/security.md](docs/security.md)

## Content Sanitization and Sandboxing

To mitigate XSS risks from potentially malicious EPUB content, the following measures are implemented:

- **HTML Sanitization**: All EPUB HTML content is sanitized using **DOMPurify** before being rendered. This process strips dangerous elements (like `<script>`, `<iframe>`, `<object>`) and attributes (like `onclick`, `javascript:` URIs).
- **Iframe Sandboxing**: Content is rendered in an `<iframe>` with a strict `sandbox` attribute. Specifically, `allow-same-origin` is excluded to ensure the content runs in a unique origin, preventing it from accessing the main application's cookies, localStorage, and IndexedDB. While `allow-scripts` is present for compatibility with the reader engine, all script execution within the book content is blocked by the CSP.
- **Content Security Policy (CSP)**: A strict CSP is injected via a `<meta>` tag into every EPUB HTML document:
  `default-src 'none'; script-src 'none'; style-src 'unsafe-inline' blob:; font-src blob:; img-src data: blob: http: https:;`
  This CSP further restricts the capabilities of the rendered content, even if it manages to bypass other layers of defense.