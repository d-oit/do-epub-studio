# GOAP Swarm: Close All Remaining Gaps (G20–G28 + Rate Limiter)

**Date:** 2026-06-15
**Strategy:** Hybrid — parallel swarm for independent gaps, sequential for dependent ones
**Goal:** Close all remaining gaps from the 2026-06-15 swarm analysis

## Wave 1 (Parallel — no dependencies)

| Gap | Task | Agent |
|-----|------|-------|
| **G20** | Move 5+ inline Zod schemas to `@do-epub-studio/schema` | general |
| **G24** | Add test for `routes/catalog.ts` | general |
| **G28** | Enforce reader side-panel mutual exclusivity | general |

## Wave 2 (Parallel — no dependencies)

| Gap | Task | Agent |
|-----|------|-------|
| **G25** | Create missing ADR files (ADR-092, ADR-068) | general |
| **G26** | Fix ADR number collisions + create ADR-INDEX.md | general |
| **G27** | Sync CHANGELOG.md and CONTRIBUTING.md | general |

## Wave 3 (Sequential — after Wave 1+2)

| Gap | Task | Agent |
|-----|------|-------|
| **G21** | Wire or delete orphan GrantForm/GrantList/BookSelector | general |
| **G23** | Add localStorage session token regression test | general |
| **Rate limiter** | In-memory → Durable Objects cutover | general |

## Wave 4 (Final)

| Task | Agent |
|------|-------|
| Run full quality gate | bash |
| Create PR with all changes | bash |
| Merge PR | bash |
