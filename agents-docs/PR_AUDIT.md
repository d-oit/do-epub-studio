# GitHub PR Audit Report (2026-04-15)

This document summarizes the audit of open pull requests (remote branches) against the current codebase and the resolution of identified blockers.

## Major Dependency Updates (RESOLVED)

| PR Branch | Component | Original Status | Resolution | Outcome |
| --- | --- | --- | --- | --- |
| `dependabot/.../typescript-6.0.2` | TypeScript 6 | **BLOCKING** | Added `ignoreDeprecations: "6.0"` to `tsconfig.base.json`. | **RESOLVED** |
| `dependabot/.../vite-8.0.8` | Vite 8 | **BLOCKING** | Renamed `rollupOptions` to `rolldownOptions` and refactored `manualChunks` to functional form. | **RESOLVED** |
| `dependabot/.../vitest-4.1.4` | Vitest 4 | **FAIL** | Refactored `offline-sync.test.ts` to handle new spy/timer behavior. | **RESOLVED** |
| `dependabot/.../tailwindcss-4.2.2` | Tailwind 4 | **BLOCKING** | Integrated via `@tailwindcss/vite`, removed PostCSS dependency for Tailwind, and refactored `globals.css` to `@theme` / `@utility` blocks. | **RESOLVED** |

## Feature & Minor Updates (DESTRUCTIVE / SAFE)

| PR Branch | Status | Recommendation | Reason |
| --- | --- | --- | --- |
| `feat/add-opencode-atomic-commit` | **DESTRUCTIVE** | Close | Reverts/Deletes massive amounts of core code, plans, and tests. |
| `dependabot/.../zod-4.3.6` | **DESTRUCTIVE** | Close | PR is corrupted; deletes critical plans, documentation, and UI code. |
| `dependabot/.../eslint-plugin-react-hooks-7.0.1` | **DESTRUCTIVE** | Close (Cherry-picked) | Accessibility fixes for `Button` and `Input` were manually cherry-picked and improved. |
| `dependabot/.../vite-plugin-pwa-1.2.0` | **DESTRUCTIVE** | Close | Deletes core logic and documentation. |
| `dependabot/.../dev-dependencies-5686525a6c` | **PASS** | Merge | Safe bump for `prettier`, `turbo`, and `typescript-eslint`. |
| `dependabot/github_actions/actions/checkout-6` | **PASS** | Merge | Safe version bump for GitHub Actions. |
| `dependabot/github_actions/actions/setup-node-6` | **DESTRUCTIVE** | Close | Corrupted PR; deletes critical plans and documentation. |
| `dependabot/github_actions/pnpm/action-setup-6` | **DESTRUCTIVE** | Close | Corrupted PR; deletes critical plans and documentation. |

## Next Steps

1. Close the destructive/corrupted PRs listed above.
2. Proceed with the April 2026 roadmap now that infrastructure is stabilized on 2026 stack.
