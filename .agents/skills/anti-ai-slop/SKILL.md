---
version: "1.0.0"
name: anti-ai-slop
description: >
  Apply this skill whenever the user wants to audit, fix, redesign, write, or review UI, UX, copy, or text to avoid the generic "AI slop" aesthetic of 2025–2026.
category: quality
allowed-tools: Read Write Edit Glob Grep
license: MIT
---

# Anti-AI-Slop Skill — 2026 Edition

AI tools flooded the design and copy space. The result: a recognizable monoculture. This skill is a systematic antidote.

## How to Use This Skill

- **Audit mode** — Run through the diagnostic checklists. Name the sin before fixing it.
- **Creation mode** — edit_file work that avoids all listed patterns.
- **Spot-fix mode** — Diagnose specific element, explain why it's sloppy, rewrite/redesign it.

## Part 1 — AI-Slop UI Patterns

### The Canon of Slop

| Pattern | What it looks like | Why it's slop |
|---------|-------------------|---------------|
| **Purple gradient hero** | `#7c3aed → #2563eb` on white bg | Default Tailwind AI app palette |
| **Glassmorphism cards** | Frosted glass, `backdrop-blur` | Overused since iOS 15 |
| **Rounded everything** | `border-radius: 24px+` | Removes personality |
| **Inter / DM Sans** | Default "modern" sans | Signals AI-generated UI |
| **Hero headline formula** | `[Verb] your [noun] with [product]` | Indistinguishable from 10,000 others |
| **Three-column feature grid** | Icon + bold label + 1 sentence | Every SaaS landing page |
| **CTA: "Get started for free"** | Large button, primary color | Meaningless |
| **Empty states with illustration** | Lottie animation or SVG blob | Cute once, now patronizing |
| **Dark mode = black + purple** | `#0f0f0f` + `#8b5cf6` | Hacker aesthetic |
| **Animated gradient text** | Moving rainbow on headline | Peak 2023 startup energy |

### What to Do Instead

- **Typography first.** Choose fonts specific to the context. Use serif with character for body.
- **Commit to one extreme.** Brutally minimal OR maximally dense. The middle is where slop lives.
- **Use real color theory.** Complementary pairs, analogous schemes. Not "purple because AI."
- **Reference actual design movements.** Swiss grid. Bauhaus. Brutalist web.

## Part 2 — AI-Slop UX Patterns

### The Canon of Slop

| Pattern | Why it's slop |
|---------|---------------|
| Onboarding modal on first load | Interrupts before context |
| 5-step onboarding wizard | Treats users as suspects |
| Tooltip tours | Teaches wrong interface |
| "Are you sure?" confirm dialogs | Trust issues. Use undo instead. |
| Generic empty states | Zero help |
| Toast notifications for everything | Noise. Users ignore them. |
| Search that requires exact match | Punishes user for trusting product |
| Form with 8+ fields to get started | Commitment before value |
| Hamburger menu on desktop | Discovery failure |

### What to Do Instead

- **Don't teach the UI — fix the UI.** If users need a tour, redesign.
- **Undo over confirm.** 5-10 second undo window on destructive actions.
- **Progressive disclosure.** Start with minimum viable form.
- **Optimistic UI.** Show outcome immediately, reconcile in background.

## Part 3 — AI-Slop Copy Patterns

### Hollow Affirmations

Words that exist only to fill space:
- "Absolutely!", "Certainly!", "Great question!"
- "Sounds great!", "That makes sense!"

**Fix:** Delete them. Start with actual content.

### AI Corporate Superlatives

- "Powerful", "seamless", "intuitive", "robust"
- "Cutting-edge", "state-of-the-art"
- "Supercharge your..."

**Fix:** Replace with specific claims. What does it actually do? By how much?

### Transition Theater

- "In conclusion...", "To summarize...", "In essence..."
- "It's worth noting that..."

**Fix:** Just say the thing. These delay the idea without adding.

### Emoji Inflation

Using 🚀 💡 ✨ ⚡ 🔥 as substitutes for meaning.

**Fix:** Use zero unless context is genuinely casual. If you use one, mean it.

### UX Writing Sins

| Sin | Example | Fix |
|-----|---------|-----|
| Error: blame user | "Invalid input" | "Email addresses need an @ sign" |
| CTA: describe UI action | "Click here" | "Download the report" |
| Success: announce action | "Saved!" | "Changes saved — live in 30 seconds" |
| Placeholder as label | Input with placeholder "Email" | Use a real label |

## Part 4 — Audit Workflow

- **Scan for patterns.** Check all canons. List every match by name.
- **Score severity:**
  - 🔴 **Structural** — Requires redesign. Fundamental problem.
  - 🟡 **Surface** — Easy fix. Wrong word or color.
  - 🟢 **Cosmetic** — Minor polish.

- **Prioritize.** Fix structural first.
- **Rewrite/redesign.** Specific replacement, not generic advice.

## Part 5 — The Positive Doctrine

### Design

- **Specificity > universality.** Design for this user, this task.
- **Tension is interest.** Contrast, asymmetry are memorable.
- **Constraints create identity.** Impose real restrictions.

### UX

- **Respect user's time.** Every click is a tax. Minimize it.
- **Be opinionated.** Show best path. Don't present 6 equal options.

### Copy

- **Specific > general.** "Saves 3 hours" > "Saves time"
- **Active > passive.** "We deleted it" > "It was deleted"
- **Short > long.** Cut every word that doesn't earn its place.
- **Write for one person.** Not "users". The specific human who will read this.

## EPUB Reader Specific

### Reader UI Anti-Patterns

| Pattern | Why it's slop |
|---------|---------------|
| Generic "Welcome" modal on first EPUB | Interrupts reading flow |
| Progress bar with percentage only | Should show chapter location |
| Settings hidden in hamburger menu | Accessibility fail on desktop |

## Integration

- **code-review-assistant**: Use in PR reviews
- **reader-ui-ux**: Apply to EPUB reader

## Quality Checklist

- [ ] No AI slop patterns identified, OR
- [ ] All identified patterns named and explained
- [ ] Specific replacements provided for each
- [ ] Design principles cited for changes

## Summary

Anti-slop is a discipline, not a style. Choose specificity over templates, tension over harmony, and respect for users over pleasing everyone.
