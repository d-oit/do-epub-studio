/**
 * Lighthouse auth fixture for reader route.
 *
 * Seeds the preview env by:
 * 1. Mocking API routes for the test book
 * 2. Setting localStorage auth state
 * 3. Navigating to /read/test-book
 *
 * Used by .lighthouserc.json puppeteerScript for reader Lighthouse audits.
 *
 * NOTE: This script is invoked by Lighthouse CI for EVERY URL in the
 * config. Non-reader URLs (/, /catalog, /login, /admin) are unaffected
 * because the mocks only intercept reader-specific API paths and the
 * navigation only happens for /read/* routes.
 */

const TEST_BOOK_SLUG = 'test-book';
const MOCK_SESSION_TOKEN = 'lighthouse-test-token';
const MOCK_EMAIL = 'lighthouse@test.example.com';

// Minimal EPUB mock — just enough for the reader to render the shell.
const MOCK_EPUB_BASE64 =
  'UEsDBBQAAAAAAAAAAABvYassFAAAABQAAAAIAAAAbWltZXR5cGVhcHBsaWNhdGlvbi9lcHViK3ppcFBLAwQUAAAACAAAAAAAHgvXyZkAAADdAAAAFgAAAE1FVEEtSU5GL2NvbnRhaW5lci54bWxVjcEKwjAQRH8l5Cpt9BqSFATPCn7Bmm41mOyGJJX696KHqreBmffGDEuK4oGlBiYrd/1WDs54pgaBsPw3YkmRqpVzIc1QQ9UECatuXnNGGtnPCanpz0yvEulMYW5TiFi/UUxzjF2GdrPyeNifzuoNILWe8yRFwjFA154ZrYScY/DQApNivOTaZfB3uOJmSVEqZ9SPX62/7gVQSwMEFAAAAAgAAAAAAPXxf7D4AAAAzwEAABEAAABPRUJQUy9jb250ZW50Lm9wZo2RQW6EMAxFrxJlW00M7aLSKGQu0QtExIDVJGQSM9DbV8BAZ9md7e///CXr2xK8eGAuNMZG1qqSN6OTbb9tj2IJPpZGDszpCjDPsyKXOjXmHt6r6hPG1Mk/84eqpJgi3Se8kMPI1BHmRpKTRgdk6yzbnXl17YlNU/Yb0rWAHgNGLlCrGqTRrr0ysUfzhYU1nO0qeBv7yfZoMG7K2Ws4jhkdbKQOCxtNjEGQa2S0DymGjN1WqmXg4KUI6Mhe+CdhI21KnlrLNEbY5LdlXUl5TJiZsOwQeIGW+mCW+v9IWLOeCUuiiDszYyfIHRmPSy/TUm/mpwWeDzO/UEsDBBQAAAAIAAAAAABKBnYEvAAAAAQBAAAPAAAAT0VCUFMvbmF2LnhodG1sVY+xbsMwDER/RdUHmFYzFDZoenCzphm6dFRiJTIgS4LF2M7fB4qmLsQB9+7Aw36fnVjNkqbgO6mqWvaEH98/w+/f+Sgsz44wX7HPzqdOWubYAmzbVm2HKix3UE3TwJ4ZWaDWxMflHzmN8fZmP+v6C0JMktAaPRLyxM7QSa8IRSIU4xLGJ6HXq8htLT+j6SSHa04qGoJn4zkhWEUYHKGbCLWwi7l1Mqmq/EODVQiaELINmQOvV0Io9fDe9wJQSwMEFAAAAAgAAAAAAKhlgTp9AAAAlQAAAA4AAABPRUJQUy9zMS54aHRtbCWNOw7CMBAFr2J8AC8WVdBmUyTUUKShBGLhSP4pXmFzexTcjJ40TxocqnfiY7a8xtBLrY5yIDxM13G+3y7CsneEO0X1LuReWuZ0BiilqHJScXuD7roO6v6RhNY8FkJe2RkarUZoE6GJZ1y+hIlmk1m8YmATGCERQjPwD/4AUEsBAhQAFAAAAAAAAAAAAG9hqywUAAAAFAAAAAgAAAAAAAAAAAAAAAAAAAAAAG1pbWV0eXBlUEsBAhQAFAAAAAgAAAAAAB4L18mZAAAA3QAAABYAAAAAAAAAAAAAAAAAOgAAAE1FVEEtSU5GL2NvbnRhaW5lci54bWxQSwECFAAUAAAACAAAAAAA9fF/sPgAAADPAQAAEQAAAAAAAAAAAAAAAAAHAQAAT0VCUFMvY29udGVudC5vcGZQSwECFAAUAAAACAAAAAAASgZ2BLwAAAAEAQAADwAAAAAAAAAAAAAAAAAuAgAAT0VCUFMvbmF2LnhodG1sUEsBAhQAFAAAAAgAAAAAAKhlgTp9AAAAlQAAAA4AAAAAAAAAAAAAAAAAFwMAAE9FQlBTL3MxLnhodG1sUEsFBgAAAAAFAAUAMgEAAMADAAAAAA==';

/**
 * @param {import('puppeteer').Page} page
 * @param {{ url: string }} context — URL Lighthouse is about to collect
 */
export default async function main(page, { url }) {
  // Only apply reader fixture for /read/* routes
  if (!url.includes('/read/')) {
    return;
  }

  // 1. Mock API responses before navigation
  await page.setRequestInterception(true);

  page.on('request', (req) => {
    const reqUrl = req.url();

    if (reqUrl.includes(`/api/books/${TEST_BOOK_SLUG}/file-url`)) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { url: `/books/${TEST_BOOK_SLUG}.epub` },
        }),
      });
      return;
    }

    if (reqUrl.includes(`/books/${TEST_BOOK_SLUG}.epub`)) {
      req.respond({
        status: 200,
        contentType: 'application/epub+zip',
        body: Buffer.from(MOCK_EPUB_BASE64, 'base64'),
      });
      return;
    }

    if (reqUrl.includes(`/api/books/${TEST_BOOK_SLUG}/highlights`)) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [] }),
      });
      return;
    }

    if (reqUrl.includes(`/api/books/${TEST_BOOK_SLUG}/comments`)) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [] }),
      });
      return;
    }

    if (reqUrl.includes(`/api/books/${TEST_BOOK_SLUG}/progress`)) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { progressPercent: 0 } }),
      });
      return;
    }

    req.continue();
  });

  // 2. Seed localStorage auth state before navigation
  await page.evaluateOnNewDocument((args) => {
    const authState = {
      state: {
        sessionToken: args.token,
        bookId: args.slug,
        bookSlug: args.slug,
        bookTitle: 'Lighthouse Test Book',
        email: args.email,
        capabilities: {
          canRead: true,
          canComment: true,
          canHighlight: true,
          canBookmark: true,
          canDownloadOffline: true,
          canExportNotes: true,
          canManageAccess: false,
        },
        isAuthenticated: true,
        isAdmin: false,
      },
      version: 0,
    };
    window.localStorage.setItem('do-epub-auth', JSON.stringify(authState));
  }, {
    token: MOCK_SESSION_TOKEN,
    slug: TEST_BOOK_SLUG,
    email: MOCK_EMAIL,
  });

  // 3. Navigate to the reader route
  await page.goto(url, {
    waitUntil: 'networkidle2',
  });
}
