# Security Posture

> **Status:** adopted (per ADR-092, GOAP plan #092)
> **Audience:** auditors, security reviewers, future contributors
> **Last reviewed:** 2026-06-14

This page records the standing security decisions for `do-epub-studio`
so they do not need to be re-litigated on every audit. Where the
implementation lives in code, links to the canonical ADR or PR are
included.

## Authentication transport: Bearer header (not cookies)

The reader web app authenticates every request with a
`Authorization: Bearer <token>` header, not with cookies.

- Client: `apps/web/src/lib/api.ts` constructs the header.
- Server: `apps/worker/src/auth/session.ts` (`parseAuthHeader`,
  `validateSession`).
- Tokens are 256-bit random; the SHA-256 hash is stored server-side
  (`session_token_hash` column).
- Sessions last 7 days (`SESSION_DURATION_MS`).

**Consequence: CSRF protection is not required** for the current flow.
A bearer token sent in a custom `Authorization` header is never
auto-attached by the browser across sites, so classic CSRF does not
exploit the design.

This decision is conditional. If a future change moves the session
into cookies (for example, to defend against XSS-based token theft),
CSRF protection (token or `SameSite=Strict` strategy) becomes
mandatory and this document must be updated.

## Token storage: `localStorage` (with compensating controls)

The session token is persisted in `localStorage` via Zustand
`persist`, so a single XSS payload can exfiltrate a 7-day-valid
session. We retain this design rather than moving to `httpOnly`
cookies because the cookie path forces a `SameSite=None; Secure` +
CORS-credentials posture across separate web/worker origins and
reintroduces the CSRF risk that D1 above already eliminated.

**Compensating controls (all required, audited by every release):**

1. **Strict Content-Security-Policy** per `apps/web/public/_headers`
   and ADR-035. `script-src` is restricted to `'self' 'wasm-unsafe-eval'`
   — no `'unsafe-inline'`, no `'unsafe-eval'`. A regression here
   blocks merge at the CI gate.
2. **Server-side revocation** of all sessions on grant change
   (AGENTS.md Tier 1, ADR-004). A stolen token is invalidated
   immediately by revoking the grant.
3. **Shortest-acceptable client lifetime** plus proactive expiry
   handling. `apps/web/src/hooks/useSessionExpiry.ts` warns ~5 min
   before expiry, auto-refreshes the session, and forces logout on
   actual expiry. This bounds the value of a stolen token to the
   time-to-detect (target: minutes, not days).
4. **DOMPurify sanitization** of all rendered EPUB content
   (`packages/reader-core/src/sanitizer.ts`). The primary XSS vector
   for this product is hostile EPUB HTML, not app code.

If the threat model changes (e.g. regulatory demand for defense
against XSS token theft), revisit this section and adopt cookie
sessions — which triggers the CSRF reversal above.

## Cross-Origin Policy (CSP and headers)

`apps/web/public/_headers` is the single source of truth and is
shipped to Cloudflare Pages. Current enforced values:

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://api.fontshare.com; img-src 'self' data: blob:; connect-src 'self' https://*.cloudflare.com; frame-ancestors 'none'; upgrade-insecure-requests` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |

The only `unsafe-inline` is in `style-src`, permitted because React
component libraries emit inline styles. The CSP for **scripts** is
strict; any change to add `'unsafe-inline'` to `script-src` requires
an ADR.

## ReDoS / bounded regex policy (ADR-034)

All regexes over **untrusted input** (EPUB OPF XML, search query
strings, annotation excerpts) MUST go through `matchBounded` /
`testBounded` / `matchAllBounded` from `@do-epub-studio/shared`.

- Helpers: `packages/shared/src/safe-regex.ts`
- Examples of compliance: `packages/reader-core/src/fixed-layout.ts`,
  `packages/reader-core/src/epub-accessibility.ts`,
  `apps/web/src/features/reader/hooks/useReaderSearch.ts`
  (literal-substring search uses `String.indexOf` in a loop, bounded
  by `SNIPPET_EXCERPT_MAX`).

## EPUB sanitization (DOMPurify, ADR-006)

`packages/reader-core/src/sanitizer.ts` configures DOMPurify with
an `ALLOWED_TAGS` allowlist (not `FORBID_TAGS`-only) and the
`addHook` system to strip event handlers, `javascript:` URLs, and
`vbscript:` URLs.

**Constraints (project invariant, never weakened):**

- The reader iframe `sandbox` attribute MUST NOT include
  `allow-scripts`. EPUB assets are static.
- The sanitizer MUST keep an `ALLOWED_TAGS` allowlist. Falling back
  to `FORBID_TAGS`-only is a security regression.

## Session, signed URLs, and storage

- Sessions are Argon2id-hashed passwords (per AGENTS.md Tier 1; no
  bcrypt/scrypt fallback).
- Signed file URLs (`apps/worker/src/storage/signed-url.ts`) are
  HMAC-SHA-256 of `bookId:fileKey:expires` and expire in 1 hour.
  The worker populates `fileSize` and `mimeType` from an R2
  `head` call (cached in-process, LRU max 200) so clients can show
  download progress and progress for non-EPUB assets.
- R2 access is via Cloudflare Workers bindings; no public bucket
  URLs are exposed.
- Grant changes revoke **all** active sessions for that grant
  immediately. See `apps/worker/src/routes/access.ts`
  (`recovery-request`, `verify-recovery`, `/refresh`).

## Vulnerability disclosure

`SECURITY.md` at the repository root is the disclosure front-door.
Never open a public GitHub issue for a suspected vulnerability
— contact the maintainers through the channel described there.

## How to verify these controls are still in force

- The `scripts/quality_gate.sh` script runs `pnpm typecheck`,
  `pnpm lint`, the unit-test suite, and a header-diff against
  `apps/web/public/_headers`.
- The Codacy workflow (`codacy-static-code-analysis`) is gating;
  the threshold is zero new issues of any severity.
- The `pre-commit` hook validates workflow files and SKILL.md
  frontmatter; tampering with `apps/web/public/_headers` is caught
  by the Prettier format check.

## Cross-references

- ADR-092 — `plans/092-adr-token-storage-and-feature-gap-policy.md`
  (the policy decisions summarized above)
- ADR-035 — `plans/035-adr-content-security-policy.md` (CSP detail)
- ADR-034 — `plans/034-adr-security-redos-hardening.md` (bounded regex)
- ADR-006 — annotation model and rendering contract
- `docs/security.md` — repository-root security policy
- `SECURITY.md` — vulnerability disclosure
