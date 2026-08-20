# ADR-249: Password Toggle Placement and Visual Regression Policy

**Date:** Current session
**Status:** Accepted
**Deciders:** Project maintainer, product owner
**Related:** ADR-032, ADR-063a, ADR-105, ADR-245, GOAP-249

## Context

The live reader login page exposes the password visibility control inside the
password field, but its placement was not part of the component contract. The
implementation used a trailing/right utility and trailing input padding. That
made the result vulnerable to stylesheet or layout drift and allowed the
control to appear on the wrong side of the field relative to product direction.

A password visibility control is a high-frequency auth affordance. It must be
both discoverable and usable without obscuring typed content. Functional tests
alone do not catch a visually misplaced control.

## Decision

The shared `Input` password visibility control is anchored to the field's
leading/left edge, following the login product direction. The implementation
must:

1. Use logical start-side positioning and matching start-side input padding
   (with enough reservation for the localized label) so the control does not
   overlap entered text and remains correct in RTL.
2. Keep the localized action label beside the eye icon at `sm+`; below `sm`,
   the label may be visually hidden while remaining the button's accessible
   name.
3. Keep `type="button"`, `aria-controls`, a visible focus ring, and a minimum
   44px touch target.
4. Test state changes and geometry. Browser tests must compare bounding boxes so
   rendered placement is verified rather than inferred from class names.

This decision refines ADR-245's icon-plus-label toggle. It does not change the
GOV.UK/WCAG 3.3.8 behavior, localization contract, or password handling.

## Alternatives considered

### Keep the trailing/right control

Rejected because the product request explicitly calls for the control on the
left/leading edge and the prior class contract did not provide a regression
proof for its rendered placement.

### Icon-only control everywhere

Rejected because the changing localized action label improves discoverability.
Icon-only presentation remains a small-screen visual adaptation only.

### CSS/class assertion only

Rejected because a generated stylesheet can place an element differently from
its source classes. Browser geometry is required for the rendered contract.

## Acceptance criteria

- `Input` anchors the password toggle to the start/left side and reserves
  matching start-side input padding.
- Unit tests cover the placement class contract, toggle semantics, accessible
  name, and `aria-controls`.
- Login E2E coverage verifies the toggle's bounding box is on the field's
  left/leading half and verifies the show/hide round trip.
- RTL rendering does not overlap the password value.
- Focus, keyboard activation, and touch-target behavior remain accessible.
- Design documentation and the reader UI skill reference this contract.
