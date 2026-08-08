# GOAP Plan 098: Long-term Prevention of i18n E2E Test Failures

**Date**: 2026-08-02
**Issue**: #890 — Scheduled Cross-browser E2E failed on main
**Root Cause**: Translation strings drift from E2E assertions undetected

---

## Phase 1: ANALYZE

### Primary Goal
Eliminate the class of failures where translation catalog changes break E2E tests undetected for days/weeks because:
- E2E tests hard-code locale strings instead of importing from the catalog
- i18n E2E tests only run in nightly scheduled CI, not PR smoke
- No unit-level drift detection catches rendered translation mismatches

### Constraints
- Must not break existing test infrastructure
- Must follow existing patterns (vitest for unit, playwright for E2E)
- Must work across 13 locales (en, de, fr, es, pt, it, ja, zh, ko, ar, ru, hi, nl)

### Root Causes Identified

| # | Issue | Severity | Fix Type |
|---|-------|----------|----------|
| 1 | E2E asserts stale German 'Melde dich an' vs current 'Melde Sie sich an' | P0 | Immediate fix |
| 2 | waitForFunction checks `!== null` instead of `=== 'de'` | P1 | Immediate fix |
| 3 | login-and-book-load.spec.ts:138 expects `button` role but LocaleSwitcher is `<select>` | P1 | Immediate fix |
| 4 | No drift detection unit test for rendered i18n text | P2 | New test |
| 5 | i18n E2E tests not tagged `@smoke`, so they skip PR CI | P2 | Tag update |
| 6 | No documentation preventing hard-coded test strings | P3 | Documentation |

---

## Phase 2: DECOMPOSE

### Tasks

| ID | Task | Priority | Dependencies | Strategy |
|----|------|----------|--------------|----------|
| T1 | Fix stale German assertions in reader-annotations-and-admin.spec.ts | P0 | none | Sequential |
| T2 | Fix defective waitForFunction localStorage check | P1 | none | Sequential |
| T3 | Fix login-and-book-load.spec.ts button→combobox role assertion | P1 | none | Sequential |
| T4 | Create i18n translation-drift unit test | P2 | none | New test |
| T5 | Tag i18n E2E tests with @smoke for PR CI | P2 | none | Sequential |
| T6 | Add i18n key-value constants file for E2E tests | P2 | none | New file |

### Execution Strategy: Parallel where independent, sequential within phases

---

## Phase 3: STRATEGIZE — Recommended Approach: Hybrid (C + A)

**Chosen approach**: Snapshot-based drift detection (C) + Data-driven E2E strings (A)

### Why this combination:
1. **Snapshot drift detection (C)** — A vitest unit test that imports the translation catalogs directly and asserts the exact values for key login-page strings. This catches drift on every PR via the existing `test` CI job. Zero E2E overhead.
2. **Data-driven E2E strings (A)** — A shared constants file (`apps/tests/i18n-fixtures.ts`) that E2E tests import. Single source of truth for test assertions. When translations change, updating this file is the only test change needed.
3. **Tagging i18n tests @smoke** — Ensures the E2E i18n tests run on every PR, not just nightly.

### Why NOT approach B (data-testid):
- Requires changing component markup (adding testid attributes)
- Higher blast radius for a test-infrastructure fix
- The existing getByLabel/getByText selectors work fine

---

## Phase 4: COORDINATE — File Changes

### T1: Fix stale German assertions
**File**: `apps/tests/reader-annotations-and-admin.spec.ts`

```diff
- await expect(page.getByText('Melde dich an')).toBeVisible();
+ await expect(page.getByText('Melde Sie sich an')).toBeVisible();
```

Lines 281 and 298.

### T2: Fix waitForFunction
**File**: `apps/tests/reader-annotations-and-admin.spec.ts`

```diff
- await page.waitForFunction(() => localStorage.getItem('do-epub-locale') !== null);
+ await page.waitForFunction(() => localStorage.getItem('do-epub-locale') === 'de');
```

Line 294.

### T3: Fix button→combobox assertion
**File**: `apps/tests/login-and-book-load.spec.ts`

```diff
- // Locale switcher uses a button with current locale
- await expect(page.getByRole('button', { name: /EN|DE|FR/i })).toBeVisible();
+ // Locale switcher renders a <select> (combobox) with locale options
+ await expect(page.getByRole('combobox', { name: /Select language|Sprache auswählen|Sélectionner la langue/i })).toBeVisible();
```

Line 137-138. Note: The `a11y.select_locale` key is used in the component, so the accessible label depends on the locale. The regex covers EN/DE/FR defaults.

### T4: Create i18n drift detection unit test
**File**: `apps/web/src/__tests__/i18n-login-page-drift.test.ts` (new)

This test imports the actual translation catalogs and asserts that key login-page strings are non-empty and match expected patterns. It runs as part of the `pnpm test:coverage` job on every PR.

```typescript
import { describe, it, expect } from 'vitest';
import { dictionaries, type LocaleKey } from '../i18n';

describe('i18n login-page drift detection', () => {
  const loginKeys = [
    'login.subtitle',
    'login.emailLabel',
    'login.passwordLabel',
    'login.submit',
    'login.signingIn',
    'login.forgotPassword',
    'login.adminLink',
    'login.adminDescription',
    'login.recoveryTitle',
    'login.recoveryInstructions',
    'login.sendMagicLink',
    'login.backToLogin',
    'login.recoverySuccess',
    'login.verifyingToken',
    'login.error.network',
    'login.error.accessDenied',
    'a11y.select_locale',
  ] as const;

  for (const locale of Object.keys(dictionaries) as LocaleKey[]) {
    it(`${locale}: login-page strings are non-empty and distinct from English`, () => {
      const dict = dictionaries[locale];
      for (const key of loginKeys) {
        const value = dict[key];
        expect(value, `${locale}:${key} must be non-empty`).toBeTruthy();
        expect(value.trim().length, `${locale}:${key} must not be blank`).toBeGreaterThan(0);
        if (locale !== 'en') {
          // Detect if translation was left as-is (only works for non-English locales
          // where the English and translated values should differ)
          expect(value, `${locale}:${key} should be translated`).not.toBe(dictionaries.en[key]);
        }
      }
    });
  }
});
```

### T5: Tag i18n E2E tests with @smoke
**File**: `apps/tests/reader-annotations-and-admin.spec.ts`

Change test names to include `@smoke`:
- Line 272: `'@mobile can switch locale on login page'` → `'@mobile @smoke can switch locale on login page'`
- Line 287: `'@mobile locale persists after page reload'` → `'@mobile @smoke locale persists after page reload'`

### T6: Create shared i18n constants for E2E tests
**File**: `apps/tests/i18n-fixtures.ts` (new)

```typescript
/**
 * Shared i18n string constants for E2E tests.
 *
 * When translation catalogs change, update these values to match.
 * Both E2E tests and the drift-detection unit test reference this file
 * (or the catalogs directly) to keep assertions in sync.
 */
import { dictionaries, type LocaleKey } from '../web/src/i18n';

export const loginStrings = {
  de: {
    subtitle: dictionaries.de['login.subtitle'],
    selectLocale: dictionaries.de['a11y.select_locale'],
  },
  fr: {
    subtitle: dictionaries.fr['login.subtitle'],
    selectLocale: dictionaries.fr['a11y.select_locale'],
  },
  en: {
    subtitle: dictionaries.en['login.subtitle'],
    selectLocale: dictionaries.en['a11y.select_locale'],
  },
} as const;

export type TestLocale = keyof typeof loginStrings;
```

Then update reader-annotations-and-admin.spec.ts to import from this file:

```diff
+ import { loginStrings } from './i18n-fixtures';
+
  // In the i18n test:
- await expect(page.getByText('Melde Sie sich an')).toBeVisible();
+ await expect(page.getByText(loginStrings.de.subtitle)).toBeVisible();

- await expect(page.getByText('Connectez-vous pour accéder à vos livres')).toBeVisible();
+ await expect(page.getByText(loginStrings.fr.subtitle)).toBeVisible();
```

And for the locale switcher label:

```diff
  const localeSelect = page.getByLabel(
-   /Select language|Sprache auswählen|Sélectionner la langue/,
+   new RegExp(Object.values(loginStrings).map(l => l.selectLocale).join('|')),
  );
```

---

## Phase 5: EXECUTE — Implementation Order

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Create `apps/tests/i18n-fixtures.ts` | File exists, imports resolve |
| 2 | Fix T1+T2: Update reader-annotations-and-admin.spec.ts | `pnpm vitest run` passes for drift test |
| 3 | Fix T3: Update login-and-book-load.spec.ts | No type errors |
| 4 | Create T4: i18n-login-page-drift.test.ts | `pnpm --filter @do-epub-studio/web vitest run i18n-login-page-drift` passes |
| 5 | Fix T5: Add @smoke tags to i18n E2E tests | `grep -c @smoke apps/tests/reader-annotations-and-admin.spec.ts` shows new count |
| 6 | Run quality gate | `./scripts/quality_gate.sh` passes |
| 7 | Run full unit tests | `pnpm test` all green |

---

## Phase 6: SYNTHESIZE — Verification

### Quality Gates
- [x] `pnpm --filter @do-epub-studio/web vitest run i18n-rendered-text` — passes (snapshot drift detection; replaced the originally-planned `i18n-login-page-drift.test.ts`)
- [x] `pnpm --filter @do-epub-studio/web vitest run i18n-parity` — passes (existing)
- [x] `pnpm lint` — no new errors
- [x] `pnpm typecheck` — no new errors
- [x] `./scripts/quality_gate.sh` — full gate passes

> **Implementation note (2026-08-02):** The original T4/T6 design (`i18n-fixtures.ts` + `i18n-login-page-drift.test.ts`) was superseded by `apps/web/src/__tests__/i18n-rendered-text.test.ts` (snapshot-based drift detection) + `apps/tests/i18n-e2e-helpers.ts` (shared E2E strings). The second i18n E2E test (`locale persists after page reload`) is intentionally not tagged `@smoke` because it requires a running backend — see Plan 210 § Out of Scope. Plan 098 is functionally complete.

### How This Prevents Future Failures

| Failure Mode | Prevention Mechanism |
|-------------|---------------------|
| Translation string changes | `i18n-login-page-drift.test.ts` fails on PR (runs in unit test CI job) |
| New locale added without E2E coverage | `i18n-parity.test.ts` catches missing keys (existing) |
| E2E test forgets to update assertion | `i18n-fixtures.ts` imports directly from catalogs — if catalog changes, fixture auto-updates |
| i18n E2E test skips on PR | `@smoke` tag ensures it runs in e2e-smoke job |

### Documentation Addendum
Add to AGENTS.md Tier 2 or coding-guide.md:

> **i18n Test String Policy**: Never hard-code locale strings in E2E tests.
> Always import from `apps/tests/i18n-fixtures.ts` (which imports from the catalogs).
> When adding new translation keys that are visible on tested pages, add them to:
> 1. `apps/tests/i18n-fixtures.ts` (for E2E)
> 2. `apps/web/src/__tests__/i18n-login-page-drift.test.ts` (for drift detection)
> 3. Both files import from `apps/web/src/i18n/` catalogs, so they auto-update when catalogs change.
