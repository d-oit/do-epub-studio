# GOAP-307: Dates and byte sizes follow the selected UI locale (A10)

**Status:** DONE
**Date:** 2026-10-03
**Type:** Corrective implementation slice (authorized from the GOAP-298 audit,
finding A10)
**ADRs referenced:** ADR-214 (audit recommendation governance)
**Source findings:** A10 — "dates and byte numbers ignore the selected UI
locale" in `analysis/comprehensive-gap-audit.md`

## Goal

The UI locale selector must govern the whole UI: with the app set to French, an
en-US browser must not produce English-formatted session dates, and with German
selected the same megabyte magnitude must read `1,5 MB`. Binary magnitude
semantics stay as they are, and no new formatter abstraction is introduced.

## Changes

- **`apps/web/src/lib/formatBytes.ts`**: the number is formatted through
  `Intl.NumberFormat(getCurrentLocale(), { minimumFractionDigits, maximumFractionDigits })`
  — whole bytes keep zero decimals, larger magnitudes keep exactly one, and the
  1024-based ladder is untouched. Both consumers (`AdminDashboardPage`,
  `StorageQuota`) already read `useTranslation()`, so a locale change re-renders
  them and the next call formats in the new locale.
- **`apps/web/src/features/admin/AccountSettingsPage.tsx`**: the page-local
  `formatDateTime` now delegates to the existing store-aware helper
  (`lib/i18n-format.ts`) instead of `Date#toLocaleString()`. The wrapper stays
  only for the two behaviours the helper does not own: `'—'` for an absent value
  and the raw API string when the timestamp does not parse.

## Evidence

`apps/web/src/lib/formatBytes.test.ts` (new) and an added case in
`apps/web/src/__tests__/account-settings-page.test.tsx`:

| Case                 | Assertion                                                                                                        |
| :------------------- | :--------------------------------------------------------------------------------------------------------------- |
| en                   | `0 B`, `512 B`, `1.0 KB`, `1.5 MB`, `100.0 MB` — the previous strings, unchanged                                 |
| de                   | `1,5 MB`, `100,0 MB` (browser locale is en-US in the test environment)                                           |
| fr                   | `1,5 MB`                                                                                                         |
| back to en           | `1.5 MB` again                                                                                                   |
| French session dates | the row renders `Created: <Intl fr dateStyle:medium/timeStyle:short>`, asserted different from the en-US default |

Full web suite: 146 files / 1455 tests. `tsc`, `eslint` and `prettier` clean.

## Out of scope

No unit-policy change (still binary/1024), no new date/number abstraction, and no
other `toLocaleString()` call sites: `grep` for `toLocaleString` under
`apps/web/src` outside this page returns none, so A10's anchors are closed.
