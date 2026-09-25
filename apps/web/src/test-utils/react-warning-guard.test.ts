import { describe, it, expect } from 'vitest';
import {
  KNOWN_WARNING_FILES,
  assertNoNewWarnings,
  classifyReactWarning,
  normalizeTestPath,
  type ReactWarningCounts,
} from './react-warning-guard';

const none: ReactWarningCounts = { act: 0, key: 0, 'unknown-prop': 0, 'suspended-resource': 0 };

describe('classifyReactWarning', () => {
  it('classifies the tracked React warning classes', () => {
    expect(
      classifyReactWarning('An update to ReaderPage inside a test was not wrapped in act(...).'),
    ).toBe('act');
    expect(
      classifyReactWarning('A suspended resource finished loading inside a test, but the event was not wrapped in act(...).'),
    ).toBe('suspended-resource');
    expect(
      classifyReactWarning('Each child in a list should have a unique "key" prop.'),
    ).toBe('key');
    expect(
      classifyReactWarning('React does not recognize the `isLoading` prop on a DOM element.'),
    ).toBe('unknown-prop');
  });

  it('ignores unrelated console.error output', () => {
    expect(classifyReactWarning('{"level":"warn","event":"conflict.detected"}')).toBeNull();
    expect(classifyReactWarning('Archive failed')).toBeNull();
    expect(classifyReactWarning('')).toBeNull();
  });
});


describe('normalizeTestPath', () => {
  it('reduces absolute paths to the package-relative form', () => {
    expect(normalizeTestPath('/repo/apps/web/src/features/admin/AuditLogPage.test.tsx')).toBe(
      'src/features/admin/AuditLogPage.test.tsx',
    );
    expect(normalizeTestPath('C:\\repo\\apps\\web\\src\\hooks\\useSessionExpiry.test.ts')).toBe(
      'src/hooks/useSessionExpiry.test.ts',
    );
  });
});

describe('assertNoNewWarnings', () => {
  it('stays silent when no tracked warning was emitted', () => {
    expect(() =>
      assertNoNewWarnings({ testFile: '/repo/apps/web/src/new.test.tsx', counts: none }),
    ).not.toThrow();
  });

  it('tolerates no file: the GOAP-275 inventory is empty', () => {
    expect(KNOWN_WARNING_FILES).toEqual([]);
  });

  it('honours an explicit inventory override', () => {
    expect(() =>
      assertNoNewWarnings({
        testFile: '/repo/apps/web/src/x.test.tsx',
        counts: { ...none, 'unknown-prop': 2 },
        knownFiles: ['src/x.test.tsx'],
      }),
    ).not.toThrow();
  });

  it('fails a file that is not on the inventory', () => {
    expect(() =>
      assertNoNewWarnings({
        testFile: '/repo/apps/web/src/features/new/Thing.test.tsx',
        counts: { ...none, act: 1 },
      }),
    ).toThrow(/React warning\(s\) emitted in src\/features\/new\/Thing\.test\.tsx/);
  });

  it('fails closed when the test file cannot be attributed', () => {
    expect(() =>
      assertNoNewWarnings({ testFile: undefined, counts: { ...none, key: 1 } }),
    ).toThrow(/<unknown file>/);
  });

  it('counts a suspended-resource warning as a tracked defect', () => {
    expect(() =>
      assertNoNewWarnings({
        testFile: '/repo/apps/web/src/suspends.test.tsx',
        counts: { ...none, 'suspended-resource': 1 },
      }),
    ).toThrow(/suspended-resource=1/);
  });
});
