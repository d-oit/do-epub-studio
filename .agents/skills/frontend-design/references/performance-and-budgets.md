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

### Route-total deltas: attribute before touching anything

The baseline table (`Total Δ`) measures the transitive closure seeded with
ALL entry chunks, so a route "total" can jump ~78% with `Entry Δ ≈ 0` while
**no per-file budget is violated**. Before any split/baseline work:

1. **Attribute the delta chunk-by-chunk** against a clean-base control build
   (`git worktree add /tmp/base origin/main && pnpm install && pnpm build`
   there, then diff per-chunk gzip by normalized filename). Never eyeball
   chunk names — hunks differ per build.
2. **Check for static edges**: one `index → reader-route` import in the
   manifest drags the whole lazy route chunk (incl. `reader-core`, ~90KB
   gzip) into every route's total. Suspects: shell hooks statically
   importing a feature barrel; `manualChunks` pinning a module into the
   wrong chunk (pins beat dynamic imports for placement).
3. **Fix mechanics**: dynamic-import the heavy barrel from shell code; pin
   only small genuinely-shared modules (`src/stores/` → neutral
   `app-shared`); keep cross-chunk references type-only.
4. **Never raise budgets or silently regen baselines** for avoidable
   static-edge weight; a deliberate feature weight that survives attribution
   gets a documented, justified baseline regen in the PR.
5. `@vitejs/plugin-react` bumps can change transform behavior — when a budget
   breach coincides with a dependency bump, attribute with a control build on
   the old lockfile before blaming the code.

## Evaluation & Skill Lift (SkillEvaluator Integration)

When evaluating `frontend-design` outputs, measure effectiveness using NVIDIA SkillEvaluator's multi-tier criteria:
- **Tier 1 (Validation)**: Confirm code contains no un-sanitized scripts, hardcoded hex colors, or invalid Tailwind syntax.
- **Tier 2 (Deduplication)**: Ensure new UI implementations reuse primitives from `@do-epub-studio/ui` rather than duplicating existing components.
- **Tier 3 (Skill Lift & Dimensions)**: Measure Correctness (OKLCH token usage and responsive grid layout), Effectiveness (WCAG compliance and container queries), and Efficiency (zero unnecessary dependencies or bundle inflation).

## Attention Budget Optimization (`asm` Integration)

- Keep the frontmatter description in `SKILL.md` under 200 characters to ensure minimal resident context cost across agent providers.
- Maintain L3 on-demand reference loading via progressive disclosure to prevent context bloat during model execution.
