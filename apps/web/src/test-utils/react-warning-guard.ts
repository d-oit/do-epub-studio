import { afterAll, beforeEach, expect } from 'vitest';

/**
 * React warning guard (ADR-275 / GOAP-275 Phase 2).
 *
 * The web suite runs with Vitest's default reporter, which prints no `stderr`
 * block for a passing file — so React's development warnings were invisible
 * while every gate stayed green (~114 `act(...)` warnings accumulated across 12
 * files before GOAP-275). This guard counts the tracked warning classes and
 * fails a test file that emits one, unless the file is still on the tracked
 * inventory below.
 *
 * Deliberately file-level, not count-level: the same revision produced 13, 34
 * and 82 `act(...)` warnings depending on run shape (single file vs full suite)
 * and reporter, so a numeric baseline would flake. Which *files* warn is stable.
 *
 * The guard never suppresses output: every `console.error` call is forwarded to
 * the original function, ADR-275 forbids silencing warnings instead of fixing
 * them.
 */

export type ReactWarningKind = 'act' | 'key' | 'unknown-prop';

export interface ReactWarningCounts {
  act: number;
  key: number;
  'unknown-prop': number;
}

/** Warning text → tracked kind. Order matters only for overlapping patterns. */
const WARNING_PATTERNS: ReadonlyArray<readonly [ReactWarningKind, RegExp]> = [
  ['act', /not wrapped in act\(/],
  ['key', /unique "key" prop/],
  ['unknown-prop', /does not recognize the `[A-Za-z]+` prop/],
];

/**
 * Files that still emit tracked React warnings. This is the GOAP-275 Phase 3
 * inventory (issue #1185): each entry is removed as that file is drained, and
 * any file *not* listed here must emit none. Paths are relative to `apps/web`
 * with POSIX separators.
 */
export const KNOWN_WARNING_FILES: readonly string[] = [
  'src/__tests__/account-settings-page.test.tsx',
  'src/__tests__/admin-recover-page.test.tsx',
  'src/__tests__/notification-panel.test.tsx',
  'src/__tests__/storage-quota.test.tsx',
  'src/__tests__/useTranslation.test.ts',
  'src/components/__tests__/SwUpdateNotification.test.tsx',
  'src/features/admin/AuditLogPage.test.tsx',
  'src/features/reader/ReaderPage.test.tsx',
  'src/features/reader/components/toolbar/ReaderToolbar.test.tsx',
  'src/features/reader/hooks/useReaderSearch.test.ts',
  'src/hooks/useSessionExpiry.test.ts',
];

/** `true` when `text` is one of the tracked React warning classes. */
export function classifyReactWarning(text: string): ReactWarningKind | null {
  for (const [kind, pattern] of WARNING_PATTERNS) {
    if (pattern.test(text)) return kind;
  }
  return null;
}

/**
 * Normalises an absolute test path (as Vitest reports it) to the
 * package-relative form used by `KNOWN_WARNING_FILES`, so the guard works
 * whether Vitest runs from `apps/web` or from the repo root.
 */
export function normalizeTestPath(testPath: string): string {
  return testPath.replace(/^.*?[/\\]apps[/\\]web[/\\]/, '').replace(/\\/g, '/');
}

/**
 * Throws when a file emitted tracked warnings and is not on the inventory.
 * Pure decision logic so the ratchet is unit-testable.
 */
export function assertNoNewWarnings(input: {
  testFile: string | undefined;
  counts: ReactWarningCounts;
  knownFiles?: readonly string[];
}): void {
  const { testFile, counts } = input;
  const known = new Set(input.knownFiles ?? KNOWN_WARNING_FILES);
  const total = counts.act + counts.key + counts['unknown-prop'];
  if (total === 0) return;

  const file = testFile ? normalizeTestPath(testFile) : '<unknown file>';
  if (known.has(file)) return; // tracked debt — drained file by file (GOAP-275 Phase 3)

  throw new Error(
    `React warning(s) emitted in ${file}: act=${counts.act} key=${counts.key} ` +
      `unknown-prop=${counts['unknown-prop']}. New React warnings are defects (ADR-275): ` +
      `fix them, or add the file to KNOWN_WARNING_FILES with a GOAP-275 inventory entry. ` +
      `Reproduce with: pnpm --filter @do-epub-studio/web exec vitest run <file> --reporter=verbose --silent=false`,
  );
}

/**
 * Installs the guard for one test file: counts tracked warnings from
 * `console.error` and fails the file in `afterAll` when it is not on the
 * inventory.
 */
export function installReactWarningGuard(options: { knownFiles?: readonly string[] } = {}): void {
  const counts: ReactWarningCounts = { act: 0, key: 0, 'unknown-prop': 0 };
  const originalError = console.error;
  let testFile: string | undefined;

  console.error = (...args: unknown[]) => {
    const text = args.map((arg) => (typeof arg === 'string' ? arg : '')).join(' ');
    const kind = classifyReactWarning(text);
    if (kind) counts[kind] += 1;
    originalError(...args);
  };

  beforeEach(() => {
    testFile ??= expect.getState().testPath;
  });

  afterAll(() => {
    console.error = originalError;
    assertNoNewWarnings({ testFile, counts, knownFiles: options.knownFiles });
  });
}
