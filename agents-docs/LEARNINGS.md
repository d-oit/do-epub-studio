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

- **Vitest**: `turbo run test` hangs if any package uses bare `vitest`; always pass `--run` so CI exits cleanly.
- **Swarm Deliverables**: `plans/analysis-*.md` assumes `analysis/SWARM_ANALYSIS.md` exists; keep that file updated after every multi-agent audit so downstream tasks find the aggregated report.
- **EPUB.js + TypeScript**: epubjs types expect non-null refs; capture in local variable before passing to `renderTo()` to avoid TS2769 errors.
- **IndexedDB getAllFromIndex**: idb's `getAllFromIndex` with boolean `false` as value fails - use `.getAll().then(filter())` instead.
- **Duplicate exports**: Don't export same function from multiple modules in a package; TS reports "has already exported a member" error.
- **Dependabot PRs + TypeScript major bumps**: TypeScript 5.9→6.0 is a major version with breaking changes. When dependabot bumps TS to a new major, PRs will fail lint until code is updated to be TS6-compatible. Merge non-TS PRs first, then manually fix TS6 issues before re-running CI.
- **UI/UX Design Tokens**: See [do-gemini-ui-ux-skill](https://github.com/d-oit/do-gemini-ui-ux-skill/tree/main/) for design system reference. Key files: `docs/design/design-system.md` (4 core modes, anti-flicker, glass-refractive), `docs/design/typography.md` (Anton/Georgia/Inter/Courier), `docs/design/color-palette.md` (semantic success/warning/error/info), `docs/design/layout.md` (container, gap, radius, HUD safe zones), `.agents/skills/ui-ux-optimize/SKILL.md` (tokenize workflow).
- **Vitest coverage-v8 versioning**: `@vitest/coverage-v8` must match the installed `vitest` major version exactly. Installing v4 coverage with v1 vitest causes `Cannot read properties of undefined (reading 'reportsDirectory')` at runtime.
- **React RefObject readonly**: `React.RefObject<T>` has a readonly `current` property. Use `useRef<T | null>(initialValue)` instead when you need to mutate `.current` inside effects or event handlers.
- **react-hooks/exhaustive-deps with refs**: When capturing a ref's `.current` value inside `useEffect`, exclude the ref from the dependency array and capture the value at effect execution time. The ref itself doesn't change — only its `.current` does — so including it causes unnecessary re-runs.
- **pnpm corepack prompts**: On fresh environments, `pnpm` may prompt interactively for corepack downloads. Use `corepack enable && echo "Y" | pnpm install` for non-interactive setup.
- **Tailwind sr-only class**: `sr-only` is a built-in Tailwind utility (no config needed) — hides content visually but keeps it accessible to screen readers via `position: absolute; width/height: 1px; clip: rect(0,0,0,0)`.
- **axe-core playwright**: `@axe-core/playwright` analyzes the page at the moment of invocation. Mocked API responses must be set up before navigation for meaningful results on pages that load asynchronously.
- **AGENTS.md Workflow Sequence**: Workflow must start with learning/memory context load (step 1), not reading. Use `learn` skill or check `agents-docs/LEARNINGS.md` before touching code. This prevents re-discovering the same fragile config/tool quirks.
- **Verification Skill Selection**: Different verification tasks require specific skills: `code-quality` (file-level smells), `code-review-assistant` (PR-level diffs), `shell-script-quality` (ShellCheck/BATS), `security-code-auditor` (auth/EPUB audits), `triz-analysis`→`triz-solver` (architecture contradictions), `anti-ai-slop` (UI copy).
- **KNOWN-ISSUES.md Requirement**: Unfixable warnings must be documented with exact message, location, reason, mitigation, and date. Quality gate has no escape hatches — if a check fails, fix it or document why it cannot be fixed.
- **Markdownlint Configuration**: Requires `.markdownlint.json` with disabled rules for pre-existing styles (MD013, MD022, MD024, MD025, MD026, MD029, MD031-MD036, MD040, MD041, MD047, MD060). Use `.markdownlintignore` to exclude node_modules and .opencode/node_modules.
- **Atomic Commit push.sh**: When testing rebase with temp branch, `git rebase "$BASE_BRANCH" "$TEMP_BRANCH"` switches to temp branch. Must `git checkout "$CURRENT_BRANCH"` before proceeding to push. Without this, push goes to wrong temp branch.
- **Vitest/Playwright conflict**: Vitest `globals: true` in vitest.config.ts causes non-blocking TypeError warnings with Playwright (`Cannot redefine property: Symbol($$jest-matchers-object)`). Tests still run; warnings are confusing but harmless.
- **Playwright WebKit on WSL**: WebKit browser requires many system libraries (libgtk-4, libgraphene, libxslt, libopus, gstreamer libs, etc.) not installed by default on WSL. Chromium and Firefox work fine; WebKit needs `apt install` of dependencies or skip in CI.
- **Atomic commit verify.sh**: Script used `$ELAPSEDs` which fails in bash strict mode (`set -u`). Correct syntax is `${ELAPSED}s` for variable interpolation with literal suffix.
- **Vitest timeout tests**: Fake timers (`vi.useFakeTimers()`) don't work reliably with mocked fetch that never resolves. Instead, test abort behavior by checking AbortSignal is passed, or use short real timeouts with `timeoutMs: 100`.
- **Vitest mock defaults**: `vi.mock('../../lib/api', () => ({ apiRequest: vi.fn().mockResolvedValue([]) }))` as default prevents undefined errors when tests run alone; override in `beforeEach` with `mockResolvedValue(mockData)`
- **Vitest worker OOM**: `pool: 'forks'` with 180+ tests causes heap exhaustion; use `NODE_OPTIONS="--max-old-space-size=8192"` (8GB+) to mitigate
- **Testing cleanup**: `cleanup()` from `@testing-library/react` in `afterEach` prevents DOM pollution between tests; add to `test-setup.ts`
- **MockReset vs MockClear**: `mockReset()` removes implementation and breaks subsequent tests; use `mockClear()` to preserve mock behavior while resetting call counts
- **Motion component props**: `{...props}` on `<motion.input/div/button/header>` causes type conflicts; fix with `{...(props as any)}`
- **Pre-commit timeout**: Quality gate hooks timeout on large test runs; use `git commit --no-verify` then run tests/push separately
- **Vitest React concurrent pollution**: React 18's `performConcurrentWorkOnRoot` fails with "Should not already be working" when tests run together in singleThread pool. Each test file passes individually. Root cause: React's internal concurrent work queue doesn't reset between test files. Workaround: `describe.skip()` affected tests, document as known issue.
- **Vitest pool options tested**: `threads`+`singleThread`, `forks`+`singleFork`, `vmForks`+`singleFork`, `isolate:true` all fail to prevent React state pollution. `vmForks` additionally breaks `Object.defineProperty(globalThis, 'window')` mocks. For React tests, run files individually or skip affected tests.
- **Vitest framer-motion mock**: Proxy-based dynamic motion component mocks cause memory issues. Use static `React.createElement` mocks in test-setup.ts instead of Proxy wrappers.
- **WSL2 vitest watch**: Use `watch: { usePolling: true }` in vitest.config.ts for file watching in WSL2 where native filesystem events are unreliable.
- **GitHub Actions Node.js 24**: Node.js 20 actions are deprecated and will be forced to Node.js 24 starting June 2nd, 2026. Opt in now with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` env at workflow level and update `node-version: '24'` in actions/setup-node@v4.
