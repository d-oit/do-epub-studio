---
version: "1.0.0"
name: epub-rendering-and-cfi
description: >
  Implement resilient EPUB rendering and annotation anchoring per ADR-006.
  Activate for reader-core, TOC, locator, or highlight anchoring changes.
category: workflow
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Skill: `epub-rendering-and-cfi`

Purpose: implement resilient EPUB rendering, locator extraction, and annotation anchoring for `d.o.EPUB Studio`.

## When to run

- Integrating EPUB.js or reader-core changes.
- Working on TOC, locator, or highlight/comment anchoring logic.
- Debugging annotation drift or EPUB loading regressions.

## Inputs

- `plans/006-adr-annotation-model.md`
- `packages/reader-core/*`
- EPUB sample assets (if needed)

## Workflow

1. **Read ADR + data model** – confirm multi-signal locator requirements (CFI + text + chapter + DOM fallback).
2. **Design anchors** – map DOM selections → `{ cfi, selectedText, chapterRef, elementIndex, charOffset }`.
3. **Implement** – use EPUB.js APIs (`rendition.annotations`, `book.getToc()`, `book.locations.generate()`), ensure async cleanup.
4. **Resilience** – add re-anchoring strategy (exact match → fuzzy text → chapter fallback → user notice).
5. **Performance** – lazy-load EPUB assets, reuse single rendition, clean up listeners to avoid leaks.
6. **Testing** – add Vitest cases for locator serialization + re-anchor helpers; capture regressions with reader-core testkit.

## Checklist

- [ ] CFI + text excerpt + chapterRef persisted together.
- [ ] Anchor serialization uses stable casing + schema from `packages/shared`.
- [ ] Re-anchoring warns user when falling back.
- [ ] EPUB.js event handlers removed on unmount.
- [ ] Telemetry events logged for load failures with `traceId`.
- [ ] Fuzzy re-anchoring word extraction uses `matchAllBounded` from `@do-epub-studio/shared`.

## Examples

### CFI Navigation

`EpubLoader.setProgress` calls `rendition.display(cfi)` internally; navigate by calling the handle directly (from `packages/reader-core/src/epub-loader.ts`):

```ts
const loader = createEpubLoader({ flow: 'paginated' });
await loader.load(epubUrl);
const handle = loader.createRendition(containerEl);

// Jump to a saved CFI position
await handle.display('epubcfi(/6/4[chap01]!/4/2/1:0)');

// Listen for position changes (fired after each display/page-turn)
loader.on('relocated', (progress) => {
  const { cfi, percentage } = progress as ProgressPosition;
  store.setProgress(cfi, percentage);
});
```

### Sanitization Guard

Every rendition MUST register `createEpubSanitizerHook` before display (from `packages/reader-core/src/epub-loader.ts` + `sanitizer.ts`):

```ts
import { createEpubSanitizerHook } from './sanitizer';

// Registered automatically inside createEpubLoader → createRenditionHandle:
rendition.hooks.content.register(createEpubSanitizerHook());

// sanitizeEpubDocument uses EPUB_ALLOWED_TAGS (allowlist, not FORBID_TAGS-only)
// and enforces href-scheme + event-attribute rules via sanitizeDom().
// Never bypass this hook — iframe sandbox is allow-same-origin only.
```

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "A CFI is stable — persisting it alone is enough to re-anchor a highlight." | ADR-006 requires multi-signal locators. Persist `{ cfi, selectedText, chapterRef, elementIndex, charOffset }` together; CFIs shift on re-pagination and font changes. |
| "The sanitizer strips content the book needs, so I'll skip `createEpubSanitizerHook` here." | Every rendition MUST register the hook before display. `sanitizeEpubDocument` uses the `EPUB_ALLOWED_TAGS` allowlist and the iframe sandbox is `allow-same-origin` only — extend the allowlist instead of bypassing. |
| "Fuzzy re-anchoring can split the excerpt on whitespace with a regex." | Use `matchAllBounded` from `@do-epub-studio/shared` for fuzzy word extraction; ad-hoc regex over book text is the unbounded-match failure mode. |
| "`loader.setProgress` is the navigation API, so I'll call it from the component." | `setProgress` calls `rendition.display(cfi)` internally. Call the rendition handle directly, or you navigate twice. |
| "Silently falling back to the chapter start is acceptable UX." | Re-anchoring must warn the user when it falls back (exact → fuzzy → chapter → notice); silent jumps are the annotation-drift bug. |

## Red Flags

- [ ] A highlight record persists `cfi` without `selectedText` and `chapterRef` alongside it.
- [ ] `rendition.hooks.content.register(createEpubSanitizerHook())` is absent before `rendition.display(...)`.
- [ ] A new `createRendition` per re-render instead of reusing one rendition handle.
- [ ] `loader.on('relocated', ...)` handlers registered with no matching removal on unmount.
- [ ] Chapter fallback fires with no user notice and no telemetry event carrying `traceId`.
- [ ] Hand-rolled regex word extraction for fuzzy matching instead of `matchAllBounded`.
