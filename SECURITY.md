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

## Out of Scope

The following are out of scope:

- Third-party dependencies (report to upstream maintainers)
- Social engineering attacks
- Denial of service via legitimate API rate usage
- Theoretical attacks without a proven exploit

## Related Documents

- [ADR-034 (ReDoS)](plans/034-adr-redos.md)
- [docs/security.md](docs/security.md)