---
version: "1.0.0"
name: impeccable
description: >
  Design guidance for AI coding agents. 23 commands, 44 deterministic detector rules,
  and live browser iteration for AI-generated frontend design. Activate for UI/UX design
  work, anti-pattern detection, or design quality audits.
category: quality
allowed-tools: Read Write Edit Grep Glob Bash
license: Apache-2.0
---

# Impeccable — Design Quality Skill

Design guidance system with 23 commands and 44 deterministic detector rules for catching AI-generated frontend design anti-patterns.

## Project Integration

This project installs Impeccable as a git submodule at `.impeccable/` (pinned to `cli-v3.1.0`). The detector runs in CI via `scripts/run-impeccable.sh` and is integrated into the quality gate.

| Resource | Location |
|----------|----------|
| Config | `.impeccable/config.json` |
| CI Script | `scripts/run-impeccable.sh` |
| Design Language | `DESIGN.md` |
| Quality Gate | `scripts/quality_gate.sh` |

## Quick Start

```bash
# Run detector (CI-friendly JSON output)
npx impeccable detect --json .

# Run detector with verbose output
npx impeccable detect .

# Check specific directory
npx impeccable detect apps/web/src/
```

## Commands

### Core Workflow

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/impeccable craft <Comp>` | Full shape-then-build flow with visual iteration | Building new UI components |
| `/impeccable shape <area>` | Plan UX/UI before writing code | Before implementing features |
| `/impeccable build <area>` | Execute from shape plan | After shaping |
| `/impeccable iterate <area>` | Refine existing implementation | Improving current UI |

### Quality & Review

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/impeccable audit <area>` | Technical quality: a11y, performance, responsive | Pre-merge checks |
| `/impeccable critique <area>` | UX review: hierarchy, clarity, emotion | Design review |
| `/impeccable polish <area>` | Final pass before shipping | Release prep |
| `/impeccable distill <area>` | Strip to essence | Simplifying complex UI |

### Refinement

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/impeccable bolder <area>` | Amplify boring designs | Adding visual interest |
| `/impeccable quieter <area>` | Tone down overly bold designs | Reducing visual noise |
| `/impeccable colorize <area>` | Introduce strategic color | Adding color accents |
| `/impeccable typeset <area>` | Fix font choices, hierarchy, sizing | Typography improvements |
| `/impeccable layout <area>` | Fix layout, spacing, visual rhythm | Layout refinements |

### Polish & Edge Cases

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/impeccable harden <area>` | Error handling, i18n, text overflow | Production readiness |
| `/impeccable animate <area>` | Add purposeful motion | Adding transitions |
| `/impeccable delight <area>` | Add moments of joy | Micro-interactions |
| `/impeccable clarify <area>` | Improve unclear UX copy | UX writing fixes |
| `/impeccable adapt <area>` | Adapt for different devices | Responsive design |
| `/impeccable optimize <area>` | Performance improvements | Speed optimization |

### Setup & Documentation

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/impeccable init` | One-time setup: gather design context | Project onboarding |
| `/impeccable document` | Generate root DESIGN.md from existing code | Documentation |
| `/impeccable extract` | Pull reusable components into design system | Component extraction |
| `/impeccable live` | Visual variant mode in browser | Live iteration |

## Detector (44 Rules)

The deterministic detector catches AI slop patterns without LLM calls:

### Slop Rules

- **side-tab**: Side-stripe borders (most recognizable AI tell)
- **purple-gradient**: Purple-to-blue gradients
- **bounce-easing**: Bounce/elastic animations
- **dark-glow**: Dark mode with purple glow
- **overused-font**: Inter/system defaults as primary font
- **icon-tile-stack**: Rounded-square icon tile above headings
- **nested-cards**: Cards inside cards
- **gray-on-color**: Gray text on colored backgrounds
- **small-touch**: Touch targets under 44px
- **cramped-padding**: Insufficient spacing

### Quality Rules

- **line-length**: Text lines exceeding 75ch
- **skipped-headings**: Missing heading levels (h1 → h3)
- **low-contrast**: Insufficient color contrast
- **pure-black**: Using #000000 or #ffffff without tinting
- And 30+ more rules covering typography, spacing, color, and layout

## Configuration

### `.impeccable/config.json`

```json
{
  "detector": {
    "designSystem": { "enabled": true },
    "ignoreFiles": [
      ".impeccable/**",
      "**/coverage/**",
      "**/node_modules/**"
    ],
    "ignoreRules": [],
    "ignoreValues": []
  }
}
```

This project excludes:
- `.impeccable/**` — the detector's own code
- `**/coverage/**` — generated test coverage reports
- `**/node_modules/**` — dependencies

### Inline Waivers

Add to any file to suppress specific findings:

```html
<!-- impeccable-disable overused-font: exported brand doc -->
```

Or for a single line:

```html
<!-- impeccable-disable-line purple-gradient -->
```

## CI Integration

### Quality Gate

```bash
# Default: warnings only
./scripts/quality_gate.sh

# Skip design checks
SKIP_DESIGN=1 ./scripts/quality_gate.sh

# Promote findings to errors
IMPECCABLE_REQUIRED=1 ./scripts/quality_gate.sh
```

### Direct Script Usage

```bash
# Warnings only (default)
./scripts/run-impeccable.sh

# Required mode (exits non-zero on findings)
./scripts/run-impeccable.sh --required
```

## Workflow Integration

### Before UI Work

1. `/impeccable shape <area>` — Plan the UX/UI
2. Implement the component
3. `/impeccable audit <area>` — Check quality
4. `/impeccable polish <area>` — Final pass

### In PR Reviews

1. Run `npx impeccable detect --json .` to check for findings
2. Review any flagged anti-patterns
3. Apply fixes or document suppressions

### Pre-Commit

```bash
./scripts/quality_gate.sh  # includes impeccable check
```

## Related Skills

| Skill | Relationship |
|-------|--------------|
| `anti-ai-slop` | LLM-based critique (this skill = deterministic backbone) |
| `code-quality` | Code smells (this skill = design anti-patterns) |
| `reader-ui-ux` | Reader-specific UI work (uses this skill's commands) |
| `accessibility-auditor` | A11y audit (this skill catches design issues) |

## Anti-Pattern Quick Reference

| Pattern | Why It's Bad | Fix |
|---------|--------------|-----|
| Purple gradient | Default AI palette | Use project color tokens |
| Inter font | Overused since 2025 | Choose contextual fonts |
| Nested cards | Visual clutter | Flat hierarchy |
| Gray on color | Poor contrast | Use semantic tokens |
| Bounce easing | Feels dated | Use ease-out curves |
| Side borders | Most recognizable AI tell | Full borders or icons |

## Summary

Impeccable provides deterministic design quality checks that catch AI-generated anti-patterns. Use the 23 commands for design workflow, the 44 detector rules for automated checks, and the CI integration for quality gates. Project tokens in `globals.css` remain authoritative.