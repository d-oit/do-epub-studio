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

Purpose: implement resilient EPUB rendering, locator extraction, and annotation anchoring for `do EPUB Studio`.

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
