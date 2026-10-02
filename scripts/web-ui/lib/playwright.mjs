// playwright.mjs — Chromium resolver shared by the web-ui pack runners.
//
// This workspace declares `@playwright/test`, which re-exports the same
// `chromium` handle as the bare `playwright` package; the bare name is not a
// dependency here. Both candidates are tried so the pack still works when
// vendored into a workspace that depends on bare `playwright`.
//
// F2 (GOAP-290): before this helper every runner imported the bare name only,
// so a configured run printed `SKIP: playwright is not installed in this
// workspace` and exited 0 without ever touching a browser.

/**
 * Resolve a Chromium driver, trying `@playwright/test` before `playwright`.
 * @returns {Promise<import('playwright').BrowserType | null>}
 */
export async function loadChromium() {
  for (const specifier of ['@playwright/test', 'playwright']) {
    try {
      const resolved = await import(specifier);
      if (resolved?.chromium) return resolved.chromium;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}
