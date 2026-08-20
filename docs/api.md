# API Reference

**Base URL:** `https://api.do-epub-studio.workers.dev` (production)
**Local:** `http://localhost:8787` (Wrangler dev)

> **Note:** Route paths below reflect the actual Hono router definitions in
> `apps/worker/src/app.ts` and `apps/worker/src/routes/`. All routes are
> prefixed with `/api` in the app.

## Authentication

All authenticated endpoints require a valid session token. Tokens are issued
by the access request endpoint and managed by the client auth store.

### POST `/api/access/request`

Authenticate a user and receive a session token.

```json
// Request
{ "email": "user@example.com", "password": "..." }

// Response (200)
{ "ok": true, "data": { "token": "...", "user": { "id": "...", "email": "...", "role": "reader" } } }
```

### POST `/api/access/logout`

Invalidate the current session. Requires authentication.

### POST `/api/access/refresh`

Refresh an existing session token.

### GET `/api/access/validate`

Validate a session token (query parameter).

### GET `/api/access/validate-all`

Validate all stored session tokens for the authenticated user.

### POST `/api/access/recovery-request`

Request account recovery (per-email + per-IP rate limited, ADR-232).

### POST `/api/access/verify-recovery`

Verify a recovery code.

## Catalog Endpoints

### GET `/api/catalog`

Public — no auth required. Lists books with `visibility='public'`, with edge caching (ADR-112b).

```
?q=&author=&language=&limit=&offset=
```

## Reader Endpoints

All reader endpoints require authentication and an active book grant.

### GET `/api/books`

List books the authenticated user has access to.

### GET `/api/books/:id`

Get book metadata and EPUB download URL.

### POST `/api/books/:id/file-url`

Generate a signed URL for the EPUB file.

### GET `/api/books/:bookId/progress`

Get reading progress for the authenticated user.

### PUT `/api/books/:bookId/progress`

Update reading progress.

```json
{ "cfi": "epubcfi(/6/14!/4/2)", "percentage": 42.5 }
```

### GET `/api/books/:bookId/highlights`

List highlights for a book.

### POST `/api/books/:bookId/highlights`

Create a highlight.

### PATCH `/api/books/:bookId/highlights/:highlightId`

Update a highlight (e.g. color, note).

### DELETE `/api/books/:bookId/highlights/:highlightId`

Delete a highlight.

### GET `/api/books/:bookId/comments`

List comments for a book.

### POST `/api/books/:bookId/comments`

Create a comment (or a reply when `parentCommentId` is set).

### PATCH `/api/comments/:commentId`

Update a comment body.

### DELETE `/api/comments/:commentId`

Delete a comment.

### GET `/api/books/:bookId/bookmarks`

List bookmarks for a book.

### POST `/api/books/:bookId/bookmarks`

Create a bookmark.

### DELETE `/api/books/:bookId/bookmarks/:bookmarkId`

Delete a bookmark.

### GET `/api/books/:bookId/insights`

Get reading insights for a book (active reading time, pages/day, streak, ETA).

### GET `/api/books/:bookId/search`

Full-text search within a book using FTS5 (BM25 ranking). Falls back to an
empty result set when the book is not indexed.

```
?q=&limit=&offset=
```

### GET `/api/books/:bookId/export`

Export the authenticated user's annotations (highlights, comments, bookmarks)
as Markdown or HTML.

```
?format=markdown|html
```

## Notifications Endpoints

### GET `/api/notifications`

List notifications for the authenticated user.

```
?limit=&offset=&unread=true
```

### GET `/api/notifications/unread-count`

Get the unread notification count.

### POST `/api/notifications/read-all`

Mark all notifications as read.

### POST `/api/notifications/:id/read`

Mark a single notification as read.

## Demo Endpoints

Demo login is gated on server-side flags per ADR-233/244 and fails closed in
production-like environments. No plaintext credentials are ever shipped in
client code.

### POST `/api/demo/reader-login`

Mint a reader session for the configured demo account + demo book grant.

### POST `/api/demo/admin-login`

Mint an admin session for the configured demo admin (local/preview only).

## Admin Endpoints

All admin endpoints require admin role authentication via `/api/admin/auth/login`.

### POST `/api/admin/auth/login`

Admin login with elevated credentials. MFA-capable:

- `POST /api/admin/auth/login/mfa/start` — begin MFA challenge
- `POST /api/admin/auth/login/mfa/verify` — verify MFA challenge
- `POST /api/admin/auth/login/mfa/recovery-verify` — verify with recovery code

### POST `/api/admin/auth/logout`

Admin logout.

### POST `/api/admin/auth/recovery-request`

Request admin account recovery.

### POST `/api/admin/auth/recovery-verify`

Verify admin recovery code.

## Account & MFA Endpoints (admin, step-up gated)

Sensitive mutations require a fresh step-up verification (ADR-234):

- `POST /api/admin/account/password-change` — change password
- `GET /api/admin/account/sessions` — list active sessions
- `POST /api/admin/account/logout-all` — revoke all sessions
- `POST /api/admin/account/step-up` — begin step-up verification
- `GET /api/admin/account/mfa/status` — MFA enrollment status
- `POST /api/admin/account/mfa/register-start` / `register-verify` — enroll a passkey
- `POST /api/admin/account/mfa/authenticate-start` / `authenticate-verify` — authenticate with passkey
- `DELETE /api/admin/account/mfa/passkey/:id` — remove a passkey
- `POST /api/admin/account/mfa/recovery-codes/regenerate` — rotate recovery codes

## Admin Book & Grant Endpoints

### POST `/api/admin/books`

Create a new book entry.

### PATCH `/api/admin/books/:id`

Update book metadata (title, author, description, visibility, etc.).

### PUT `/api/admin/books/:id/upload`

Upload EPUB file for a book (step-up required).

### POST `/api/admin/books/:id/upload-complete`

Mark book upload as complete (step-up required).

### DELETE `/api/admin/books/:id`

Delete a book and its associated data (step-up required).

### GET `/api/admin/books/:id/grants`

List grants for a specific book.

### POST `/api/admin/books/:id/grants`

Create an access grant (invite a reader to a book, step-up required).

### PATCH `/api/admin/grants/:id`

Update a grant (step-up required).

### POST `/api/admin/grants/:id/revoke`

Revoke an access grant (step-up required).

## Admin Analytics Endpoints

### GET `/api/admin/audit`

Query audit log entries with filters.

```json
// Query params
?entityType=book&action=create&limit=50&offset=0
```

### GET `/api/admin/stats`

Get admin dashboard statistics.

### GET `/api/admin/insights`

Admin-level reading insights across the catalog.

## Observability Endpoints

### POST `/api/telemetry`

Ingest client telemetry (scrubbed, persisted to `telemetry_events`, ADR-105b).

### POST `/api/csp-report`

Receive CSP violation reports (Content-Security-Policy-Report-Only / report-uri).

## Sync Endpoints

### POST `/api/books/:bookId/insights/sync`

Sync offline reading insights for a book. Used by the offline sync queue
to flush locally-captured reading data when back online.

## Error Responses

All endpoints return standard error shapes:

```json
{ "ok": false, "error": { "code": "UNAUTHORIZED", "message": "Invalid or expired session", "traceId": "trc_..." } }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — invalid input |
| 401 | Unauthorized — missing or invalid token |
| 403 | Forbidden — insufficient permissions |
| 404 | Not found |
| 429 | Rate limited — retry after `Retry-After` header |
| 500 | Internal server error — check `traceId` |

## Rate Limiting

API requests are rate-limited per session via Durable Objects. The
`Retry-After` header indicates when to retry on429 responses.

## References

- Coding guide §20 — Reader controls and data flow
- `apps/worker/src/routes/` — Route handler source
- `packages/schema/src/schemas.ts` — Zod schemas for request/response validation
