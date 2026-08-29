# ADR-249: Password Toggle Placement and Visual Regression Policy

**Date:** 2026-08-20
**Status:** Accepted
**Deciders:** Project maintainer, product owner
**Related:** ADR-032, ADR-063a, ADR-105, ADR-245, GOAP-249

## Context

The live reader login page exposes the password visibility control inside the
password field. A password visibility control is a high-frequency auth affordance.
It must be both discoverable and usable without obscuring typed content. Functional tests
alone do not catch a visually misplaced control.

## Decision

The shared `Input` password visibility control is anchored to the field's
trailing/right edge (or logical inline-end in RTL). The implementation
must:

1. Use logical trailing-side positioning (`inset-inline-end`) and matching trailing-side input padding (`padding-inline-end`)
   (with enough reservation for the localized label and input content when type is `password` or toggled to `text`) so the control does not
   overlap entered text or placeholder and remains correct in RTL.
2. Keep the localized action label beside the eye icon at `sm+`; below `sm`,
   the label may be visually hidden while remaining the button's accessible
   name.
3. Keep `type="button"`, `aria-controls`, a visible focus ring, and a minimum
   44px touch target.
4. Test state changes and geometry. Browser tests must compare bounding boxes so
   rendered placement is verified on the trailing/right side rather than inferred from class names.

This decision supersedes prior leading-edge placement requirements while retaining GOV.UK/WCAG 3.3.8 behavior, localization contract, and password handling.

## Alternatives considered

### Leading/left edge placement

Superseded in favor of trailing/right placement to align with right-aligned input interaction patterns and avoid interfering with text insertion start position.

### Icon-only control everywhere

Rejected because the changing localized action label improves discoverability.
Icon-only presentation remains a small-screen visual adaptation only.

### CSS/class assertion only

Rejected because a generated stylesheet can place an element differently from
its source classes. Browser geometry is required for the rendered contract.

## Acceptance criteria

- `Input` anchors the password toggle to the trailing/right side (logical inline-end) and reserves
  matching trailing-side input padding.
- Unit tests cover the placement class contract, toggle semantics, accessible
  name, and `aria-controls`.
- Login E2E coverage verifies the toggle's bounding box is on the field's
  right/trailing half and verifies the show/hide round trip.
- RTL rendering does not overlap the password value.
- Focus, keyboard activation, and touch-target behavior remain accessible.
- Design documentation and the reader UI skill reference this contract.
