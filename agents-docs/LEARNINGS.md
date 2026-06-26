# Project Learnings

> Aggregated non-obvious discoveries - loaded on demand via `learn` skill.

## Learnings Capture Rules

### What to Capture

- Hidden file relationships not obvious from code
- Execution paths that differ from what code appears to do
- Non-obvious config, env vars, or flags
- Misleading error messages and debugging breakthroughs
- Files that must change together
- Build/test commands not documented elsewhere
- Architectural constraints discovered at runtime

### What NOT to Capture

- Obvious documentation or standard behavior
- Duplicates of existing entries
- Verbose explanations or session-specific notes

### Scoping

| Scope           | Location                          |
| --------------- | --------------------------------- |
| Project-wide    | `agents-docs/LEARNINGS.md`        |
| Script-specific | `scripts/AGENTS.md`               |
| Skill-specific  | `.agents/skills/<name>/AGENTS.md` |
| Plan-specific   | `plans/AGENTS.md`                 |

---

## Learnings (Project-Wide)

### Core Pitfalls

- **Vitest**: `turbo run test` hangs if any package uses bare `vitest`; always pass `--run` so CI exits cleanly.
- **Vitest coverage-v8 versioning**: `@vitest/coverage-v8` must match the installed `vitest` major version exactly. Installing v4 coverage with v1 vitest causes `Cannot read properties of undefined (reading 'reportsDirectory')` at runtime.
- **Vitest worker OOM**: `pool: 'forks'` with 180+ tests causes heap exhaustion; use `NODE_OPTIONS="--max-old-space-size=8192"` (8GB+) to mitigate.
- **Vitest React concurrent pollution**: React 18's `performConcurrentWorkOnRoot` fails with "Should not already be working" when tests run together. All pool options (`threads`, `forks`, `vmForks`, `isolate:true`) fail to prevent React state pollution. Run files individually or skip affected tests.
- **Vitest mock defaults**: `vi.mock('../../lib/api', () => ({ apiRequest: vi.fn().mockResolvedValue([]) }))` as default prevents undefined errors when tests run alone; override in `beforeEach`.
- **MockReset vs MockClear**: `mockReset()` removes implementation and breaks subsequent tests; use `mockClear()` to preserve mock behavior while resetting call counts.
- **waitFor over raw setTimeout flushing**: For testing async React effects, use `@testing-library/react`'s `waitFor` instead of `act(() => new Promise(resolve => setTimeout(resolve, 0)))`. `waitFor` polls until assertion passes, avoiding hangs from incomplete microtask flushing.
- **Vitest 4.x vi.mock hoisting**: `vi.mock()` factories are hoisted to the top. Module-level variables referenced in factory callbacks must use `vi.hoisted()` or be defined before any `vi.mock` calls.
- **Duplicate exports**: Don't export same function from multiple modules in a package; TS reports "has already exported a member" error.
- **EPUB.js + TypeScript**: epubjs types expect non-null refs; capture in local variable before passing to `renderTo()` to avoid TS2769 errors.
- **IndexedDB getAllFromIndex**: idb's `getAllFromIndex` with boolean `false` as value fails — use `.getAll().then(filter())` instead.
- **epub-js Metadata extends Map**: Epub.js `Metadata` class extends `Map`, so values must be accessed via `.get('key')` not dot notation.
- **cfiToRange restoration quirk**: The original regex captured the full `!.*` path portion. The ReDoS fix stripped this path capture accidentally. Verify path preservation when rewriting CFI parsers.

### CI / Tooling

- **pnpm corepack prompts**: On fresh environments, `pnpm` may prompt interactively for corepack downloads. Use `corepack enable && echo "Y" | pnpm install` for non-interactive setup.
- **pnpm frozen-lockfile + dep changes**: After adding new dependencies to package.json, `pnpm install --frozen-lockfile` fails with `ERR_PNPM_OUTDATED_LOCKFILE`. Run `pnpm install --no-frozen-lockfile` to update lockfile, then commit the updated pnpm-lock.yaml.
- **Dependabot Corruption Risk**: Dependabot PRs can become "corrupted" and include massive deletions of unrelated files. Always perform a full file-level diff before merging automated dependency updates.
- **Dependabot lockfile corruption**: Merging dependabot PRs can corrupt `pnpm-lock.yaml` with duplicate YAML mapping keys. Regenerate with `rm pnpm-lock.yaml && pnpm install --no-frozen-lockfile` rather than manual merge.
- **GitHub Actions Node.js 24**: Node.js 20 actions are deprecated and will be forced to Node.js 24 starting June 2nd, 2026. Opt in now with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` env at workflow level and update `node-version: '24'` in actions/setup-node@v4.
- **e2e.yml broken step trap**: A YAML step with `name` but no `run`/`uses` creates a silent no-op that GHA skips without error. When refactoring workflows, verify every step has either `run:` or `uses:`.
- **CodeQL CI gate needs security-events: read**: The `gh api repos/${{ github.repository }}/code-scanning/alerts` endpoint requires `security-events: read` permission in the GITHUB_TOKEN.
- **codecov.yml threshold settings**: Per-package codecov targets need `threshold: 2%` to allow small coverage fluctuations. Without threshold, coverage drops of even 0.1% can fail CI.
- **Playwright WebKit on WSL**: WebKit browser requires many system libraries not installed by default on WSL. Chromium and Firefox work fine; WebKit needs `apt install` of dependencies or skip in CI.
- **E2E smoke tests fail on dev without Firefox**: `test:e2e:smoke` runs Playwright against both Chromium and Firefox by default. On dev machines without Firefox installed, this causes pre-commit hook failures. Use `SKIP_SMOKE=true` env var or `git commit --no-verify` to bypass.
- **Lighthouse CI non-blocking**: Lighthouse audit fails on all PRs due to strict 0.9 thresholds, but `main` branch has no required status checks. PRs can be merged despite Lighthouse failure. Documented in KNOWN-ISSUES.md.

### UI/UX

- **Motion component props**: `{...props}` on `<motion.input/div/button/header>` causes type conflicts; fix with `{...(props as any)}`.
- **Motion Test Mocking**: When mocking `framer-motion` in Vitest, filtering out motion-specific props (whileHover, animate, transition, etc.) and mapping them to `data-*` attributes prevents React DOM warnings while enabling robust test assertions.
- **React RefObject readonly**: `React.RefObject<T>` has a readonly `current` property. Use `useRef<T | null>(initialValue)` instead when you need to mutate `.current` inside effects or event handlers.
- **react-hooks/exhaustive-deps with refs**: When capturing a ref's `.current` value inside `useEffect`, exclude the ref from the dependency array and capture the value at effect execution time.
- **Tailwind sr-only class**: `sr-only` is a built-in Tailwind utility (no config needed) — hides content visually but keeps it accessible to screen readers.
- **axe-core playwright**: `@axe-core/playwright` analyzes the page at the moment of invocation. Mocked API responses must be set up before navigation for meaningful results on pages that load asynchronously.
- **createPortal + test queries**: Components migrated to `createPortal` render content to `document.body`, not `render()`'s container. Change `container.querySelector()` to `document.body.querySelector()` in tests.
- **jsdom + focus trap offsetParent**: `useFocusTrap` filters focusable elements by `el.offsetParent !== null`. In jsdom, `offsetParent` always returns `null`. Fix: mock `Object.defineProperty(HTMLElement.prototype, 'offsetParent', ...)` in test setup.

---

## Plan Summaries

### Plan 102 — App Identity, Codacy Required-Check Discovery

- **PR #618 shipped.** 20/20 GitHub Actions checks pass. Codacy is a required check per AGENTS.md Tier 1.
- Codacy mandates added to AGENTS.md Tier 1. New `?raw` / static-import pattern documented for Vite/webpack configs.
- Local ESLint skips root configs (`vite.config.ts`, etc.). Codacy lints the whole file. Green local lint ≠ green Codacy. See `.agents/skills/codacy/SKILL.md`.

### Plan 104 — Production-Readiness + Pre-Existing CI Closure

- **PR #624 shipped.** 23 required CI checks pass. Cross-browser E2E failures: 11 → 0.
- Brand identity enforced by CI (`scripts/check-app-identity.mjs`). VERSION drift closed (0.1.0 → 0.1.1).
- `VITE_LOG_LEVEL` must be set at BUILD time for vite preview. Service worker intercepts route mocks in WebKit — add `serviceWorkers: 'block'` to playwright config.
- `window.location.href` races with React Router `<Navigate>` — use `sessionExpired` flag in auth store instead.
- ESLint security plugin flags every `new RegExp(<non-literal>)` — use plain string operations instead.

### Plan 112 — Phase 2/3 Execution & GOAP-110 Status

- **GOAP-110 Phase 1 (V1–V6) confirmed DONE** by re-verification of PRs #638–#642.
- Impeccable design vocabulary wired (PRs #635–#637). `.impeccable/` submodule provides 44 detector rules.
- Annotation round-trip foundation: `useExportNotes` exports CFI/locator/chapter metadata per ADR-006.
- Catalog route is a 32-line stub — Phase 2 adds pagination/search/filter. Coverage thresholds must ship tests first, then bump 2-5% below actual.
