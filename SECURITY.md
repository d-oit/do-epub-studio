# Security Policy

## Supported Versions

| Version | Supported | EOL Date |
|---------|-----------|----------|
| >=0.1.0 | Yes       | -        |
| <0.1.0  | No        | -        |

## Reporting a Vulnerability

**DO NOT** open a public issue for security vulnerabilities. Instead:

1. **Preferred:** Use GitHub's [Private Security Advisory](https://github.com/d-oit/do-epub-studio/security/advisories) feature
2. **Alternative:** Email security@d-oit.com

Please include:
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

## Response SLA

| Severity | Acknowledgment | Patch |
|----------|----------------|-------|
| Critical | 24 hours       | 14 days |
| High     | 48 hours       | 30 days |
| Medium   | 72 hours       | 60 days |
| Low      | 7 days         | 90 days |

## Rate Limiting Policy

To protect against brute-force attacks and denial-of-service, the following rate limits are enforced:

- **Auth Endpoints** (`/api/access/request`, `/api/admin/login`, etc.): 10 requests per minute.
- **File Endpoints** (`/api/files/*`, etc.): 30 requests per minute.
- **General API Endpoints**: 60 requests per minute.

Limits are applied per IP address and, where applicable, per authentication token. Exceeding these limits will result in a `429 Too Many Requests` response with a `Retry-After` header.

## Scope

**In Scope:**
- Authentication and session management
- Cloudflare Worker API endpoints
- R2 signed URL generation and validation
- Turso database queries
- EPUB file parsing and rendering
- Project source code: `apps/**`, `packages/**`

## CI/CD Supply Chain Security

To mitigate supply chain risks, the following policies are enforced:

- **GitHub Actions SHA Pinning**: All GitHub Actions used in workflows MUST be pinned to a full 40-character commit SHA. Mutable tags (e.g., `@v4`) are prohibited except in comments for readability.
- **Automated Auditing**: Workflows are continuously audited using OpenSSF Scorecard and validated with `actionlint` and `zizmor` during the CI process.
- **Dependabot**: Dependabot is configured to provide automated updates for GitHub Actions SHAs.

## Out of Scope

The following are out of scope:
- Third-party dependencies (report to upstream maintainers)
- Self-hosted deployments
- Social engineering attacks
- Denial of service via legitimate API rate usage
- Theoretical attacks without a proven exploit

## CVE Policy

We will request a CVE ID for all critical and high severity vulnerabilities accepted into the advisory program.

## Related Documents

- [ADR-034 (ReDoS)](plans/034-adr-redos.md)
- [ADR-035 (Content Security Policy)](plans/035-adr-content-security-policy.md)
- [docs/security.md](docs/security.md)

## Content Security Policy (CSP)

The application enforces strict CSP headers across all Worker responses and EPUB content.

- **API/App Responses**: Restrict resource loading to 'self' and authorized domains. framing is disabled (`frame-ancestors 'none'`).
- **EPUB Content**: Rendered in a sandboxed iframe with `sandbox allow-same-origin allow-scripts`. The response header further restricts script execution and network access.
- **Reporting**: All violations are reported to `/api/csp-report`.

## API Request Validation

The Worker API implements a centralized validation layer using [Hono](https://hono.dev/) and [Zod](https://zod.dev/).

- **Schema Enforcement**: Every API endpoint that accepts a request body or query parameters is protected by a Zod schema from `@do-epub-studio/shared`.
- **Validation Middleware**: Request validation is performed by the `zValidator` middleware. Requests that do not conform to the schema are automatically rejected with a `400 Bad Request` status and detailed error information.
- **No Raw Input**: Use of raw `request.json()` in route handlers is strictly prohibited. Handlers must receive validated, typed data from the Hono context.
