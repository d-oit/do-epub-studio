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

### POST `/api/access/recovery-request`

Request account recovery.

### POST `/api/access/verify-recovery`

Verify a recovery code.

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

### DELETE `/api/books/:bookId/highlights/:highlightId`

Delete a highlight.

### GET `/api/books/:bookId/comments`

List comments for a book.

### POST `/api/books/:bookId/comments`

Create a comment.

### DELETE `/api/comments/:commentId`

Delete a comment.

### GET `/api/books/:bookId/bookmarks`

List bookmarks for a book.

### POST `/api/books/:bookId/bookmarks`

Create a bookmark.

### DELETE `/api/books/:bookId/bookmarks/:bookmarkId`

Delete a bookmark.

## Admin Endpoints

All admin endpoints require admin role authentication via `/api/admin/auth/login`.

### POST `/api/admin/auth/login`

Admin login with elevated credentials.

### POST `/api/admin/auth/logout`

Admin logout.

### POST `/api/admin/auth/recovery-request`

Request admin account recovery.

### POST `/api/admin/auth/recovery-verify`

Verify admin recovery code.

### POST `/api/admin/books`

Create a new book entry.

### PUT `/api/admin/books/:id/upload`

Upload EPUB file for a book.

### POST `/api/admin/books/:id/upload-complete`

Mark book upload as complete.

### DELETE `/api/admin/books/:id`

Delete a book and its associated data.

### GET `/api/admin/books/:id/grants`

List grants for a specific book.

### POST `/api/admin/books/:id/grants`

Create an access grant (invite a reader to a book).

### POST `/api/admin/grants/:id/revoke`

Revoke an access grant.

### GET `/api/admin/audit`

Query audit log entries with filters.

```json
// Query params
?entityType=book&action=create&limit=50&offset=0
```

### GET `/api/admin/stats`

Get admin dashboard statistics.

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
