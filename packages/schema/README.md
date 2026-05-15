# @do-epub-studio/schema

Database schema types and locator utilities. Defines the canonical TypeScript types for all entities stored in Turso/D1.

## Modules

| File | Purpose |
|------|---------|
| `types.ts` | Entity interfaces (`User`, `Book`, `Grant`, `Session`, `Comment`, `Highlight`, `Bookmark`, `Progress`, `AuditLogEntry`, `SyncQueueItem`) and enums (`GlobalRole`, `BookVisibility`, `CommentStatus`, `SyncOperation`, `SyncStatus`, `EntityType`) |
| `locator.ts` | `AnnotationLocator` type and helpers: `createLocator()`, `locatorToJson()`, `locatorFromJson()`, `isValidLocator()`, `cfiToRange()`, `rangeToCfi()` |

## Migrations

Database migrations are managed via Drizzle Kit (Turso/SQLite). Run from the root:

| Command | Description |
|---------|-------------|
| `pnpm db:migrate:local` | Apply migrations to local DB |
| `pnpm db:migrate:prod` | Apply migrations to production |
| `pnpm db:check` | Validate migration state |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test:unit` | Vitest (passWithNoTests) |
