# GOAP 086 — GitHub CI Failure Findings, 2026-06-12

## Goal

Identify and document current GitHub Actions failures using `gh`, compare them with local quality gates, and record next-step findings in `plans/`.

## Constraints

- Do not commit changes unless explicitly requested.
- Use `plans/` for planning artifacts.
- Keep GitHub URLs to repository actions already queried via `gh`.

## State

- Local branch: `main`
- Local HEAD: `7484487 feat(web): resolve all 12 open issues #484-#497`
- Latest fetched `origin/main`: `7484487`

## Local quality gates

- `pnpm lint`: passed.
- `pnpm test`: passed.
- `pnpm build`: passed.
- `pnpm test:coverage`: passed.
- `pnpm --filter @do-epub-studio/web build`: passed.
- `pnpm --filter @do-epub-studio/ui test:unit -- --coverage`: passed after updating `Button.test.tsx` for the new secondary/ghost text token.

### Local warnings observed

- Vite browser externalization warning for `node:crypto` imported by `apps/web/src/lib/offline/crypto.ts`.
- Existing test noise in coverage run: React `act(...)` warnings, missing unique key warning in `TableOfContents`, and logged test errors that did not fail tests.

## GitHub failures inspected

### 1. Latest main scheduled CI failure

- Run: `27392272336`
- Event: `schedule`
- Branch: `main`
- SHA: `c31f74ab97cfcfbb5f7a3633d5fa017778298ce5`
- Failed job: `Scheduled Cross-browser E2E`
- Job ID: `80952136957`
- Command: `PLAYWRIGHT_MODE=preview pnpm test:e2e --retries=1`
- Log: `/home/doit/.local/share/opencode/tool-output/tool_ebbc78c41001gSZOoElK8TZBd5`
- Artifacts:
  - `test-results-full` — `7582931537`
  - `playwright-report-full` — `7582930716`
  - `build-dist` — `7582364527`
  - `sbom` — `7582336593`
  - `verification-output` — `7582336593`

Findings:

- E2E tests are brittle around login/admin state and routing.
- Timed out waiting for `Password (if required)`, `Book URL Slug`, `Settings`, and `Access Grants`.
- Affected specs:
  - `apps/tests/accessibility-audit.spec.ts`
  - `apps/tests/login-and-book-load.spec.ts`
  - `apps/tests/reader-annotations-and-admin.spec.ts`
- One accessibility failure: insufficient color contrast.
- Targeted local preview E2E runs later passed for Chromium and Firefox; iPhone remained environment-blocked.

### 2. Latest PR CI unit-test failure

- PR: `502 — Implement Global Error Handling and UI`
- Run: `27362684876`
- Branch: `feat/error-handling-and-ui-9373502278656079996`
- SHA: `3ca4c1f98dec62ba348c8efc6cbcb28df56b974f`
- Failed job: `Unit Tests`
- Job ID: `80854064825`
- Log: `/home/doit/.local/share/opencode/tool-output/tool_ebbc8da09001YJrOqR6dFfGsvE`

Findings:

- The failure was not coverage thresholds; it was three unit-test assertions in `apps/web/src/__tests__/main.test.tsx`.
- Failed tests:
  - `global error handlers > error handler logs client event`
  - `global error handlers > unhandledrejection handler logs client event`
  - `global error handlers > handles non-Error rejection reason gracefully`
- Failure signature: `expected "vi.fn()" to be called with arguments: [ ObjectContaining{…} ]`
- Root cause at that SHA: global error handlers did not log through `logClientEvent` before showing toast.
- Current `main` now has logging in `handleError` and `handleRejection`, so this specific PR failure appears stale relative to current `main`.

### 3. Lighthouse workflow failure

- Run: `27359896847`
- Event: `pull_request`
- Branch: `feat/error-handling-and-ui-9373502278656079996`
- Failed job: `Lighthouse audit`
- Job ID: `80844163545`
- Log: `/home/doit/.local/share/opencode/tool-output/tool_ebbc98c1e001Bo6ObMpstHYcpC`

Findings:

- Failure occurred during `pnpm install --frozen-lockfile`.
- Error: `ERR_PNPM_OUTDATED_LOCKFILE`.
- Reported lockfile mismatch: `@do-epub-studio/shared@workspace:*` added to `packages/ui/package.json` but missing from `pnpm-lock.yaml`.
- This is a dependency-lock drift issue in that PR merge commit.

### 4. Visual regression workflow failure

- Run: `27361907348`
- Event: `pull_request`
- Branch: `feat/error-handling-and-ui-9373502278656079996`
- Failed job: `Chromatic visual regression`
- Job ID: `80851196437`
- Log: `/home/doit/.local/share/opencode/tool-output/tool_ebbc98c1e001Bo6ObMpstHYcpC`

Findings:

- `pnpm install --frozen-lockfile` passed in this run.
- `pnpm build:storybook --stats-json --output-dir storybook-static` failed.
- Error: `Could not resolve '../toast'` from `packages/ui/src/__stories__/Toast.stories.tsx`.
- Import path: `../toast`
- Current `main` has `packages/ui/src/toast.tsx`, but that PR merge commit did not include the implementation file needed by the story.

## Current CI triage state

- Current `main` scheduled E2E failure is addressed for Chromium and Firefox by code/test fixes.
- Full scheduled-equivalent cross-browser completion remains blocked only by the iPhone/WebKit OS dependency environment.
- No remaining app-level E2E or a11y failures were found in targeted preview runs.
- Latest targeted preview runs:
  - Chromium targeted suite: passed `39` tests using `7` workers.
  - Cross-browser targeted suite: Chromium and Firefox passed; iPhone blocked before tests by missing WebKit runtime dependencies.

## Remaining blockers and next actions

1. Install WebKit OS dependencies for iPhone Playwright if full cross-browser CI must pass locally:
   - Preferred command: `pnpm exec playwright install-deps webkit`
   - Manual package class: ICU 75 libraries, `libjpeg62-turbo`, `libpng16-16`, `libxml2`, `libxslt1.1`, and `libatomic1`.
   - Issue: this is an environment/package-manager operation, not an app code fix; it can require root/sudo and distro-specific package names.
   - Attempted command: `pnpm exec playwright install-deps webkit`.
   - Attempt result: failed before installing packages because `sudo` required a password/non-interactive sudo was unavailable:
     - `sudo: a terminal is required to read the password; either use the -S option to read from standard input or configure an askpass helper`
     - `sudo: a password is required`
   - Resolution path: install the listed WebKit system dependencies in the CI/local runner environment, or have an operator run the command with passwordless sudo/root access.
2. After WebKit dependencies are available, rerun scheduled-equivalent command:
   - `PLAYWRIGHT_MODE=preview pnpm test:e2e --retries=1`
3. If installing dependencies is not desired, document iPhone as environment-blocked and proceed with Chromium/Firefox evidence plus quality gates.
4. Do not commit until the user explicitly asks to commit.
5. If committing later, run `./scripts/quality_gate.sh`, validate workflows, and use atomic commit script with a `type(scope): description` message.

## Completed fixes

- `apps/tests/login-and-book-load.spec.ts`: stabilized login/book-load/mobile expectations and spinner timing.
- `apps/tests/reader-annotations-and-admin.spec.ts`: fixed French locale heading expectation.
- `apps/tests/traceid-header.spec.ts`: stabilized mock responses and expected intercepted endpoints.
- `apps/tests/accessibility-audit.spec.ts`: updated selectors around current reader/admin UI.
- `apps/web/src/features/auth/LoginPage.tsx`: fixed preview `Forgot password?` contrast.
- `apps/web/src/components/SwUpdateNotification.tsx`: fixed service-worker banner contrast.
- `packages/ui/src/button.tsx`: adjusted secondary/ghost button text tokens for accessible contrast.
- `apps/web/tailwind.config.js`: included UI package sources in Tailwind content scanning.
- `apps/web/src/features/reader/components/toolbar/ReaderToolbar.tsx`: added accessible name to reader progress bar.
- `apps/web/src/features/reader/ReaderPage.tsx`: stabilized file-url loading state around aborted fetch cleanup.
- `packages/ui/src/__tests__/Button.test.tsx`: updated ghost variant assertion for the new token.

## Historical GitHub failures inspected
