# Changelog

## [Unreleased]

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
- fix(e2e): remove the PWA lane's intermittent failure — wait for the service worker to activate before the controlled reload, and wait for the annotation toolbar to appear after selecting a passage; the flake also failed on `main`.
- fix(worker): annotation exports now escape single quotes (HTML) and Markdown syntax (Markdown) in user content to prevent injection.
- refactor(web): replace unsafe `as unknown as` casts in reader/offline code with typed internals; fix a latent Buffer pooled-backing bug in offline crypto
- feat(offline): create ordinary highlights and shared comments offline with encrypted local records, idempotent replay, and durable failed-sync state.
- fix(reader): keep progress CFI changes from rebuilding the active EPUB rendition during reading and reconnect.

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
