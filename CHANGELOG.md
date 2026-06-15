# Changelog

## [Unreleased]

- feat(reader): add Search side-panel to EPUB reader (PR #525, plan 093)
- feat(security): session-expiry handling, signed-URL metadata, security posture docs (PR #527, plan 094 / plan 092 resolution)
- feat(auth): add email transport, admin recovery, and book CRUD (#563)
- fix(security): add tenant isolation and locator validation (#562)
- fix(reader): wire initial progress load on reader open (#566)
- feat(web): enforce reader side-panel mutual exclusivity (#552)
- feat(admin): integrate orphan grant management components (#560)
- test(security): implement G23 security posture regression tests (#559)
- docs(security): bring `docs/security-posture.md` and `docs/security-postability-telemetry.md` current with ADR-092
- docs(analysis): refresh SWARM_ANALYSIS.md for 2026-06-15 (#530)
- docs(plans): add plan 075 master GOAP, ADRs 068/075/078/080/081/082/083/092, ADR-INDEX, plans 076/077/079/084

## [0.1.1] - 2026-06-14

- feat(ci): upload Playwright reports on passing runs, add E2E retry, WebKit browsers, and failure notifications (#170, #174, #173, #164)
- feat(lint): enable stricter ESLint rules (no-non-null-assertion, require-await, consistent-type-imports) as warnings (#163)
- chore(test): add env var fallbacks for hardcoded test credentials (#169)
- chore(docs): archive lighthouse.md, create AGENTS.md instruction count baseline (#172, #167)
- feat(ci): add CycloneDX SBOM generation to release workflow (#175)
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
