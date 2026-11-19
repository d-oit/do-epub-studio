/**
 * Reader page width classes shared by the reader page and the author previews.
 * The map keys mirror the `reader.pageWidth` preference values.
 */
export const READER_PAGE_WIDTH_CLASSES: Record<'narrow' | 'normal' | 'wide' | 'full', string> = {
  narrow: 'max-w-xl',
  normal: 'max-w-3xl',
  wide: 'max-w-5xl',
  full: 'max-w-full',
};
