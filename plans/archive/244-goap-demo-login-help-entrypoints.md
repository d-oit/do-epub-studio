# GOAP-244: Demo Login and Help Entry Points

**Date:** 2026-08-15
**Status:** COMPLETED
**Related:** ADR-004, ADR-080, ADR-092, ADR-106, ADR-231, ADR-233, ADR-234, ADR-244

## Goal

Analyze the current login and documentation surfaces, then define a scoped
implementation plan for easy demo access and a visible help/how-to-use link.
This plan has been fully implemented.

## Current Evidence

| Area | Evidence | Finding |
| --- | --- | --- |
| Reader login UI | `apps/web/src/features/auth/LoginPage.tsx:62`, `apps/web/src/features/auth/LoginPage.tsx:74`, `apps/web/src/features/auth/LoginPage.tsx:282` | Reader login already posts `{ email, password, bookSlug }` to `/api/access/request`; it has no demo shortcut. |
| Admin login UI | `apps/web/src/features/admin/AdminLoginPage.tsx:55`, `apps/web/src/features/admin/AdminLoginPage.tsx:185` | Admin login already posts credentials to `/api/admin/login`; it has no demo shortcut and may branch into MFA. |
| Route surface | `apps/web/src/App.tsx:119`, `apps/web/src/App.tsx:120` | Reader and admin login pages are separate lazy routes, so role-specific demo affordances can be added without changing guarded app routes. |
| Demo seed | `scripts/seed-demo-accounts.mjs:38`, `scripts/seed-demo-accounts.mjs:74`, `scripts/seed-demo-accounts.mjs:138`, `scripts/seed-demo-accounts.mjs:197` | ADR-233 is implemented as a fail-closed seed with separate reserved reader/admin accounts and a demo-book grant. |
| Demo policy | `plans/233-adr-demo-account-sandbox-policy.md` | Existing policy covers safe seeding, but not user-visible one-click login entry points. |
| Help docs | `docs/ONBOARDING.md`, `docs/setup-local.md`, `docs/coding-guide.md` | Existing docs are contributor/setup oriented; there is no stable end-user help URL exposed on auth screens. |
| Frontend config | `apps/web/src/config/app-identity.ts`, `apps/web/src/vite-env.d.ts` | Public Vite config exists for runtime URLs, but there is no `VITE_HELP_URL` or demo-login feature flag contract. |

## Improvement Summary

1. Add a visible "Use reader demo" option on `/login`.
2. Add a visible "Use admin demo" option on `/admin/login`.
3. Add a visible "Help / how to use" link on both auth screens.
4. Keep demo credentials out of browser code, env files, telemetry, snapshots,
   and docs.
5. Gate demo login on the Worker side even if the frontend accidentally renders
   the buttons.

## TRIZ Analysis

### Contradiction 1

**Improving:** First-run usability and stakeholder review speed.
**Worsens:** Auth blast radius if demo credentials are exposed or enabled in
production.
**Reality:** ADR-233 already seeds accounts safely, but the only usable login
path still requires knowing the reserved email, password, and reader book slug.
**TRIZ principles available:** Segmentation, condition separation, extraction.
**Resolution:** Segment demo access into dedicated non-production endpoints
that mint sessions only for `created_by_demo=1` accounts and only when explicit
server-side demo flags pass.

### Contradiction 2

**Improving:** Admin demo convenience.
**Worsens:** Administrative capability risk.
**Reality:** The seed disables demo admin outside local by default and ADR-234
requires higher assurance for sensitive admin operations. One-click admin demo
must not bypass production gates or grant access to real content.
**TRIZ principles available:** Local quality, partial action, nesting.
**Resolution:** Allow admin demo only in local/throwaway preview environments,
log the demo-login audit event, and keep sensitive mutations behind existing
step-up/MFA checks.

### Contradiction 3

**Improving:** Clear help discovery from login.
**Worsens:** Config sprawl and hardcoded environment-specific URLs.
**Reality:** Existing docs are internal and no help URL contract exists.
**TRIZ principles available:** Extraction, dynamicity.
**Resolution:** Extract help destination into a validated public config value
with tests, and render it as a normal external or internal link.

## Decomposition

| Phase | Priority | Tasks | Dependencies | Gate |
| --- | --- | --- | --- | --- |
| 1. Contract | P0 | Define `DEMO_LOGIN_ENABLED`, optional preview allowlist, `DEMO_BOOK_SLUG`, and `VITE_HELP_URL`/`VITE_DEMO_LOGIN_ENABLED` contracts. | ADR-244 | Config is documented without secrets or hardcoded deployment URLs. |
| 2. Worker demo sessions | P0 | Add separate reader/admin demo session endpoints returning the existing login response shapes. Validate `created_by_demo=1`, demo book grant, disabled/compromised state, production-like env, and audit logging. | Phase 1, ADR-233 | Worker tests prove production fail-closed and no password disclosure. |
| 3. Web login UI | P0 | Add role-specific demo buttons to `LoginPage` and `AdminLoginPage`; call the new endpoints, reuse existing `setAuth`/`setAdminAuth`, and navigate to `/read/:slug` or `/admin/books`. | Phase 2 | Web tests cover button visibility, loading/error states, and navigation. |
| 4. Help link | P1 | Add a validated public help URL helper and render "Help / how to use" links on both auth screens. | Phase 1 | Tests cover `href`, `target`, and `rel` behavior; invalid URL hides the link. |
| 5. i18n and docs | P1 | Add translation keys for all locale catalogs and document local/demo setup plus the help URL contract. | Phases 3-4 | i18n tests pass; docs contain placeholders only. |
| 6. Verification | P0 | Run targeted web/worker tests, lint/typecheck, `./scripts/quality_gate.sh`, and Codacy PR check before merge. | All phases | All required checks pass. |

## Recommended Design

- Prefer server-minted demo sessions over browser-shipped demo passwords.
- Keep separate endpoints, e.g. `POST /api/demo/reader-login` and
  `POST /api/demo/admin-login`, so reader/admin telemetry, tests, and gates are
  unambiguous.
- Return the same DTOs as existing login routes to avoid a second auth-store
  model.
- Show demo buttons only when `VITE_DEMO_LOGIN_ENABLED === '1'`, but treat that
  as UI-only. The Worker remains authoritative.
- Reader demo endpoint should use `DEMO_BOOK_SLUG` and fail if the demo book or
  demo grant is missing.
- Admin demo endpoint should fail if the demo admin is disabled, compromised,
  not `created_by_demo=1`, or the environment is production-like.
- Help link should be configured through public config, validated with `URL`,
  and rendered with `rel="noopener noreferrer"` for external targets.

## Risks

- A demo admin against a shared preview database can mutate real preview
  content. Mitigation: enable only on local or throwaway preview databases and
  keep existing step-up gates for sensitive mutations.
- Reader demo depends on the demo book existing. Mitigation: make the endpoint
  fail with a generic disabled response and document the seed order.
- Locale churn is broad because login strings exist in every catalog. Mitigation:
  add exact keys in one small patch and keep copy short.

## Acceptance Criteria

- `/login` has an accessible, tested reader-demo action when demo login is
  enabled.
- `/admin/login` has an accessible, tested admin-demo action when demo login is
  enabled.
- Demo login never requires plaintext credentials in frontend code or public
  docs.
- Worker demo endpoints fail closed in production-like environments.
- Reader demo grants only the configured demo book.
- Admin demo cannot sign in when disabled or compromised.
- Both auth pages expose a help/how-to-use link when a valid help URL is
  configured.
- Audit/telemetry include trace IDs but no tokens, passwords, reset links, raw
  IPs, or personal data beyond the existing placeholder demo identifiers.

## Out of Scope

- Enabling demo accounts in production.

## Amendment A: Full-page visibility and demo info (2026-08-16)

### Problem

The auth card grew taller than the viewport on smaller screens, clipping
the admin description and help link below the fold. Demo buttons lacked
context about which account or book slug the demo uses.

### Tasks

1. Change auth screens from vertically centered to top-anchored +
   scrollable so all content is visible without clipping.
2. Add a demo info panel (when demo login is enabled) showing the
   reserved demo email and configured book slug — no password is
   shipped; the panel explains the one-click server-minted session.
3. Move the admin/reader cross-link and description inside the card.
4. Make the help link more prominent (larger text, inside card footer).
5. Add i18n keys for the demo info text across all locale catalogs.
6. Update web + E2E tests for the new layout and demo info panel.

## Amendment B: In-app help page and same-origin help URL (2026-08-16)

The deployed previews never set an absolute `VITE_HELP_URL`, so the help
link never rendered. Research-backed resolution (Authgear 2025, SaaSUI
2026, MicroFounder, Rajiv Pant 2026): keep the password-free one-click
demo, and ship an in-product "what this app does / how to use" page.

### Tasks

1. Add a public `/help` route rendering a standalone help page: app intro,
   reader vs admin roles, reserved demo emails + book slug — no password.
2. Extend `resolveHelpUrl` to accept a same-origin path (`/help`) so the
   link renders on any origin without baking a hostname.
3. Wire `VITE_HELP_URL=/help` into `.env.local.example`, the preview
   deploy (lighthouse.yml), and the E2E demo build (ci.yml e2e-full).
4. Keep `VITE_DEMO_LOGIN_ENABLED` off in deployments (demo buttons remain
   local/E2E-only per ADR-233/244).
5. Add i18n keys for the help page across all locale catalogs.
6. Add web + E2E tests covering the help page and the same-origin link.

## Amendment C: Documented demo password (2026-08-16)

### Tasks

1. Default both demo passwords in the seed to documented values
   (`demo-reader-password` / `demo-admin-password`), hashed with Argon2id;
   remove the operator-password guard so demo users always have a usable
   password. Overridable via env.
2. Add `VITE_DEMO_READER_PASSWORD` / `VITE_DEMO_ADMIN_PASSWORD` web env +
   typing; document both in `.env.local.example` / `.dev.vars.example`.
3. Show demo email + password + book slug on the reader and admin login demo
   info panels and the help page.
4. Update i18n `login.demoInfo`, `admin.login.demoInfo`, and `help.demo*`
   strings across all locale catalogs (credential now includes password).
5. Add E2E tests: sign in as demo reader and demo admin via the normal
   email+password forms; assert navigation.
6. Update fixtures (demo credential constants, admin login mock option).
