# Performance Budgets

This document defines the target metrics for the `do-epub-studio` project to ensure a high-quality experience for both users and developers.

## User Experience Budgets

These metrics directly impact the perceived performance for readers.

| Metric | Target | Rationale |
| :--- | :--- | :--- |
| **First Contentful Paint (FCP)** | < 1.5s | Ensures the reader feels responsive on initial load. |
| **Reader Startup (Interactive)** | < 2.5s | Time from navigation to the EPUB being rendered and interactive. |
| **Main Bundle Size (JS)** | < 500 KB | Keep the initial JS payload small for fast parsing. |
| **Vendor Bundle Size (JS)** | < 400 KB | Ensure dependencies don't bloat the application. |
| **Main CSS Size** | < 100 KB | Critical path CSS should be minimal. |

## Developer Experience Budgets

These metrics ensure the development workflow remains fast and efficient.

| Metric | Target | Rationale |
| :--- | :--- | :--- |
| **CI Full Pipeline Duration** | < 15 min | Fast feedback loop for PRs. |
| **Unit Test Suite Duration** | < 3 min | Quick local and CI verification. |
| **Pnpm Cache Hit Rate** | > 80% | Minimize time spent downloading dependencies. |

## Enforcement

- **Bundle Size**: Checked on every PR via `scripts/check-bundle-size.mjs`.
- **Startup Performance**: Measured via Playwright performance tests.
- **CI Duration**: Tracked and reported in the CI summary.
- **Lighthouse**: Enforced via `.lighthouserc.json` in the Lighthouse CI workflow.
