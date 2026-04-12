---
version: "1.0.0"
name: anti-ai-slop
description: >
  Audit and fix UI/copy to avoid generic AI aesthetic. Activate for "too generic",
  "humanize this", "AI slop", or when producing new UI, copy, or UX flows.
category: quality
allowed-tools: Read Write Edit
license: MIT
---

# Anti-AI-Slop Skill

Systematic antidote to the 2024-2026 AI aesthetic monoculture.

## How to Use

1. **Audit mode** - User shares existing UI/copy/UX. Run through diagnostic checklists.
2. **Creation mode** - User wants new UI/copy/flow. Read "What to do instead" first.
3. **Spot-fix mode** - User points to one element. Diagnose, explain why it's sloppy, rewrite.

Always **name the sin** before fixing it.

## UI Anti-Patterns

| Pattern | What it looks like | Why it's slop |
|---|---|---|
| Purple gradient hero | `#7c3aed` to `#2563eb` on white | Default Tailwind AI app palette |
| Glassmorphism cards | Frosted glass, backdrop-blur | Overused since iOS 15 |
| Rounded everything | border-radius 24px+ on every element | Removes personality |
| Inter / DM Sans / Space Grotesk | Default "modern" sans | Signals "AI-generated UI" |
| Emojis as icons in headers | Supercharge your workflow | Startup theater |
| Three-column feature grid | Icon + bold label + 1 sentence | Every SaaS landing page since 2019 |
| CTA: "Get started for free" | Large button, primary color | Meaningless |
| Dark mode = black bg + purple accent | `#0f0f0f` + `#8b5cf6` | Vercel clone aesthetic |

### What to Do Instead

- **Typography first.** Choose fonts specific to context. Never use "because it's clean."
- **Commit to one extreme.** Brutally minimal OR maximally dense.
- **Use real color theory.** Complementary pairs, not "purple because AI."
- **Space is a design element.** Generous negative space with one dense anchor.
- **Reference actual design movements.** Swiss grid, Bauhaus, Brutalist web.

## UX Anti-Patterns

| Pattern | What it looks like | Why it's slop |
|---|---|---|
| Onboarding modal on first load | "Welcome! Let's get you set up" | Interrupts before user has context |
| 5-step onboarding wizard | Progress bar, confetti at end | Treats users as suspects |
| "Are you sure?" confirm dialogs | Modal for every delete | Trust issues. Use undo instead. |
| Toast notifications for everything | "Saved!", "Deleted!", "Updated!" | Noise. Users learn to ignore. |
| Form with 8+ fields to get started | Giant form before value | Commitment before value. Backwards. |

### What to Do Instead

- **Don't teach the UI - fix the UI.** If users need a tour, the interface is unclear.
- **Undo over confirm.** 5-10 second undo window on destructive actions.
- **Progressive disclosure.** Start with minimum viable form.
- **Optimistic UI.** Show outcome immediately, reconcile in background.
- **Contextual notifications.** Surface feedback inline, near the action.

## Copy Anti-Patterns

### Hollow Affirmations

"Absolutely!", "Certainly!", "Great question!", "I'd be happy to help"
**Fix:** Delete them. Start with the actual content.

### AI Corporate Superlatives

"Powerful", "seamless", "intuitive", "robust", "next-generation", "supercharge"
**Fix:** Replace with specific claims. What does it actually do?

### The Listicle Reflex

AI defaults to bullet points for everything.
**Fix:** Write prose. Use lists only when scanning adds value.

### Transition Theater

"In conclusion...", "It's worth noting that...", "At the end of the day..."
**Fix:** Just say the thing.

### Emoji Inflation

Using emojis as substitutes for meaning.
**Fix:** Zero emojis unless genuinely casual/social context.

## Audit Workflow

1. **Scan for patterns.** Check UI, UX, Copy canons. List every match.
2. **Score severity.** Structural (redesign needed), Surface (easy fix), Cosmetic (polish).
3. **Prioritize.** Fix structural first.
4. **Rewrite/redesign.** Provide specific replacement for each flagged item.
5. **Explain the why.** Name the design principle behind each fix.

## Positive Doctrine

- **Specificity > universality.** Design for this user, this task, this moment.
- **Tension is interest.** Contrast, asymmetry, deliberate friction.
- **Constraints create identity.** The best brands have rules.
- **Respect the user's time.** Every click, form field, modal is a tax.
- **Be opinionated.** Show users the best path.
- **Specific > general.** "Saves 3 hours per week" > "Saves time"
- **Active > passive.** "We deleted it" > "It was deleted"
- **Short > long.** Cut every word that doesn't earn its place.
