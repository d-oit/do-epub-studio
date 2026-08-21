import type { KnipConfig } from 'knip';

/**
 * Knip configuration for dead-code and unused-dependency detection.
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

  // --------------------------------------------------------- workspaces
  workspaces: {
    // ---- repo root -------------------------------------------------------
    '.': {
      entry: ['commitlint.config.{js,ts,mjs,cjs}'],
      project: [],
      // knip's vitest plugin cannot load vitest.workspace.ts (defineWorkspace
      // unavailable in that context, known issue). Disable root config loading
      // so individual workspace vitest configs are still found.
      vitest: { config: [] },
      // These are all consumed via CLI or config files that knip doesn't trace.
      ignoreDependencies: [
        'wrangler',
        'js-yaml',
        'impeccable',
        'madge',
        'rollup-plugin-visualizer',
      ],
    },

    // ---- apps/web --------------------------------------------------------
    'apps/web': {
      // jszip is listed in web deps but only used in worker tests (baseline).
      ignoreDependencies: [
        'jszip',
      ],
      // Barrel index not imported by any consumer — pre-existing baseline
      ignoreFiles: ['src/lib/index.ts'],
      // Pages Function entry point — bundled by Cloudflare at deploy time,
      // never imported by app source (GOAP-252).
      ignore: ['functions/api/[[path]].ts'],
    },

    // ---- apps/worker -----------------------------------------------------
    'apps/worker': {
      // cloudflare:workers is a virtual CF Workers runtime module (not npm).
      // @libsql/client is imported in src/db/ which is a barrel not traced
      // from the worker entry point (pre-existing baseline).
      // @cloudflare/vitest-pool-workers is consumed by vitest config only.
      ignoreDependencies: [
        'cloudflare',
        '@libsql/client',
        '@cloudflare/vitest-pool-workers',
      ],
    },

    // ---- packages/reader-core --------------------------------------------
    'packages/reader-core': {
      // Test helper file not imported by any test — pre-existing baseline
      ignoreFiles: ['src/__tests__/fixtures/epub-helpers.ts'],
    },

    // ---- packages/schema -------------------------------------------------
    'packages/schema': {},

    // ---- packages/shared -------------------------------------------------
    'packages/shared': {
      // zod is used in shared source but knip doesn't trace it via re-exports
      // in the barrel (pre-existing baseline).
      ignoreDependencies: [
        'zod',
      ],
    },

    // ---- packages/testkit ------------------------------------------------
    'packages/testkit': {},

    // ---- packages/ui -----------------------------------------------------
    'packages/ui': {
      // @storybook/react is an unlisted transitive peer used in stories;
      // the actual listed package is @storybook/react-vite.
      ignoreDependencies: [
        '@storybook/react',
      ],
    },
  },
};

export default config;
