# Changelog

## [Unreleased]

- fix(auth): surface a demo-login refusal instead of retrying it through the credential endpoints. The reader and admin demo logins fell back to `/api/access/request` / `/api/admin/login` for every failure, so a `429 TOO_MANY_REQUESTS` doubled the throttled attempts; the fallback is now limited to transport failures (including the client's own request timeout) and unparseable SPA responses.
- fix(reader): re-apply the rendition theme when a typography preference changes; the engine treats selecting the already-current theme as a no-op, so font size, line height and family changes never reached the open chapter.
- fix(security): allow inline `<style>` on the Pages `style-src` so the EPUB engine can style reader content (font size, line height, family, theme colours, image constraints); `script-src` stays strict and the Worker CSP is unchanged. See ADR-1018.
- fix(reader): accept position-only bookmark locators on create and read. The reader has no text selection when saving its place, so the API rejected every bookmark with `400` and then filtered stored rows as corrupt; queued offline bookmarks now replay the same shape.
- fix(admin): route the EPUB upload through the step-up wrapper, so the guarded `428 STEP_UP_REQUIRED` opens the password prompt and the retry uses the rotated token instead of aborting on the stale one.
- fix(admin): hand R2 an upload body it can measure — byte-exact bytes for validated uploads, the `File` for multipart, the request stream for large files — and log the underlying cause when storage still fails instead of a bare `UPLOAD_FAILED`.
- fix(admin): create a book without an author by omitting the field instead of sending `null`, and answer a duplicate slug with `409` instead of an internal error.
- fix(pwa): precache the app shell under `/` instead of `index.html`, so the install does not depend on the Pages `/index.html` 308 that `upgrade-insecure-requests` turns into a failed https fetch on an http origin, and claim clients on activation so the first visit is controlled without a reload.
- fix(admin): keep the session alive when a password check fails — a `401` from `password-change` or `step-up` is a credential verdict, not an expired session, and must render the form error instead of signing the administrator out.
- feat(admin): add a visible current-session sign-out on the books header and the account page; it revokes the token and returns to `/admin/login`.
- fix(reader): honour saved typography and writing-mode preferences on a cold load (the theme is applied when the first chapter renders and re-applied on every preference, including writing mode), and generate EPUB locations so progress percentages and the library resume label reflect the reading position.
- fix(reader): align the More menu to the inline end so it stays inside a 390 px RTL viewport and sign-out remains reachable.
- fix(admin): label the destructive book removal "Delete" instead of "Archive"; the cascade drops grants, annotations and files and cannot be undone.
- fix(reader): keep the requested book in the login redirect for an unauthenticated `/read/<slug>` deep link, so the sign-in form has its book context instead of rendering disabled.
- fix(feedback): anchor feedback to the real `book_files.id` — the schema demanded a UUID while ids are TEXT (the demo seed uses `demo-sample-…`), so every anchored submission returned `400`.
- fix(reader): flush the reading timer before opening "About This Book", so device-local reading insights and their JSON export reflect the pages just read instead of reporting no activity.
- feat(ci): report deployment metrics with `do-harness dora` (report-only, never a merge gate), publish the harness compliance mapping to `docs/compliance-mapping.md` with a drift check, and verify that the paths and commands named in `llms.txt`/`llms-full.txt` still exist.
- fix(ci): assert the scorecard workflow pins an allowlisted SHA instead of a hard-coded one that a Dependabot bump makes stale.
- fix(security): emit `geolocation=()` in `Permissions-Policy` from the Pages and Worker header sources, and pin Worker/Pages parity so the two cannot drift apart.
- fix(offline): send the session token on queued replay writes and on the progress-conflict and permission-validation reads; those calls reached protected routes unauthenticated, and a rejected reading-insight replay was recorded as a success.
- fix(reader): read the grant check's response out of the worker's `{ ok, data }` envelope; every field was `undefined`, so the periodic revocation poll reported every healthy grant as revoked.
- fix(reader): fence sensitive offline writes to the session that owns them, so a write that finishes after sign-out can no longer repopulate a purged store; logout now invalidates the session before purging and aborts in-flight authenticated requests.
- fix(reader): skip the progress save when the session that opened the book is no longer current — before the write and again after it — so a sign-out mid-save can neither enqueue the old session's progress under a replacement session nor surface a refusal as an unhandled rejection.
- fix(web): consume a superseded view transition's rejection instead of surfacing it as an unhandled promise rejection; report a failing transition update callback.
- fix(reader): distinguish unreadable device-local reading insights from empty data, and keep populated local metrics when the synced request fails.
- fix(auth): authenticate periodic grant validation and limit 401 teardown to the rejected current session.
- test(reader): correct minimal EPUB navigation metadata and verify TOC chapter content plus CFI restoration after reload.
- fix(e2e): remove the PWA lane's intermittent failure — wait for the service worker to activate before the controlled reload, clear the previous selection before re-selecting a passage so the app observes the change, and scope the selection-toolbar locators so the reader banner's "Comment" button is not acted on instead; the flake also failed on `main`.
- fix(ci): assert the installed `do-harness` matches the version CI pins, so a newer local binary reports a version mismatch instead of failing the compliance and DORA checks as if their content had drifted.
- fix(worker): annotation exports now escape single quotes (HTML) and Markdown syntax (Markdown) in user content to prevent injection.
- refactor(web): replace unsafe `as unknown as` casts in reader/offline code with typed internals; fix a latent Buffer pooled-backing bug in offline crypto
- feat(offline): create ordinary highlights and shared comments offline with encrypted local records, idempotent replay, and durable failed-sync state.
- fix(reader): keep progress CFI changes from rebuilding the active EPUB rendition during reading and reconnect.
- fix(knip): remove unused EPUB fixture exports instead of masking them with a Knip entry.
- fix(reader): use semantic background tokens for active table-of-contents items and memoize the empty grants promise in admin book access.
- fix(e2e): mock reader bookmark endpoints by default to prevent unmocked background requests, and handle responsive overflow menus in keyboard navigation tests.

<!-- Previous release history (v0.1.1, v0.2.0) archived — intentional version reset to 0.1.0 per Wave 6. -->

## [0.1.0] - 2026-05-17

- feat(infra): close remaining plan gaps
- docs(plans): sync progress and compact learnings after gap closure PRs
- feat(infra): close CI/CD, test infra, and warning gaps
- Enhance Reader Settings Panel Accessibility and Polish
- ci: add Cloudflare Pages frontend deployment to release workflow
- feat(quality): complete remaining plan gaps and dep cleanup
- feat(quality): complete all missing plans tasks via swarm
- plans: add ADR-017 epub-engine migration and update optimization backlog
- fix(reader-core): address PR #139 review feedback
- perf(reader-core): optimize reanchoring with Set lookups and HREF normalization
- fix(ui): resolve Input focus ring conflict, type safety, and a11y issues
- fix(reader): migrate to intity/epub-js with Codacy review fixes
- feat(ux): remove input scale on focus and improve focus ring
- feat(a11y): implement global reduced motion support for Framer Motion
- fix(reader): address PR #135 review comments - system theme, design tokens, tests
- feat(ux): unify reader theme system with design tokens
- fix(ux): improve Modal accessibility
- fix(ci): resolve lint and typecheck failures for react-router-dom v7
- chore: bump react-router-dom from 6.30.3 to 7.15.0
- chore: bump react and @types/react
- fix: address PR #127 merge conflicts, CI failures, and review comments
- Improve Toolbar Mobile Accessibility and Fix Title Fallback
- Full 2026-grade modernization and maintenance pass
- Feat/skill symlinks
- fix(security): enforce grant expiration and implement session token rotation
- feat(ux): improve tooltip accessibility and keyboard support
- Tighten TypeScript safety rules and resolve lint violations
- ci(quality): extend verify to include coverage thresholds and e2e smoke checks
