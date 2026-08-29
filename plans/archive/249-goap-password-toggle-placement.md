# GOAP-249: Password Toggle Placement Regression Fix

**Date:** 2026-08-20
**Status:** COMPLETED
**Related:** ADR-249, ADR-245, ADR-063a

## Goal

Make the shared show/hide password control render on the login field's
left/leading edge, document the contract before implementation, and prevent a
future visual regression with unit and browser geometry assertions.

## Evidence

| Surface | Evidence | Finding |
| --- | --- | --- |
| Live login page | `https://do-epub-studio.pages.dev/login` inspected with `agent-browser` | The password field exposes a `Show password` button inside the field; placement was not governed by a documented geometry contract. |
| Shared component | `packages/ui/src/input.tsx` | Toggle uses trailing/right positioning and trailing padding. |
| Unit tests | `packages/ui/src/__tests__/Input.test.tsx` | Toggle semantics are covered, but rendered left-side placement is not. |
| Browser tests | `apps/tests/viewport-regression.spec.ts`, `apps/tests/viewport-matrix.ts` | The shared viewport matrix now verifies geometry and the show/hide round trip at every standard size. |

## Execution order

| Phase | Task | Dependency | Gate |
| --- | --- | --- | --- |
| 1. Contract | Update `DESIGN.md`, ADR-249, this plan, reader UI regression guidance, and browser-skill verification guidance. | None | Placement, spacing, RTL, a11y, and geometry requirements are explicit. |
| 2. Tests first | Add unit and Playwright assertions for start/left placement before changing the component. | Phase 1 | New tests fail against the current trailing/right implementation. |
| 3. Implementation | Move the shared toggle to the logical start edge and swap reserved padding to the start side. | Phase 2 | Existing toggle behavior and all auth consumers remain intact. |
| 4. Verification | Run focused UI/web tests, typecheck/lint, quality gates, then inspect the deployed/local page with `agent-browser`. | Phase 3 | Tests pass and browser bounding boxes prove the control is left/leading. |
| 5. Synthesis | Record non-obvious learnings and update this plan to COMPLETED with evidence. | Phase 4 | No undocumented runtime or test constraint remains. |

## Verification

- `@do-epub-studio/ui` Input tests: 15/15 passed.
- Web auth tests: 58/58 passed.
- Chromium Playwright placement and show/hide test: passed.
- iPhone Playwright placement and show/hide test: passed.
- Web typecheck and production build: passed.
- The browser geometry assertion uses the input's left/leading half and passed
  against the production preview bundle.
- Shared Playwright login helpers and affected auth specs use role-specific
  textbox locators, preventing the toggle's accessible name from causing
  strict-mode collisions.
- `QUALITY_GATE_NO_SMOKE=1 ./scripts/quality_gate.sh` passed; the repository's
  dev smoke lane remains Worker-dependent and is covered by its dedicated CI
  job per existing gate policy.
- Existing responsive placement matrix now covers and passed all 8 viewports:
  320×568, 375×812, 390×844, 768×1024, 1024×768, 1440×900,
  1920×1080, and 812×375 landscape mobile.
- `packages/ui/src/__stories__/Input.stories.tsx` now includes a password
  visibility story for the existing Chromatic visual-regression workflow.
- Full local preview cross-browser run: 498 passed, 60 intentional skips; the
  one transient WebKit settings-panel race was isolated and the shared toolbar
  helper now waits for the lazy reader-toolbar mount. The focused WebKit test
  passed 5/5 repetitions after the hardening.
- Cloudflare deployment remains blocked by expired local Wrangler credentials;
  no production or preview deployment was performed.

## Risk controls

- Keep the existing localized visible label and accessible name.
- Use semantic tokens only; no new colors or hardcoded environment URLs.
- Keep the button outside the input's text flow and reserve enough start-side
  padding for the longest supported locale.
- Verify both normal and narrow layouts; do not rely on DOM order alone.
- Do not log or add password values to tests, plans, screenshots, or telemetry.

## Acceptance criteria

- The toggle is visually on the left/leading half of the password field.
- The input's typed value has clear space and is never covered by the control.
- Show/hide behavior, keyboard activation, accessible name, and `aria-controls`
  continue to pass.
- Focus-visible styling and minimum touch target remain intact.
- Focused tests, typecheck, lint, quality gate, and browser verification pass.
