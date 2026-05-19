# Changelog

## [Unreleased]

- feat(ci): upload Playwright reports on passing runs, add E2E retry, WebKit browsers, and failure notifications (#170, #174, #173, #164)
- feat(lint): enable stricter ESLint rules (no-non-null-assertion, require-await, consistent-type-imports) as warnings (#163)
- chore(test): add env var fallbacks for hardcoded test credentials (#169)
- chore(docs): archive lighthouse.md, create AGENTS.md instruction count baseline (#172, #167)
- fix(ci): sync allowed action SHAs with workflow files (#186)
- docs(plans): update Plan 038 backlog triage with Wave 2 progress

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
