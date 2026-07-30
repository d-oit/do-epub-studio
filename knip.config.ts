import type { KnipConfig } from 'knip';

/**
 * Knip configuration for dead-code and unused-dependency detection.
 *
 * Baseline suppressions (pre-existing issues as of Wave 6-A) are grouped
 * with comments so they can be cleaned up incrementally.
 *
 * Rules:
 *  - files / dependencies / unlisted → 'error'  (blocks CI)
 *  - exports / types / duplicates    → 'warn'   (reported, never blocks)
 *    Rationale: large pre-existing export-surface backlog; warn-only lets
 *    the gate pass today while still surfacing new dead exports in reports.
 */

const config: KnipConfig = {
  // ------------------------------------------------------------------ rules
  rules: {
    files: 'error',
    dependencies: 'error',
    devDependencies: 'error',
    unlisted: 'error',
    binaries: 'error',
    exports: 'warn',
    types: 'warn',
    enumMembers: 'warn',
    duplicates: 'warn',
  },

  // Exports that are also referenced in the same file (e.g. DEFAULT_EXPIRY_DAYS
  // used inside the same module it is exported from) are not dead code.
  ignoreExportsUsedInFile: true,

  // vitest.workspace.ts causes a fatal load error because knip imports it
  // and defineWorkspace is not available in that context (known knip issue).
  // We ignore it globally so individual workspace vitest configs are still found.
  ignoreFiles: ['vitest.workspace.ts'],

  // --------------------------------------------------------- workspaces
  workspaces: {
    // ---- repo root -------------------------------------------------------
    '.': {
      entry: ['playwright.config.ts', 'commitlint.config.{js,ts,mjs,cjs}'],
      project: [],
      // These are all consumed via CLI or config files that knip doesn't trace.
      ignoreDependencies: [
        'turbo',
        'wrangler',
        'vitest',
        '@vitest/coverage-v8',
        'vite',
        '@playwright/test',
        '@axe-core/playwright',
        'rollup-plugin-visualizer',
        'prettier',
        'commitlint',
        '@commitlint/cli',
        '@commitlint/config-conventional',
        'eslint-config-prettier',
        'js-yaml',
        'globals',
        'impeccable',
        'jsdom',
        'typescript-eslint',
        '@types/node',
        'typescript',
        'eslint-import-resolver-typescript',
        'eslint-plugin-i18next',
        'eslint-plugin-import-x',
        'eslint-plugin-jsx-a11y',
        'eslint-plugin-promise',
        'eslint-plugin-react',
        'eslint-plugin-react-compiler',
        'eslint-plugin-react-hooks',
        'eslint-plugin-security',
        'eslint-plugin-unicorn',
        '@eslint/js',
        'eslint',
        // knip + madge are invoked via pnpm scripts, not imported
        'knip',
        'madge',
      ],
      // Unused test helpers in scripts/__tests__ — pre-existing baseline
      ignoreFiles: [
        'scripts/__tests__/check-app-identity.test.mjs',
        'scripts/__tests__/check-bundle-budget.test.mjs',
        'scripts/__tests__/check-bundle-size.test.mjs',
        'scripts/__tests__/report-performance.test.mjs',
      ],
    },

    // ---- apps/web --------------------------------------------------------
    'apps/web': {
      // Fonts are imported in globals.css, not traceable by knip.
      // jszip is listed in web deps but only used in worker tests (baseline).
      ignoreDependencies: [
        '@fontsource-variable/geist',
        '@fontsource/instrument-serif',
        'jszip',
        // dev deps consumed via config / build tooling, not source imports
        'vite',
        '@vitejs/plugin-react',
        'vitest',
        '@vitest/coverage-v8',
        'rollup-plugin-visualizer',
        '@playwright/test',
        '@types/node',
        'typescript',
        'cross-env',
        '@tailwindcss/vite',
        'tailwindcss',
        '@testing-library/jest-dom',
        '@testing-library/react',
        '@testing-library/user-event',
        'fake-indexeddb',
        'jsdom',
        '@types/react',
        '@types/react-dom',
        'eslint',
        'vite-plugin-pwa',
        '@sentry/react',
      ],
      // Barrel index not imported by any consumer — pre-existing baseline
      ignoreFiles: ['src/lib/index.ts'],
    },

    // ---- apps/worker -----------------------------------------------------
    'apps/worker': {
      // cloudflare:workers is a virtual CF Workers runtime module (not npm).
      // @libsql/client is imported in src/db/ which is a barrel not traced
      // from the worker entry point (pre-existing baseline).
      // @cloudflare/vitest-pool-workers is consumed by vitest config only.
      ignoreUnresolved: ['^cloudflare:'],
      ignoreDependencies: [
        'cloudflare',
        '@libsql/client',
        '@cloudflare/vitest-pool-workers',
        '@cloudflare/workers-types',
        'wrangler',
        'vitest',
        '@vitest/coverage-v8',
        '@types/node',
        'typescript',
        'jszip',
        'eslint',
        '@sentry/cloudflare',
        'argon2-wasm-edge',
      ],
      // Barrel files not traced from entry point — pre-existing baseline
      ignoreFiles: [
        'src/auth/index.ts',
        'src/db/index.ts',
        'src/storage/index.ts',
      ],
    },

    // ---- packages/reader-core --------------------------------------------
    'packages/reader-core': {
      ignoreDependencies: [
        'vitest',
        '@vitest/coverage-v8',
        'jsdom',
        '@types/node',
        'typescript',
        'eslint',
      ],
      // Test helper file not imported by any test — pre-existing baseline
      ignoreFiles: ['src/__tests__/fixtures/epub-helpers.ts'],
    },

    // ---- packages/schema -------------------------------------------------
    'packages/schema': {
      ignoreDependencies: [
        'vitest',
        '@vitest/coverage-v8',
        '@types/node',
        'typescript',
        'eslint',
      ],
    },

    // ---- packages/shared -------------------------------------------------
    'packages/shared': {
      // zod is used in shared source but knip doesn't trace it via re-exports
      // in the barrel (pre-existing baseline).
      ignoreDependencies: [
        'zod',
        'jszip',
        'vitest',
        '@vitest/coverage-v8',
        '@types/node',
        'typescript',
        'eslint',
        'fast-check',
      ],
    },

    // ---- packages/testkit ------------------------------------------------
    'packages/testkit': {
      ignoreDependencies: [
        'vitest',
        '@vitest/coverage-v8',
        '@types/node',
        'typescript',
        'eslint',
      ],
    },

    // ---- packages/ui -----------------------------------------------------
    'packages/ui': {
      // @storybook/react is an unlisted transitive peer used in stories;
      // the actual listed package is @storybook/react-vite.
      ignoreDependencies: [
        '@storybook/react',
        'storybook',
        '@storybook/react-vite',
        'vitest',
        '@vitest/coverage-v8',
        '@types/node',
        'typescript',
        'vite',
        'eslint',
        '@tailwindcss/vite',
        'tailwindcss',
        '@testing-library/jest-dom',
        '@testing-library/react',
        'jsdom',
        '@types/react',
        '@types/react-dom',
        'react',
        'react-dom',
      ],
    },
  },
};

export default config;
