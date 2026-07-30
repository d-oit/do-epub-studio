---
version: "1.0.0"
name: testdata-builders
description: >
  Maintain deterministic builders for schema entities. Activate when authoring
  tests, extending testkit, or adding schema fields that affect fixtures.
category: quality
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Skill: `testdata-builders`

Purpose: provide consistent factories/builders for schema entities (books, grants, sessions, annotations) to keep tests concise and deterministic.

## When to run

- Authoring or refactoring tests in Vitest/Playwright.
- Extending `packages/testkit` or seeding data for Worker integration tests.
- Adding new schema fields that affect fixtures.

## Inputs

- `packages/testkit/src/*`
- `packages/schema/migrations/*`
- `packages/shared/src/dtos.ts`

## Workflow

1. **Catalog entities** – list required builders (book, grant, session, progress, bookmark, highlight, comment).
2. **Define defaults** – choose realistic base values (locale, capability flags, timestamps) aligned with ADRs.
3. **Implement builder** – pure function returning object + `withOverrides` pattern for customization; ensure types exported.
4. **Helpers** – add `makeGrantWithCapabilities`, `makeSessionToken`, `makeAnnotationLocator` utilities.
5. **Docs** – update README within `packages/testkit` to explain builder usage.
6. **Usage** – refactor tests to import builders instead of ad-hoc inline objects.

## Checklist

- [ ] Builders updated whenever schema changes (CI should fail otherwise).
- [ ] Randomness eliminated or seeded to keep snapshots stable.
- [ ] Builders include locale + trace metadata defaults.
- [ ] Exported types re-used by Worker + Web tests.
- [ ] `packages/testkit` has unit tests covering builder edge cases.

## Examples

### Builder Pattern

Create a mock book and session in tests using `packages/testkit` factories (from `packages/testkit/src/`):

```ts
import {
  createBookBuilder,
  createSessionBuilder,
  createGrantBuilder,
  createHighlightBuilder,
} from '@do-epub-studio/testkit';

// Build a private book with a custom title
const book = createBookBuilder()
  .withTitle('My Test Novel')
  .withSlug('my-test-novel')
  .withVisibility('private')
  .build();

// Build an active session for a reader
const session = createSessionBuilder()
  .withEmail('reader@example.com')
  .withExpiry(60)   // expires 60 minutes from now
  .build();

// Build an expired session (shorthand helper)
import { createExpiredSession } from '@do-epub-studio/testkit';
const expired = createExpiredSession().build();

// Highlight annotation with custom text and CFI
const highlight = createHighlightBuilder()
  .withText('A meaningful passage')
  .withCfi('epubcfi(/6/4[chap01]!/4/2/1:0)')
  .withColor('#ffff00')
  .build();
```
