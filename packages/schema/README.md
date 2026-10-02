# @do-epub-studio/schema

Database schema types and locator utilities. Defines the canonical TypeScript types for all entities stored in Cloudflare D1.

## Modules

| File         | Purpose                                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`   | Entity interfaces (`User`, `Book`, `Grant`, `Session`, `Comment`, `Highlight`, `Bookmark`, `Progress`, `AuditLogEntry`, `SyncQueueItem`) and enums (`GlobalRole`, `BookVisibility`, `CommentStatus`, `SyncOperation`, `SyncStatus`, `EntityType`) |
| `locator.ts` | `AnnotationLocator` type and helpers: `createLocator()`, `locatorToJson()`, `locatorFromJson()`, `isValidLocator()`, `cfiToRange()`, `rangeToCfi()`                                                                                               |

## Migrations

SQL migrations live in `migrations/` and are applied with Wrangler D1 (see
`docs/setup-local.md` §4). Run from the root:

| Command                 | Description                            |
| ----------------------- | -------------------------------------- |
| `pnpm db:migrate:local` | Apply migrations to the local D1 state |
| `pnpm db:check`         | List applied/pending local migrations  |

Production migrations are an operator action documented in
`docs/runbooks/infrastructure-setup.md`.

## Scripts

| Command          | Description              |
| ---------------- | ------------------------ |
| `pnpm typecheck` | `tsc --noEmit`           |
| `pnpm lint`      | ESLint                   |
| `pnpm test:unit` | Vitest (passWithNoTests) |
