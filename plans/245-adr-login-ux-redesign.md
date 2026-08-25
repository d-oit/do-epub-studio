# ADR-245: Login Page UX Redesign

**Date:** 2026-08-17
**Status:** Accepted
**Deciders:** Project maintainer, product owner
**Related:** ADR-244 (Amendments A–C), ADR-233, GOAP-246, ADR-063 (semantic tokens)

## Context

The reader (`/login`) and admin (`/admin/login`) screens function correctly
but under-serve three user needs:

1. **Password entry has no visibility control.** The shared `Input` component
   has shipped a GOV.UK / WCAG 3.3.8-compliant show/hide toggle
   (`showPasswordLabel` / `hidePasswordLabel`) since GOAP-244, but neither
   login page passes the labels, so the toggle never renders. The i18n keys
   `ui.showPassword` / `ui.hidePassword` exist in all catalogs, unused.
2. **Demo access is one-dimensional.** ADR-244 Amendment C added a one-click
   demo button plus a plaintext `email · password · slug` line under it. The
   line is dense, untranslated-looking, and does not help a reviewer who
   wants to *see* the credentials flow through the real form.
3. **The screens explain nothing.** The desktop hero shows the app name and
   one description line; below `lg` there is no app context at all. New
   visitors cannot tell what the app does, how access is granted, or where
   to read more.

Additionally, `AdminLoginPage.tsx` was 521 lines — a pre-existing violation
of the 500-line cap (AGENTS.md Tier 3) that this work surface obligates us to
fix (Tier 1 "fix pre-existing issues you touch").

## Decision

Redesign both auth screens with four changes, all inside the existing
design-token system (ADR-063):

### 1. Icon + text password toggle (WCAG 3.3.8)

- New `packages/ui/src/icons.tsx` exports decorative inline `EyeIcon` /
  `EyeOffIcon` SVGs (`aria-hidden`, `currentColor`), following the
  `AppLogo.tsx` inline-SVG convention (no icon library is used in this repo).
- `Input`'s existing toggle renders the icon beside the changing action
  label ("Show password" ↔ "Hide password"). The label remains the
  accessible name; `aria-controls` / `aria-expanded` behavior is unchanged.
- Input padding grows `pr-20` → `pr-28` to fit icon + label.
- Both login pages pass the (already-existing) localized labels on every
  password field, including the admin MFA recovery form.

### 2. Dual-action demo (replaces the Amendment C info line)

Each demo block renders behind an "or" divider:

- **Primary:** "Try the demo" — the existing one-click password-free demo
  endpoint (`/api/demo/reader-login`, `/api/demo/admin-login`). No change to
  the fail-closed Worker gate.
- **Secondary:** "Fill demo credentials" — autofills the documented demo
  email + password into the visible form, then (reader) focuses the email
  field for review-and-submit.

The plaintext `login.demoInfo` / `admin.login.demoInfo` lines are removed.
This **supersedes ADR-244 Amendment C decision 2** (info panels on the login
screens): the documented credentials remain public, but are now surfaced
through progressive disclosure (autofill + the toggle) instead of a static
line. The `/help` page still lists the full credential sets verbatim.

**Autofill mechanism (reader):** the reader form is an uncontrolled
`useActionState` + `FormData` form; converting it to controlled state would
break the form-action pattern. Autofill therefore writes `ref.current.value`
directly — `FormData` reads `.value` at submit time, and no React listeners
exist on those inputs, so no synthetic events are required. The admin form
is controlled and simply sets state.

### 3. Rich hero + mobile info

- Desktop (`lg+`): left panel gains a four-item value-prop list (responsive
  reading, highlights/annotations/bookmarks, offline sync, upload & manage),
  a "how access works" note (no signup; access granted by author/manager),
  and a "Learn more" link to the configured help URL.
- Below `lg`: a new compact info card above the login card carries logo,
  name, description, the same feature list, and the access note — replacing
  the previous single `lg:hidden` heading.
- Admin parity: three admin-specific bullets (upload/manage EPUBs, reader
  grants, audit logs) and an admin access note (accounts created by the
  platform owner).

### 4. File-size compliance

- New `features/auth/LoginHero.tsx` (also exports the shared feature list),
  `features/auth/LoginMobileInfo.tsx`,
  `features/admin/AdminLoginHero.tsx` (+ `AdminMobileInfo`),
  `features/admin/AdminMfaForms.tsx` (extracted MFA/recovery forms).
- `AdminLoginPage.tsx` drops 521 → ~438 lines; `LoginPage.tsx` stays ≤ 500.

## Alternatives Considered

### Icon-only toggle (Material/Ant pattern)

Rejected. Icon-only buttons depend on the `aria-label` being maintained and
are measurably less discoverable; the GOV.UK pattern (visible changing
label) is the WCAG 3.3.8 reference implementation and the component already
implemented it — adding the icon satisfies the "best practice icon" ask
without regressing a11y.

### Keep the plaintext demo info line and add autofill

Rejected. Three affordances (button + line + autofill) saying the same thing
is noise; the line was the weakest of the three.

### Controlled reader form

Rejected. `useActionState` + uncontrolled FormData is the established
pattern; refs are simpler and the credentials are public anyway.

## Consequences

### Positive

- Password entry meets WCAG 3.3.8 on all auth forms (login, recovery, admin
  credentials, admin MFA recovery).
- Reviewers can experience the demo one-click *or* watch credentials flow
  through the real form.
- Both screens explain the product and access model on every viewport.
- Pre-existing 500-line violation fixed; duplicate login test suite
  (`apps/web/src/__tests__/login-page.test.tsx`) deleted.

### Negative

- 17 new i18n keys × 13 catalogs (4 keys removed).
- Two more shared modules in `packages/ui` surface (`EyeIcon`, `EyeOffIcon`).
- `login.demoOr` renders inside an `aria-hidden` divider — the demo buttons
  are adjacent and self-labeling, so the divider text is decorative.

## Acceptance Criteria

- `Input` toggle renders icon + label, cycles `password`/`text`, updates
  `aria-expanded` (unit tests in `packages/ui`).
- Both login pages wire the toggle on every password field.
- "Fill demo credentials" populates the form (unit + E2E).
- Hero + mobile info render feature bullets and the access note (unit +
  E2E).
- All touched files ≤ 500 lines.
- `./scripts/quality_gate.sh` and the Codacy PR check pass before merge.

## Amendment D (2026-08-24): Collapse removed — always-visible split layout

**Supersedes Decision 3's below-`lg` disclosure framing and the collapsible
"about" section.** The `<details data-testid="login-about">` wrapper around
`LoginHero` is reverted: a disclosure above the form pushed the sign-in
action below the fold and charged an interaction cost for content that is
static. The page now renders:

- **`lg+`:** a two-column split — the hero content as an always-visible
  editorial brand panel (brand lockup, serif display headline, value props,
  access note, version + help link, staggered slide-up-fade entrance) beside
  the centered form column (`shadow-spine` book-gutter accent).
- **Below `lg`:** form-first single column — compact brand header
  (`login-brand`, now `lg:hidden`), the card, then a compact info block
  (`login-about` testid retained) with the feature list and access note.

The `login.aboutToggle` key was removed from all 13 catalogs (parity test
enforces uniformity). E2E assertions in `cloudflare-login.spec.ts` no longer
target a disclosure; feature bullets must be visible without interaction.
