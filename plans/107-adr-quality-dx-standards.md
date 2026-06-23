# ADR-107: Quality Gate Escalation and DX Standards

**Date:** 2026-06-23
**Status:** Proposed
**Deciders:** Project maintainer
**Related:** ADR-021 (Test Infrastructure), ADR-022 (Coverage/Benchmarking)

## Context

Current coverage thresholds are minimal for newer packages (`ui`: 10%/5%,
`schema`: 15%/5%) and the test suite lacks interaction testing, accessibility
assertions, and several e2e user flows. As plans 105-106 add features,
regression risk increases without proportional test coverage growth.

## Decision

### Coverage Threshold Escalation

Thresholds are raised in phases, gated by plan execution:

| Package | Current | After Plan 107 Phase 1-2 | Target (0.2.0) |
|---------|---------|--------------------------|----------------|
| `ui` | 10% L / 5% F | 40% L / 30% F | 60% L / 50% F |
| `worker` | 55% L / 50% F | 65% L / 60% F | 75% L / 70% F |
| `web` | 55% L / 48% F | 60% L / 55% F | 70% L / 65% F |
| `shared` | 40% L / 50% F | 50% L / 55% F | 60% L / 60% F |
| `schema` | 15% L / 5% F | 30% L / 20% F | 50% L / 40% F |

Threshold bumps are committed only AFTER the tests that meet them ship.

### Testing Standards for New Code

1. **Every UI component:** render test + interaction test + `axe-core` a11y assertion
2. **Every API route:** happy path + auth guard + validation error + tenant isolation
3. **Every Zustand store:** state transition test + selector test
4. **Every hook:** unit test with `renderHook` + cleanup verification

### DX Standards

1. **Bundle size budget** enforced in CI (not just script). Threshold:
   - Main JS: 180 KB gzipped
   - Main CSS: 30 KB gzipped
   - Any single lazy chunk: 80 KB gzipped

2. **Visual regression** baselines stored in `playwright-report/baselines/`
   and updated via `pnpm visual:update` script.

3. **Storybook coverage**: every `packages/ui` export has a corresponding
   `.stories.tsx` file. CI validates this via a script.

4. **API types**: typed API client generated from Hono route definitions,
   ensuring frontend-backend type safety without manual DTO duplication.

## Consequences

- Higher confidence in shipping features from plans 105-106
- CI becomes stricter — may initially slow PRs until thresholds met
- Bundle budget prevents accidental bloat from new UI patterns
- Visual regression catches CSS token changes that break theming
- API type generation reduces class of bugs where frontend/backend drift
