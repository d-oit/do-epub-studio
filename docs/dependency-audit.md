# Dependency Audit

## Version Targets vs Current

| Package | Current | Target | Status |
|---------|---------|--------|--------|
| `typescript` | ^6.0.3 | 6.0.3 | ✅ At target |
| `vitest` | 4.1.5 | 4.1.5 | ✅ At target |
| `prettier` | ^3.8.3 | 3.8.3 | ✅ At target |
| `eslint` | ^9.0.0 | 9.x latest | ✅ At target |
| `typescript-eslint` | ^8.59.3 | 8.59.3 | ✅ At target |

## Per-Package Breakdown

### Root (`/package.json`)

| Dependency | Version |
|-----------|---------|
| @axe-core/playwright | ^4.11.3 |
| @eslint/js | ^9.0.0 |
| @lhci/cli | ^0.15.1 |
| @playwright/test | ^1.60.0 |
| @types/node | ^25 |
| @vitest/coverage-v8 | 4.1.6 |
| vitest | 4.1.5 |
| eslint | ^9.0.0 |
| eslint-config-prettier | ^10.1.8 |
| eslint-import-resolver-typescript | ^4.4.4 |
| eslint-plugin-import | ^2.29.1 |
| eslint-plugin-jsx-a11y | ^6.8.0 |
| eslint-plugin-promise | ^7.3.0 |
| eslint-plugin-react | ^7.34.1 |
| eslint-plugin-react-hooks | ^7.0.1 |
| eslint-plugin-security | ^4.0.0 |
| eslint-plugin-unicorn | ^64.0.0 |
| globals | ^17.6.0 |
| jsdom | ^29.1.1 |
| prettier | ^3.8.3 |
| rollup-plugin-visualizer | ^7.0.1 |
| turbo | ^2.9.12 |
| typescript | ^6.0.3 |
| typescript-eslint | ^8.59.3 |

### apps/web

| Dependency | Version |
|-----------|---------|
| @intity/epub-js | ^0.3.96 |
| framer-motion | ^12 |
| idb | ^8.0.3 |
| react | ^19 |
| react-dom | ^19 |
| react-router-dom | ^7 |
| uuid | ^14.0.0 |
| workbox-* | ^7.4.1 |
| zod | ^4.4.3 |
| zustand | ^5 |
| vite | 8.0.12 |
| tailwindcss | ^4.3.0 |
| @tailwindcss/vite | ^4.3.0 |
| vitest | 4.1.5 |
| @vitejs/plugin-react | ^6 |
| @vitest/coverage-v8 | 4.1.6 |

### apps/worker

| Dependency | Version |
|-----------|---------|
| @libsql/client | ^0.17.3 |
| argon2-wasm-edge | ^1.0.23 |
| zod | ^4.4.3 |
| vitest | 4.1.5 |
| wrangler | ^4.90.1 |
| @cloudflare/workers-types | ^4.20260511.1 |

### packages/reader-core

| Dependency | Version |
|-----------|---------|
| @intity/epub-js | ^0.3.96 |
| fast-check | ^4.8.0 |
| vitest | 4.1.5 |

### packages/shared

| Dependency | Version |
|-----------|---------|
| zod | ^4.4.3 |
| fast-check | ^4.8.0 |
| vitest | ^4.1.5 |

### packages/ui

| Dependency | Version |
|-----------|---------|
| react | ^19 (peer) |
| react-dom | ^19 (peer) |

## Notes

- All target versions are already met across all packages
- `@vitest/coverage-v8` at 4.1.6 is 1 patch ahead of `vitest` at 4.1.5 — this is compatible
- `typescript` uses caret `^6.0.3` in root and all packages which pins to 6.x
- `vitest` uses exact `4.1.5` in most places but `^4.1.5` in shared — minor difference, same effective version
- `@types/node` varies: `^25` in most packages, `^22.13.1` in shared — consider aligning
- `zod` consistently at `^4.4.3` across all packages
- No outdated or conflicting transitive dependencies detected
