# @do-epub-studio/shared

Shared validation schemas, DTOs, error types, and telemetry utilities used across all apps and packages.

## Modules

| File | Purpose |
|------|---------|
| `schemas.ts` | Zod 4 schemas (`BookVisibility`, `GrantMode`, `GlobalRole`, `SyncOperation`, `SyncStatus`, `EntityType`, `CommentStatus`, etc.) |
| `dtos.ts` | API response types (`ApiResponse<T>`, `BookResponse`, `AccessResponse`, `ReaderCapabilities`, `ReaderStateResponse`) |
| `errors.ts` | Error hierarchy: `AppError` base -> `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `RateLimitError` |
| `telemetry.ts` | `createTraceId()`, `TRACE_HEADER`, `SPAN_HEADER`, `SerializedError` — lightweight distributed tracing primitives |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm test:unit` | Vitest |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
