# Performance & Budget Validation

## Budget Constraints

Frontend changes must conform to the defined performance thresholds:

- **`.performance-budgets.json`**: Specifies maximum allowable asset sizes and bundle metrics per route/chunk.
- **`bundle-baseline.json`**: Tracks baseline bundle sizes across builds.
- **Lighthouse CI**: Enforces route-specific performance budgets (catalog, admin, auth, offline routes).

## Validation Rules

1. **No Direct Asset Inflation**: Avoid importing heavy 3rd-party dependencies (e.g. Framer Motion, Lodash, large icon sets) when native CSS/JS utilities exist.
2. **Virtualization**: Any dynamic list rendering more than 50 items must use list virtualization (`VirtualList`).
3. **Optimized Traversal**: Perform DOM traversals and text scanning with native TreeWalker / String methods to avoid runtime overhead.
4. **Verification**: After significant UI changes, run `./scripts/check-bundle-budget.mjs` or `pnpm build` to ensure bundle baselines remain within budget limits.
