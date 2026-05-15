# @do-epub-studio/testkit

Deterministic test data builders for EPUB Studio entities. Uses the builder pattern with sensible defaults and fluent customization.

## Exports

```ts
createBookBuilder()       // Book builder
createBookFileBuilder()   // BookFile builder
createGrantBuilder()      // Grant builder
createSessionBuilder()    // Session builder
createCommentBuilder()    // Comment builder (withBody, withCfi, withParent, withResolved)
createHighlightBuilder()  // Highlight builder (withText, withCfi, withColor, withNote)
createBookmarkBuilder()   // Bookmark builder (withLabel, withLocator)
createProgressBuilder()   // Progress builder
```

## Usage

```ts
import { createCommentBuilder, createHighlightBuilder } from '@do-epub-studio/testkit';

const comment = createCommentBuilder()
  .withBody('Needs revision')
  .withCfi('epubcfi(/6/4[chap01]!/4/2/1:0)')
  .withResolved()
  .build();

const highlight = createHighlightBuilder()
  .withText('important passage')
  .withColor('#ff0000')
  .build();
```

Each builder generates a `crypto.randomUUID()` id by default so builders are ready to use without boilerplate.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test:unit` | Vitest (passWithNoTests) |
