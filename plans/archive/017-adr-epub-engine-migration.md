# ADR-017: EPUB Reader Engine Migration — futurepress/epub.js → intity/epub-js

**Status:** Accepted
**Date:** 2026-05-13
**Issue:** #128 (migration), #140 (follow-up optimization)

---

## Context

d.o. EPUB Studio requires a browser-based EPUB rendering engine for its reader application. The project originally used `futurepress/epub.js` (npm package `epubjs`). As of mid-2026, the upstream project's latest release is dated, the surrounding toolchain is deprecated, and the package contains a transitive `@xmldom/xmldom` vulnerability.

The `intity/epub-js` fork was created to address deprecated APIs and architectural issues in the original implementation. It documents active maintenance, supports multiple render managers (`default`, `continuous`), flow modes (`paginated`, `scrolled`, `scrolled-doc`), and hooks for content injection.

---

## Decision

Replace `futurepress/epub.js` with `intity/epub-js` across all packages, mediated by a thin adapter layer (`packages/reader-core/src/epub-loader.ts`) that isolates third-party types and API differences from application code.

---

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Keep `futurepress/epub.js` | No migration effort | Unmaintained; known vulnerability; deprecated APIs |
| Migrate to `intity/epub-js` | Actively maintained fork; same domain; API compatible at core | Introduces breaking API changes requiring adapter |
| Switch to `foliate-js` | Modern, standards-based | Full architectural rewrite; different rendering model; out of scope for this sprint |
| Switch to server-side EPUB render | Removes client dependency | Major UX change; loses offline reading |

**Decision:** Option 2 — `intity/epub-js` with adapter layer.

---

## Adapter Boundary

The adapter is `packages/reader-core/src/epub-loader.ts`. It exposes:

```typescript
interface EpubLoader {
  load(url: string): Promise<void>;
  createRendition(container: HTMLElement): EpubRenditionHandle;
  destroy(): void;
  getMetadata(): BookMetadata;
  getToc(): TocItem[];
  getSpineItems(): SpineItem[];
  getProgress(): ProgressPosition | null;
  setProgress(cfi: string): Promise<void>;
  on(event: string, callback: EventCallback): void;
  off(event: string, callback: EventCallback): void;
  rendition: EpubRenditionHandle | null;
}
```

Application code must never import directly from `@intity/epub-js`. All access goes through this interface.

---

## Known API Incompatibilities

| Area | futurepress behavior | intity/epub-js behavior |
|------|---------------------|------------------------|
| Render options | `method` param for flow | `flow` + `manager` params |
| Spread | `spread: 'auto'` | Same, but requires explicit manager |
| Contents access | `rendition.getContents()` single object | Same but typed differently |
| Hook registration | `rendition.hooks.content.register()` | Same API, timing may differ |
| Location format | `location.start.cfi` | Same structure |
| Destroy | `book.destroy()` | Same; rendition must be destroyed first |

---

## Consequences

### Positive
- Removes `@xmldom/xmldom` CVE exposure in the old package version
- Active maintenance means future bug fixes are available
- Same core API reduces migration risk
- Adapter layer future-proofs against further engine changes

### Negative / Risks
- Annotation anchor timing may differ; content hook timing must be validated
- Render lifecycle differences may affect highlight injection
- `intity/epub-js` typings may be incomplete; requires `@ts-expect-error` or type augmentation in edge cases

### Follow-up Required (see issue #140)
- Expose `flow` and `manager` options via adapter
- Add `registerContentHook` and `registerRenderHook` to `EpubRenditionHandle`
- Type `getContents()` with `Contents` type from library
- Add full unit test coverage for `epub-loader.ts`
- Add post-migration Playwright smoke test

---

## References

- Issue #128 — Migration task
- Issue #140 — Post-migration optimization sprint
- `packages/reader-core/src/epub-loader.ts` — Adapter implementation
- `plans/006-adr-annotation-model.md` — Annotation anchoring model
- `plans/005-adr-offline-sync.md` — Offline reading architecture
