/**
 * Service Worker Configuration
 * Defines cache names and versioning for offline storage.
 */

export const CACHE_PREFIX = 'do-epub-';
export const CACHE_VERSION = 'v1';
export const FULL_PREFIX = `${CACHE_PREFIX}${CACHE_VERSION}-`;

export const CACHE_NAMES = {
  googleFontsStylesheets: `${FULL_PREFIX}google-fonts-stylesheets`,
  googleFontsWebfonts: `${FULL_PREFIX}google-fonts-webfonts`,
  images: `${FULL_PREFIX}images`,
  epubFiles: `${FULL_PREFIX}epub-files`,
  apiResponses: `${FULL_PREFIX}api-responses`,
} as const;

/**
 * List of all active cache names for verification
 */
export const ALL_CACHES = Object.values(CACHE_NAMES);
