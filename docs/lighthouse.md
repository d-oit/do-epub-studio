# Lighthouse / LHCI

## Configuration

File: `.lighthouserc.json`

```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "staticDistDir": "./apps/web/dist"
    },
    "assert": {
      "assertions": {
        "first-contentful-paint": ["warn", { "maxNumericValue": 2000 }],
        "interactive": ["warn", { "maxNumericValue": 3500 }],
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }]
      }
    }
  }
}
```

## NO_FCP Issue

The current config collects from `staticDistDir` which serves the production build statically. Since the app is a dynamic SPA that requires an API backend for auth and EPUB loading, Lighthouse reports **NO_FCP** (No First Contentful Paint) — the page loads but shows a blank/loading state because:

1. The app needs a running Worker backend (`VITE_API_BASE_URL`) to fetch book data
2. The auth flow requires user interaction (login page or redirect)
3. No static mock data is configured for Lighthouse runs

**Impact**: Performance and accessibility assertions cannot pass in CI without a running backend.

### Resolution Options

1. **Run Lighthouse against a deployed preview URL** (not static dist): Use `--url` instead of `staticDistDir` and point to a staging environment with test data
2. **Add a static fallback page**: Create a `lighthouse.html` that renders a simple page to get FCP
3. **Serve with a mock API**: Start a minimal HTTP server that serves the built assets and stubs API responses for the login page

Until resolved, LHCI assertions are effectively blocked in CI.
