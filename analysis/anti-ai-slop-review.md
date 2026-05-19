# Anti-AI-Slop Copy Review

**Date:** 2026-05-19
**Scope:** `apps/web/src/i18n/en.ts`, `de.ts`, `fr.ts`
**Skill:** anti-ai-slop v1.0

## Summary

All three locale files (en, de, fr) are **clean** — no AI-slop patterns detected.

## Audit by Pattern

| Pattern | Found? | Notes |
|---------|--------|-------|
| Purple gradient hero | ❌ | No hero sections in i18n |
| Glassmorphism cards | ❌ | Not a copy concern |
| Rounded everything | ❌ | Not a copy concern |
| Inter / DM Sans | ❌ | Typography handled in CSS, not i18n |
| Hero headline formula | ❌ | No marketing headlines. Login subtitle is functional: "Sign in to access your books" |
| Three-column feature grid | ❌ | No feature grid in i18n |
| CTA: "Get started for free" | ❌ | CTAs are functional: "Sign In", "Create Book", "Save" |
| Empty states with illustration | ❌ | Empty states use text only |
| Animated gradient text | ❌ | Not a copy concern |
| Hollow affirmations | ❌ | No "Absolutely!", "Great question!", etc. |
| AI Corporate Superlatives | ❌ | No "powerful", "seamless", "intuitive", "robust" |
| Transition theater | ❌ | No "In conclusion", "To summarize" |
| Emoji inflation | ❌ | Zero emojis across all 3 locales |
| Generic error: blame user | ❌ | Errors are specific: "Failed to load grants", "Invalid email or password" |
| CTA: describe UI action | ❌ | CTAs describe outcome: "Create Book", not "Click here" |
| Placeholder as label | ❌ | All inputs have proper labels; placeholders supplement |

## One Minor Finding

The only generic string is `'common.error.generic': 'Something went wrong'` which serves as a safe fallback for unhandled errors. This is intentional — it's better to show something generic than nothing at all when the specific error cause is unknown.

If desired, this could be improved to: `"An unexpected error occurred. Please try again or contact support if the issue persists."` but this is a cosmetic preference, not an AI-slop fix.

## Verdict

**Copy quality: Good.** The i18n text is functional, specific, and avoids all identified AI-slop patterns. No changes required.

See `docs/coding-guide.md` and `AGENTS.md` for copy style guidance.
