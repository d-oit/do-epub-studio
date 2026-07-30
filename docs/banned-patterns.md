# Banned Patterns

Patterns that are **never** acceptable in `do-epub-studio` source code.
These rules are enforced by lint, Codacy, and code review.

---

## Raw regex against untrusted input

**Never** apply a regex directly to user-supplied or EPUB-derived data.

```typescript
// BANNED
const match = userInput.match(/some-pattern+/);

// REQUIRED — use the safe wrappers from @do-epub-studio/shared
import { matchBounded, testBounded } from '@do-epub-studio/shared';
const match = matchBounded(userInput, /some-pattern+/);
```

`matchBounded` / `testBounded` enforce a length guard before the regex runs,
use bounded quantifiers, and are covered by property-based fuzz tests.
See `packages/shared/src/safe-regex.ts` and ADR-034.

---

## `any` types (unjustified)

`any` silently disables type checking and hides real bugs.

```typescript
// BANNED
function processGrant(grant: any) { ... }

// REQUIRED — use explicit types or unknow + type guard
function processGrant(grant: BookAccessGrant) { ... }
function fromApiResponse(raw: unknown): BookAccessGrant {
  return grantSchema.parse(raw);
}
```

If `any` is truly unavoidable (e.g., third-party library boundary), add an inline comment:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- epub-js v3 event payload is untyped
const payload = event.data as any;
```

---

## Unsafe EPUB HTML rendering

Never render EPUB HTML without sanitisation. Always pass content through
`sanitizeEpubDocument` (allowlist-based, not `FORBID_TAGS`-only).

```typescript
// BANNED
iframe.srcdoc = epubChapterHtml;

// REQUIRED
import { sanitizeEpubDocument } from '@do-epub-studio/reader-core';
iframe.srcdoc = sanitizeEpubDocument(epubChapterHtml);
```

EPUB content must also be rendered inside an iframe with `sandbox="allow-same-origin"` only —
never add `allow-scripts`, `allow-popups`, or `allow-forms`.

---

## Reader iframe sandbox weakening

```typescript
// BANNED
rendition.renderTo(container, { sandbox: ['allow-scripts', 'allow-same-origin'] });

// REQUIRED
rendition.renderTo(container, { sandbox: ['allow-same-origin'] });
```

Refer to `CLAUDE.md` security invariants §1–2 and `docs/security.md`.

---

## Hardcoded secrets and credentials

```typescript
// BANNED — in any source file
const SECRET = 'my-signing-secret-abc123';
const TOKEN = 'eyJhbGciOi...';

// REQUIRED — use Worker env bindings
const secret = env.SESSION_SIGNING_SECRET;
```

Secrets live in `wrangler secret put` (production) and `.dev.vars` (local dev only, never committed).

---

## Raw R2 file URLs exposed to clients

Never return or embed a direct R2 storage URL. All file access must go through a
Worker-issued short-lived signed URL.

```typescript
// BANNED
return { url: `https://pub-abc.r2.dev/${fileKey}` };

// REQUIRED
import { generateSignedUrl } from '../storage/signed-url';
return { url: await generateSignedUrl(env, bookId, fileKey) };
```

---

## Hardcoded environment-specific URLs

```typescript
// BANNED
const API = 'https://do-epub-studio.workers.dev';
const BASE = 'http://localhost:8787';

// REQUIRED — use env variables
const API = env.APP_BASE_URL;          // Worker
const API = import.meta.env.VITE_API_BASE_URL;  // Frontend
```

---

## Password hashing with weak algorithms

Only Argon2id is acceptable. bcrypt and scrypt are banned.

```typescript
// BANNED
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 10);

// REQUIRED
import { hashPassword } from '../auth/password';  // uses argon2-wasm-edge internally
const hash = await hashPassword(password);
```

---

## Bypassing the quality gate

Never skip the quality gate script:
```bash
# BANNED
git commit --no-verify
git push --force-with-lease  # without running quality gate first

# REQUIRED
./scripts/quality_gate.sh   # must be green before commit
```

---

## Single-source `.env` as main config model

Do not use a single root `.env` for both Worker and frontend configuration.

```
BANNED: .env at repo root with TURSO_AUTH_TOKEN + VITE_API_BASE_URL mixed together

REQUIRED:
  apps/worker/  → wrangler.jsonc (non-secret) + .dev.vars (local dev)
  apps/web/     → .env.local (VITE_ prefixed, browser-safe only)
  production    → wrangler secret put <KEY>
```

---

## `readFileSync` with non-literal paths in bundled files

In Vite or Node-bundled sources, prefer static imports over `readFileSync(new URL(..., import.meta.url))`.
The `new URL` pattern triggers Codacy's `security/detect-non-literal-fs-filename` rule.

```typescript
// BANNED (in Vite/bundled context)
const data = readFileSync(new URL('./data.json', import.meta.url), 'utf8');

// REQUIRED
import data from './data.json';
```

---

## Suppressing lint without justification

Disabling a lint rule without an explanation is banned.

```typescript
// BANNED
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const x: any = foo();

// REQUIRED — inline justification
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party callback, no types available
const x: any = legacyCallback();
```
