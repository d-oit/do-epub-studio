# GOAP-301: Strictness parity for `apps/web` and `apps/worker`

**Status:** PROPOSED
**Date:** 2026-10-02
**Type:** Follow-up corrective plan (authorized by ADR-300)
**ADRs referenced:** ADR-300 (typecheck scope + strictness parity), ADR-024
(warning management), ADR-083 (numbering)
**Source findings:** ADR-300 § Context 1 — the workspace packages
`apps/web` and `apps/worker` do not extend `tsconfig.base.json`, so the
`noUncheckedIndexedAccess` flag the base enables is not enforced for them. A
single ad-hoc root `tsc` run measured ~260 latent findings in those two
packages (≈190 in `apps/web`, ≈70 in `apps/worker`), invisible to every gate
because their own tsconfigs are authoritative and a root sweep no longer
re-checks them (ADR-300).

## Goal

Make the strictness policy for the two app packages explicit and enforced:
either they inherit the base compiler options (with the latent findings fixed
in the same slice), or the opt-out is recorded as a deliberate, per-package
decision with the reasoning — and a gate that keeps the choice from drifting.

## Why this is a separate slice

The findings are not mechanical noise: `noUncheckedIndexedAccess` changes the
type of every index access, so each site needs a real decision (guard, `?.`,
`??` default, or a narrowed local). ~83 of them are in package **source**
(not tests), and the worker's are in request-handling paths. Folding that into
an unrelated corrective slice would mix an annotation-sync fix with a
repository-wide typing decision and make the diff unreviewable.

## Phases

1. **Decide the target.** Options: (a) both app packages extend
   `tsconfig.base.json` and adopt `noUncheckedIndexedAccess`;
   (b) the two packages adopt the flag but keep their own `lib`/`jsx`/`types`
   overrides (recommended — apps need DOM/React or Workers types the base does
   not declare); (c) the opt-out is documented here and in the package configs
   as intentional. Record the outcome in ADR-300.
2. **Fix the source sites first** (≈83): `apps/web/src/{lib,stores,features,i18n}`
   and `apps/worker/src/{lib,routes}`. Each site must keep its behaviour:
   indexing that can genuinely be out of range needs a guard, not `??` noise.
3. **Fix the test sites** (≈177): mostly index access on assertion targets
   (`expect(rows[0].id)`) — optional chaining or a `first(...)` helper, never a
   non-null assertion (the lint gate bans it outside `apps/tests`).
4. **Enforce it.** Enable the flag in the two package tsconfigs and add the
   root/e2e typecheck lane decision from ADR-300 § Decision 4 to CI only if the
   plan adopts (a) or (b); a lane that no one can pass yet is worse than none.
5. **Verify.** `pnpm turbo run typecheck --force`, `pnpm lint`, both package
   unit suites, and a re-run of the ad-hoc root `tsc --noEmit` to show it stays
   clean (per ADR-300 the root config no longer covers these packages, so the
   proof is the per-package run plus a one-off strictness probe).

## Acceptance

- The chosen policy is written in ADR-300, and the two package tsconfigs match
  it — no package is left in an undocumented middle state.
- If the flag is adopted: zero `noUncheckedIndexedAccess` findings under both
  packages, all unit suites green, no behavioural change in app source.
- If the opt-out is chosen: the ADR states why, and a comment in each package
  tsconfig points at the ADR so the next author does not re-litigate it.

## Non-goals

- Re-scoping the root `tsconfig.json` again (settled by ADR-300).
- Enabling other base-only options (`forceConsistentCasingInFileNames`) as a
  drive-by; fold them into phase 1's decision if that is the chosen route.
