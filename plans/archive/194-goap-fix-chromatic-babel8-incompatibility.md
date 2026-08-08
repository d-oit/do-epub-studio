# Plan 194: GOAP — Fix Chromatic Visual Regression (Babel 8 Incompatibility)

**Status:** ✅ COMPLETED
**Date:** 2026-07-16
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Strategy:** Sequential — dependency fix then verification
**Completed:** 2026-07-16

## Problem

The `visual-regression.yml` workflow fails with:

```
Error: Starting from Babel 8.0.0, the 'loadPartialConfig' function
expects a callback. If you need to call it synchronously, please use
'loadPartialConfigSync'.
```

This is caused by Storybook 10.5.0's `react-docgen-plugin` calling
`@babel/core`'s `loadPartialConfig` synchronously, but Babel 8.0.0
changed this function to require a callback.

## Fix

Configure Storybook to use `react-docgen-typescript` instead of the
default `react-docgen` parser, avoiding the Babel 8 incompatibility:

```ts
// packages/ui/.storybook/main.ts
typescript: {
  reactDocgen: 'react-docgen-typescript',
},
```

This approach:
- Keeps `@babel/core >= 7.29.6` (no version cap needed)
- Avoids visual baseline changes in Chromatic
- Maintains prop documentation via TypeScript types

## Acceptance Criteria

- [x] `pnpm build:storybook` succeeds with Babel 8
- [x] `pnpm build` succeeds
- [x] Chromatic visual regression workflow passes
- [x] No visual baseline changes (same Babel version as before)
- [x] Prop documentation still generated via react-docgen-typescript

## Evidence

| Check | Status | Evidence |
|-------|--------|----------|
| Storybook build | ✅ | `pnpm --filter @do-epub-studio/ui build:storybook` — completed successfully |
| Web build | ✅ | `pnpm build` — 2 tasks successful |
| Typecheck | ✅ | `pnpm typecheck` — 7/7 packages |
| Config fix | ✅ | `packages/ui/.storybook/main.ts` — `reactDocgen: 'react-docgen-typescript'` |
