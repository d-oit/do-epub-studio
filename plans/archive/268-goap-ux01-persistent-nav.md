# GOAP-268 — UX-01: Persistent responsive core navigation

**Date:** 2026-09-10 | **Branch:** `feat/goap-268-ux01-persistent-nav`
**Depends:** #1097 merged (`d2c19b2`). **Scope:** route composition + landmarks only.
Numbers 267 taken by dep-scan fix; product-modernization continues here.

## 1. ANALYZE

`App.tsx:120` mounts `<AppShell/>` as a leaf; catalog/library/settings are
siblings, so `AppShell.tsx:95 <Outlet/>` renders empty and shared nav never
shows. `AppShell.tsx:16-38` waits 1200ms then unconditional redirect,
hijacking deep links. `Drawer.tsx:49,55` + `BottomTabBar.tsx:10` hide at `md`
while `Sidebar.tsx:11` shows at `lg` → dead nav zone 768–1023px. Twelve
`<main id="main-content">` definitions collide once nested.

## 2. DECISIONS (ADR)

- **D1 — route composition owns nav/landmarks:** `/` becomes layout parent;
  catalog/library/settings nest as children with guards intact. Auth, reader,
  admin, help, 404 stay outside the shell (own layouts).
- **D2 — root redirect synchronous:** role-aware index (`admin→/admin`,
  `bookSlug→/read/:slug`, else `/login`) preserves destinations, drops timer.
- **D3 — unify at `lg`:** drawer/tabbar `md:hidden→lg:hidden` (smaller diff
  than moving sidebar to `md`).
- **D4 — shell owns the landmark:** nested pages render `<div>`, drop brand
  lockups (shell provides identity) and second skeleton headers.
- **D5 — no new i18n keys:** drawer inner `<nav>` drops duplicate label
  (dialog already labelled); sidebar/tabbar never co-visible after D3.

## 3. VERIFY

- Vitest: `AppShell.test` (layout+outlet, no timer), `app-routes.test`
  (nested chrome, guards, `aria-current`, single landmark), tabbar
  (`lg:hidden`, active link).
- `turbo run lint` (all pkgs) + typecheck; `gh pr checks` + Codacy green;
  0 threads; squash when CLEAN.

## 4. OUT OF SCOPE (later UX-02/03/04, UI-01)

Library reflow, settings group names, pagination errors, auth surfaces.
Reader/admin/help/404 layouts untouched.
