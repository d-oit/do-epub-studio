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
- [docs/security.md](docs/security.md)
