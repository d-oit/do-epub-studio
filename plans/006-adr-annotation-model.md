# ADR-006: Annotation Model

**Status:** Accepted  
**Date:** 2026-04-07

## Context

We need robust annotation anchoring that:
- Survives EPUB content changes
- Works with offline rendering
- Maps to visible positions accurately
- Falls back gracefully when anchors drift

**Contradiction:** #3 - Performance vs Flexibility (content parsing vs robustness)

## Decision

### Locator Strategy

Use a multi-signal locator with fallback hierarchy:

```
┌─────────────────────────────────────────┐
│            Annotation Locator            │
├─────────────────────────────────────────┤
│ 1. CFI (EPUB Canonical Fragment Id)     │
│    → Most stable EPUB-native locator    │
├─────────────────────────────────────────┤
│ 2. Selected Text Snapshot               │
│    → Exact text excerpt (50 chars min)  │
├─────────────────────────────────────────┤
│ 3. Chapter Reference                     │
│    → /toc/path#chapter                  │
├─────────────────────────────────────────┤
│ 4. DOM Position (fallback)               │
│    → elementIndex:charOffset            │
└─────────────────────────────────────────┘
```

### CFI Format

```
epubcfi(/6/4[chap01]!/4/2/1:0)
```

Components:
- Spine item path: `/6/4[chap01]`
- Content path: `!/4/2/1:0`
- Character offset: `:0`

### Re-anchoring Strategy

When CFI fails (content changed):

1. **Exact text match** → Find first occurrence
2. **Fuzzy text match** → Levenshtein distance < 3
3. **Chapter fallback** → Jump to chapter start
4. **User notification** → "Annotation may have moved"

### Anchor Schema

```typescript
interface AnnotationLocator {
  cfi?: string;           // Primary: EPUB CFI
  selectedText?: string;  // Secondary: text snapshot
  chapterRef?: string;    // Tertiary: TOC path
  elementIndex?: number;  // Fallback: DOM position
  charOffset?: number;    // Fallback: character offset
}
```

### Highlight vs Comment Anchors

| Type | Required Fields | Optional |
|------|-----------------|----------|
| Highlight | CFI or text | note, color |
| Comment | CFI or text | chapter, body, parent |
| Bookmark | CFI or chapter | label |

## Consequences

**Positive:**
- Multiple fallback signals ensure longevity
- CFI is EPUB-standard
- Text snapshots provide human verification
- Clear re-anchoring path

**Negative:**
- More storage per annotation
- Complex re-anchoring logic
- CFI parsing overhead

## Implementation Notes

- Use `epubjs` CFI utilities
- Store 50+ char text excerpts
- Implement async re-anchoring on scroll
- Show warning badge for drifted annotations

## References

- TRIZ Analysis: Contradiction #3
- Resolution: Segmentation (fallback layers), Preliminary Action
