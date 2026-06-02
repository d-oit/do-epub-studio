---
name: do EPUB Studio
description: A production-grade EPUB reading and editorial workspace.
colors:
  background: "oklch(100% 0 0)"
  foreground: "oklch(15% 0 0)"
  accent: "oklch(55% 0.15 250)"
  accent-error: "oklch(65% 0.2 25)"
  border: "oklch(92% 0 0)"
  surface: "oklch(14.5% 0 0)"
typography:
  display:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
  body:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  lg: "0.5rem"
  xl: "0.75rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "white"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  card-default:
    backgroundColor: "oklch(97% 0 0)"
    rounded: "{rounded.xl}"
---

# Design System: do EPUB Studio

## 1. Overview

**Creative North Star: "The Editorial Command Center"**

`do EPUB Studio` is designed to be a high-performance, distraction-free environment for both consumption and creation. The system prioritizes clarity and legibility, ensuring that the interface recedes to let the content—the book—take center stage. The aesthetic philosophy is "Intentional Utility": every line, color, and transition exists for a reason, rooted in the 2026 standards of accessibility and performance.

The system explicitly rejects "glassmorphism" and "ghost cards" as default patterns, favoring solid surfaces and clear boundaries to communicate security and reliability.

**Key Characteristics:**
- High legibility via OKLCH color space.
- Subtle, purposeful motion for state changes.
- Stable, rigid layouts with generous whitespace.

## 2. Colors

The palette is anchored in a deep electric blue accent that signals action and focus, balanced by neutral tones for long-form reading.

### Primary
- **Focus Accent** (oklch(55% 0.15 250)): Used for primary actions, progress indicators, and active states. It represents the "energy" of the workspace.

### Neutral
- **Page Background** (oklch(100% 0 0)): A pure white base for the cleanest reading experience.
- **Deep Lacquer** (oklch(15% 0 0)): Used for body text to ensure high contrast and reduced eye strain.
- **Subtle Surface** (oklch(97% 0 0)): Secondary backgrounds and card fills.

### Named Rules
**The High-Contrast Rule.** All text must maintain a minimum contrast ratio of 4.5:1. Never use muted gray text on secondary surfaces for long-form content.

## 3. Typography

The system uses a robust `system-ui` stack to ensure native performance and familiar weight across all platforms.

**Display Font:** system-ui
**Body Font:** system-ui

### Hierarchy
- **Display** (600, 1.5rem, 1.2): Used for page titles and major headers.
- **Headline** (600, 1.125rem, 1.25): Section headers.
- **Body** (400, 0.875rem, 1.5): The default for all interface and editorial text. Max measure 65–75ch.
- **Label** (500, 0.75rem, 1, 0.05em, uppercase): Used for badges, buttons, and secondary metadata.

## 4. Elevation

The system is primarily flat, using tonal layering (background → background-secondary) to convey depth. Shadows are reserved for floating elements like Modals and Tooltips.

### Shadow Vocabulary
- **Modal Shadow** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1)`): Used to lift overlay elements above the workspace.

## 5. Components

### Buttons
- **Shape:** Softened edges (8px radius).
- **Primary:** Background uses Focus Accent, white text, 0.5rem 1rem padding.
- **Hover / Focus:** Scale slightly (1.02) and brighten background on hover; clear 2px ring on focus.

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** Usually oklch(97% 0 0).
- **Internal Padding:** 1rem to 1.5rem.

### Inputs / Fields
- **Style:** 1px border-border, background oklch(100% 0 0), 8px radius.
- **Focus:** 3px ring of Focus Accent at 15% opacity.

## 6. Do's and Don'ts

### Do:
- **Do** use `oklch()` for all new color declarations.
- **Do** ensure touch targets are at least 44px on mobile devices.
- **Do** provide a branded loading state for every async action.

### Don't:
- **Don't** use border-left greater than 1px as a colored accent stripe.
- **Don't** use "ghost-card" patterns (1px border + massive soft shadow).
- **Don't** use `border-radius` greater than 16px on cards or inputs.
