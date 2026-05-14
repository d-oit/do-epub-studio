# Security

## Auth Model

### Session Tokens

- Token: 32 random bytes → 64-char hex string
- Stored: SHA-256 hash in `reader_sessions` table (never plaintext)
- Transport: `Authorization: Bearer <token>` header
- Expiry: 7 days (`SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000`)
- Revocation: sets `revoked_at` timestamp (checked on every request)
- Source: `apps/worker/src/auth/session.ts`

### requireAuth Middleware

Every protected route invokes `requireAuth(env, request)` (`apps/worker/src/auth/middleware.ts`):

1. Parse `Bearer` token from `Authorization` header
2. SHA-256 hash the token → query `reader_sessions WHERE session_token_hash = ? AND revoked_at IS NULL`
3. Validate expiry (`expires_at >= now()`)
4. Cross-reference `book_access_grants` for the session's `book_id` + `email`
5. Return `AuthContext` with granular capabilities (`canRead`, `canComment`, `canHighlight`, `canBookmark`, `canDownloadOffline`, `canExportNotes`)

Failures return `null` → handler returns 401 → client calls `handleUnauthorized()` (logout + redirect to `/login?error=session_expired`).

Client-side 401 handling in `apps/web/src/lib/api.ts` line 69-71: global interceptor catches 401 for all endpoints except access request and admin login.

### Password Hashing (Admin)

- Algorithm: Argon2id via `argon2-wasm-edge`
- Source: `apps/worker/src/auth/password.ts`
- Used for admin authentication only (reader auth is token-based via email + book code)

## Signed URL Implementation

EPUB files are stored in Cloudflare R2. Direct R2 URLs are never exposed to clients.

**Generation** (`apps/worker/src/storage/signed-url.ts`):

1. Compute HMAC-SHA256 over `{bookId}:{fileKey}:{expiresEpoch}` using `SESSION_SIGNING_SECRET`
2. Return URL: `/api/files/{bookId}/{fileKey}?expires={epoch}&signature={hex}`
3. TTL: 1 hour (`SIGNED_URL_EXPIRY_SECONDS = 3600`)

**Verification**:

1. Validate `expires` is a valid epoch and not expired
2. Recompute HMAC-SHA256 signature using same secret
3. Reject if signature length ≠ 64 chars or verification fails

## Content Sandboxing

EPUB content is rendered inside an iframe with restricted sandbox attributes:

```typescript
// apps/web/src/features/reader/ReaderPage.tsx (via reader-core)
// apps/web/src/features/reader/components/ReaderViewer.tsx (iframe directly)
sandbox: ['allow-same-origin']
```

- `allow-same-origin` only — no `allow-scripts`, no `allow-popups`, no `allow-forms`
- Prevents EPUB scripts from executing or making network requests
- Dark mode / sepia applied via `rendition.themes.registerRules()` injecting CSS

## Multi-Signal Locators (ADR-006)

Annotation anchoring uses a fallback hierarchy to prevent data loss and injection:

```typescript
interface AnnotationLocator {
  cfi?: string;           // Primary: EPUB Canonical Fragment ID
  selectedText?: string;  // Secondary: text snapshot (50+ chars)
  chapterRef?: string;    // Tertiary: TOC path
  elementIndex?: number;  // Fallback: DOM position
  charOffset?: number;    // Fallback: character offset
}
```

**Re-anchoring strategy** when CFI fails (e.g., content reflow):

1. Exact text match → find first occurrence
2. Fuzzy text match → Levenshtein distance < 3
3. Chapter fallback → jump to chapter start
4. User notification → "Annotation may have moved"

This prevents anchor injection: even if a CFI is malformed, the text and chapter signals provide validation and fallback.

## Additional Hardening

- **CORS**: Restricted to `env.APP_BASE_URL` origin; `Vary: Origin` header
- **Security headers**: Applied via `applySecurityHeaders()` (CSP, X-Frame-Options, etc.)
- **Rate limiting**: `RateLimiterDO` durable object per IP
- **Audit logging**: All grant/session changes logged to `audit_logs` table
- **Trace IDs**: Every request gets a traceId for observability without leaking internal state
