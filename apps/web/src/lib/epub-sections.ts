// epub-sections.ts — normalize the epub.js spine collection across builds.
//
// Vite resolves @intity/epub-js's ESM source, where a loaded book exposes
// `book.sections`: a Map-like Spine keyed by href whose values are the Section
// objects (`load`, `find`, `contents`, `unload`, `href`). The bundled dist
// build exposes `book.spine` with an `.each` iterator instead. Reading only
// one of the two silently disabled in-book search and chapter prefetch
// (GOAP-295 — both consumers guarded with `if (!collection) return;`), so
// every consumer normalizes through here.

interface SectionCollectionLike<T> {
  each?: (callback: (item: T) => void) => void;
  values?: () => Iterable<T>;
}

/**
 * Collect the book's spine sections from either build's collection shape.
 * Returns `[]` when the book exposes neither (callers treat that as "no
 * searchable/prefetchable sections").
 */
export function collectSpineSections<T>(book: unknown): T[] {
  const source = (book ?? {}) as { sections?: unknown; spine?: unknown };
  const candidate = source.sections ?? source.spine;
  const sections: T[] = [];
  if (!candidate) return sections;
  if (Array.isArray(candidate)) {
    sections.push(...(candidate as T[]));
    return sections;
  }
  const collection = candidate as SectionCollectionLike<T>;
  if (typeof collection.values === 'function') {
    sections.push(...collection.values());
    return sections;
  }
  if (typeof collection.each === 'function') {
    collection.each((item) => sections.push(item));
    return sections;
  }
  if (typeof (candidate as Iterable<unknown>)[Symbol.iterator] === 'function') {
    for (const entry of candidate as Iterable<unknown>) {
      // Map entries arrive as [key, section] pairs; a Set/array yields values.
      sections.push(Array.isArray(entry) && entry.length === 2 ? (entry[1] as T) : (entry as T));
    }
  }
  return sections;
}
