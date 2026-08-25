# Performance & Budget Validation

## Budget Constraints

Frontend changes must conform to the defined performance thresholds:

- **`.performance-budgets.json`**: Specifies maximum allowable asset sizes and bundle metrics per route/chunk.
- **`bundle-baseline.json`**: Tracks baseline bundle sizes across builds.
- **Lighthouse CI**: Enforces route-specific performance budgets (catalog, admin, auth, offline routes).

## Validation Rules

1. **No Direct Asset Inflation**: Avoid importing heavy 3rd-party dependencies (e.g. Framer Motion, Lodash, large icon sets) when native CSS/JS utilities exist.
2. **Virtualization**: Any dynamic list rendering more than 50 items must use list virtualization (`VirtualList`).
3. **Optimized Traversal**: Perform DOM traversals and text scanning with native TreeWalker / String methods to avoid runtime overhead.
4. **Verification**: After significant UI changes, run `./scripts/check-bundle-budget.mjs` or `pnpm build` to ensure bundle baselines remain within budget limits.

## Evaluation & Skill Lift (SkillEvaluator Integration)

When evaluating `frontend-design` outputs, measure effectiveness using NVIDIA SkillEvaluator's multi-tier criteria:
- **Tier 1 (Validation)**: Confirm code contains no un-sanitized scripts, hardcoded hex colors, or invalid Tailwind syntax.
- **Tier 2 (Deduplication)**: Ensure new UI implementations reuse primitives from `@do-epub-studio/ui` rather than duplicating existing components.
- **Tier 3 (Skill Lift & Dimensions)**: Measure Correctness (OKLCH token usage and responsive grid layout), Effectiveness (WCAG compliance and container queries), and Efficiency (zero unnecessary dependencies or bundle inflation).

## Attention Budget Optimization (`asm` Integration)

- Keep the frontmatter description in `SKILL.md` under 200 characters to ensure minimal resident context cost across agent providers.
- Maintain L3 on-demand reference loading via progressive disclosure to prevent context bloat during model execution.
