# epub-accessibility — Repo Guide

## Standards baseline (ADR-1017)

- **EPUB 3.3** and **EPUB Accessibility 1.1**: W3C Recommendation baselines (normative).
- **EPUB 3.4** (Candidate Recommendation Draft, 2026-11-02) and **EPUB Accessibility 1.2** (Candidate Recommendation Draft, 2026-09-12): forward-looking signals only, never normative replacements.
- EPUBCheck 5.4.0 conformance checks stay separate from actual `@intity/epub-js` reader rendering; unsupported behavior yields a controlled explanation, never a false capability claim.

## Evidence taxonomy

| Evidence type | Source | Recorded as |
|---|---|---|
| Metadata claims | OPF package document (`parseAccessibilityFromOpf`) | claims + provenance |
| Structural advisories | Machine-checkable (nav, landmarks, page-list) | advisories |
| Manual review | Human procedures on publication content | statuses (e.g., reviewed/not reviewed) |
| Reader-UI accessibility | axe on app-owned UI, manual keyboard/AT checks | separate findings |

Recompute when revision bytes change. Remediation state is bounded and never inferred from EPUBCheck severity alone.

## Report wording rules

- State explicitly: "This report is evidence, not certification."
- Name the baseline (EPUB Accessibility 1.1) and flag draft signals (1.2) as non-normative.
- Never invent NVDA/VoiceOver evidence; record actual environments.
- Never equate an automated (axe) pass with content conformance.

## i18n mechanics

New user-facing report strings must be added to `apps/web/src/i18n/en.ts` AND all 12 non-English locale files (`ar de es fr hi it ja ko nl pt ru zh`) in the same change. Parity is typechecked (`Record<TranslationKeys, …>`), so a missing locale breaks the web typecheck.

## Verification

```bash
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/reader-core exec vitest run src/__tests__/epub-accessibility.test.ts
node scripts/check-standards-status.mjs
```
