# @do-epub-studio/worker

Cloudflare Worker API for EPUB Studio. Handles authentication, book management, reader state sync, and file serving.

## Route Groups

| Prefix | Module | Auth |
|--------|--------|------|
| `/api/access/*` | `routes/access.ts` | Public (session-based) |
| `/api/admin/*` | `routes/admin-auth.ts` | Admin credentials |
| `/api/books` | `routes/books.ts` | Session + permission check |
| `/api/books/:id/files` | `routes/files.ts` | Signed URL download |
| `/api/books/:id/progress` | `routes/reader-state.ts` | Reader session |
| `/api/books/:id/bookmarks` | `routes/reader-state.ts` | Reader session |
| `/api/books/:id/highlights` | `routes/reader-state.ts` | Reader session |
| `/api/books/:id/comments` | `routes/comments.ts` | Reader session |
| `/api/admin/grants` | `routes/admin.ts` | Admin-only |
| `/api/admin/audit` | `routes/admin.ts` | Admin-only |

## Environment Variables

See `src/lib/env.ts` for the full typed `Env` interface. Required vars include `TURSO_DB_URL`, `TURSO_AUTH_TOKEN`, `R2_BUCKET`, `JWT_SECRET`, and `COOKIE_SECRET`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | `wrangler dev` |
| `pnpm deploy` | `wrangler deploy` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test:unit` | Vitest |
