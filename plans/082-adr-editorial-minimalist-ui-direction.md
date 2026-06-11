# ADR 082 — Editorial Minimalist UI Direction + Feature Priorities

**Date:** 2026-06-11
**Status:** Accepted
**Supersedes:** Glassmorphism-heavy design approach

---

## Context

The codebase uses 2024-era glassmorphism (backdrop-blur, color-mix transparency,
glass-panel utilities) as its primary surface treatment. 2026 design research
indicates this approach is dated, performance-costly, and produces AI-slop when
used as the default rather than an intentional accent. Additionally, several
core features expected in a reading app are missing (library, search, offline UI).

## Decisions

### 1. Art Direction: Editorial Minimalist

**Structure first → Typography → Content → Surfaces → Accent → Motion → Imagery**

This sequence forces quality at each layer before decoration is applied.
If the interface works in warm monochrome with good typography, it has a spine.

### 2. Surface Treatment: Solid over Glass

- **Default surfaces:** Solid OKLCH tokens (`--color-surface`, `--color-bg`)
- **Glass reserved for:** Reader toolbar only (functional use — content shows through)
- **Rationale:** Glass is expensive (GPU compositing), adds visual noise, hides
  weak information architecture under translucent prettiness

### 3. Glassmorphism Deprecation

| Component | Before | After |
|-----------|--------|-------|
| Error boundary | `glass-panel` | Solid card + `--shadow-md` |
| Catalog cards | `glass-card backdrop-blur` | Flat card + 1px border |
| Loading states | Glass container | Simple surface + skeleton |
| Login card | `bg-surface/40 backdrop-blur` | `bg-surface` solid |

### 4. Color Palette Shift

- **Remove:** Purple accent `oklch(54.1% 0.247 293)` — identified as AI-slop indicator
- **Primary:** Warm teal `oklch(55% 0.12 185)` — calmer, more editorial
- **Neutrals:** Warm-tinted (slight hue toward 80° warmth)
- **Rationale:** Purple/blue gradients are the #1 signal of auto-generated UI per
  2026 design research. A reading studio needs calm, warm, focused tones.

### 5. Typography: Branded Stack

| Role | Font | Usage |
|------|------|-------|
| Display | Cabinet Grotesk | Headings ≥ var(--text-xl) |
| Body/UI | Satoshi | All interface text, buttons, labels |
| Reader | Source Serif 4 | EPUB content rendering only |
| Mono | JetBrains Mono | Code, trace IDs, technical data |

- **Drop:** Inter as sole font (generic, AI-default)
- **Fluid:** All sizes via `clamp()` — no fixed px/rem

### 6. Motion: Restrained + Purposeful

- Hover lifts max `translateY(-2px)` (was -4px — too aggressive)
- Transitions 180-200ms with `ease-out-expo`
- Spring physics only for direct interaction (buttons, toggles)
- Page transitions remain View Transitions API (fade)
- No bouncing dots, particle effects, or gratuitous entrance animations

### 7. Feature Priority for Next Sprint

| Priority | Feature | Rationale |
|----------|---------|-----------|
| P0 | Library/Bookshelf page | Core UX — nowhere to go post-login |
| P0 | Toast system integration | Error/success feedback completely missing |
| P1 | Search (⌘K) | No discoverability path for content |
| P1 | Offline download UI | Infrastructure exists, no trigger |
| P2 | Empty states | No guidance for zero-data screens |
| P2 | Keyboard shortcuts overlay | Undiscoverable shortcuts |
| P3 | User profile/settings | Non-critical but expected |
| P3 | Reading statistics | Nice-to-have |

### 8. Container Queries Adoption

- Book grids, reader panels, and card wrappers get `container` declarations
- Component-level responsiveness replaces viewport-only breakpoints
- Progressive enhancement (base layout works without container support)

## Consequences

- All existing glassmorphism usage must be migrated (except reader toolbar)
- Purple accent color removed from tokens — may affect dark theme visual identity
- Font loading adds 3 additional font requests (mitigated by preconnect + swap)
- New feature pages (Library, Search, Profile) need routing + API endpoints
- Catalog cards will look visually different (flatter, more editorial)
- Hover animations become more subtle across all interactive elements

## Compliance

- Aligns with AGENTS.md Tier 3: OKLCH tokens, View Transitions, anti-ai-slop
- Aligns with ADR-063: Semantic design tokens for WCAG compliance
- Aligns with ADR-079: 2026 web platform standards adoption
