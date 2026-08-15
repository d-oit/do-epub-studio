import type { Contents } from '@intity/epub-js';

/**
 * Private epub.js fields the reader deliberately reaches into but that are
 * omitted from the library's public type surface (`Book.spine`,
 * `Rendition.layout.settings`, `Rendition._contents`). Centralizing them as
 * documented intersections keeps the intentional internal access auditable
 * instead of scattering `as unknown as` casts across the reader.
 *
 * Each field is optional so a plain `as` cast (no `unknown` hop) typechecks;
 * runtime presence is guaranteed by epub.js after the book loads.
 */

/** `Book.spine` — a mutable spine view epub.js does not expose on `Book`. */
export interface EpubSpine<T> {
  each(cb: (item: T) => void): void;
}

export interface EpubBookInternals<T = unknown> {
  spine?: EpubSpine<T>;
  /** `Book.container` — 0.3.96 types it as a bare `parse`/`destroy` class. */
  container?: { fullPath?: string };
}

/**
 * `Rendition.layout.settings` (mutable layout options) and `Rendition._contents`
 * (rendered view contents). Both are internal members omitted from `Rendition`'s
 * public type.
 */
export interface EpubRenditionInternals {
  layout?: { settings?: { spread?: string } };
  _contents?: Contents[];
}
