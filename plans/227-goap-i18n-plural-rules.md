# GOAP 227: Wire Plural Rules Into Count Messages (ADR-199 follow-up)

**Date:** 2026-08-11
**Status:** In PR (one PR, atomic commits per logical change)
**Baseline:** `main` @ `d5f5e66` (post GOAP-226)
**Related:** ADR-199, Plan 214-R8, Plan 226, `plans/226-goap-verify-gap-closure.md`

## 1. Analysis

ADR-199 deferred plural-aware messages: Arabic/Russian/Hindi count strings
were grammatically wrong (`"3 minutes ago"` where Arabic needs a different
form) because the catalog format had no plural-category support. GOAP-226
shipped the `pluralize(locale, count, categories)` helper (plan 214-R8) but
did not wire it into the catalogs — the ADR-199 follow-up items 1–3 remained
open.

### Inventory (verified across all 13 locales)

Seven keys carry a `{count}` placeholder per locale:

| Key | Example (en) | Plural-sensitive? |
| --- | --- | --- |
| `comment.replies` | `{{count}} replies` | **Yes** — also has a `{{count}}` double-brace bug (renders literal `{N}`) |
| `offline.pendingSync` | `{count} pending sync` | **Yes** — singular/plural agreement |
| `reader.bookmarks_with_count` | `Bookmarks ({count})` | No — parenthetical badge, grammar-neutral |
| `annotation.comment_with_count` | `Comments ({count} open)` | No — parenthetical badge |
| `relativeTime.minutesAgo` | `{count}m ago` | No — abbreviated units don't inflect |
| `relativeTime.hoursAgo` | `{count}h ago` | No |
| `relativeTime.daysAgo` | `{count}d ago` | No |

`comment.replies` and `offline.pendingSync` currently have **no production
call sites** (dead keys), which is why the bug surface stayed invisible; they
still must be correct before any consumer wires them (ADR-199's own trigger:
the format must be ready before the keys are used).

### Format decision (records ADR-199 follow-up item 1)

**Chosen: structured plural variants in the existing catalogs**, resolved by
the shipped `Intl.PluralRules`-based `pluralize()` helper — no new dependency,
no 400-key ICU MessageFormat migration. A count-plural key's value becomes
`{ zero?, one?, two?, few?, many?, other: string }` (`other` required); every
other key stays a string. Full ICU MessageFormat via `@formatjs/...` remains
the documented option if the plural-key surface grows (recorded in ADR-199).

## 2. Implementation

| Task | Scope |
| --- | --- |
| T1 | `translate()` resolves object values: `pluralize(locale, count, categories)` for the `count` param, then substitute remaining params; type `TranslationValue = string \| PluralCategories` |
| T2 | Migrate `comment.replies` + `offline.pendingSync` to plural variants in **all 13 locales** (fixing `{{count}}` → `{count}`) |
| T3 | Parity test: value-shape parity per key across locales (string vs object; `other` always present; same category-key sets NOT required — ar needs zero/two, ru doesn't); **ADR-199 follow-up item 4**: reject new string keys containing `{count}` unless allowlisted (`relativeTime.*`, `*_with_count`) |
| T4 | Plural-resolution unit tests (en one/other; ru one/few/many; ar zero/one/two/few/many; hi one/other) |
| T5 | Docs: ADR-199 follow-up status, plan record, LEARNINGS |

## 3. Acceptance Criteria

- [ ] `translate('comment.replies', 'ru', { count: 3 })` → `3 ответа` (few), `count: 5` → `5 ответов` (many); ar zero/one/two correct
- [ ] All 13 locales have plural variants for `comment.replies` + `offline.pendingSync`; no `{{count}}` remains
- [ ] Parity test passes with shape parity; new string key with `{count}` outside the allowlist fails CI
- [ ] Existing i18n tests (parity, formatting, rendered-text) green
- [ ] `./scripts/quality_gate.sh` passes; PR CI green
