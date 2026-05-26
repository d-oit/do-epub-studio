# GOAP Plan: Swarm Implementation of All Open GitHub Issues

**Date:** 2026-05-26
**Goal:** Implement/fix all 26 open GitHub issues using swarm agent coordination with handoff.

## Strategy: Hybrid Swarm + Sequential Waves

### Wave Structure
Issues grouped by priority and dependency, implemented as branches with atomic commits.

### Open Issues Overview

| # | Issue | Priority | Status |
|---|-------|----------|--------|
| 347 | CI failure on main: 26446891738 | critical | OPEN - likely resolved by #348 |
| 339 | ZIP Bomb and Archive Traversal Vulnerability | critical | OPEN - fixed in #348 (merged), needs close |
| 298 | Sanitize SVG content in EPUB to prevent XSS | critical | OPEN |
| 303 | Validate all Worker route bodies with Zod schemas | high | OPEN |
| 304 | Offload reanchoring algorithm to Web Worker | high | OPEN |
| 306 | Conflict resolution strategy for PWA sync | high | OPEN |
| 302 | Extract and render EPUB accessibility metadata | high | OPEN |
| 301 | RTL and vertical text support | high | OPEN |
| 314 | Consolidate schemas into schema package | medium | OPEN |
| 312 | Dependency vulnerability scanning to CI pipeline | medium | OPEN - fixed in #348 (merged), needs close |
| 311 | Service Worker update notification UX | medium | OPEN |
| 310 | Annotation adapter to decouple from epub.js | medium | OPEN |
| 309 | Encrypt IndexedDB offline data | medium | OPEN |
| 308 | Fixed-layout EPUB support | medium | OPEN |
| 307 | Offload EPUB parsing to Web Worker | medium | OPEN |
| 318 | AI-assisted features plugin architecture | low | OPEN |
| 317 | Offline functionality E2E tests | low | OPEN |
| 316 | Migrate to OKLCH color system | low | OPEN |
| 315 | View Transitions API page navigation | low | OPEN |
| 283 | Generate and publish SBOM on every release | low | OPEN - partially done in CI |
| 281 | Run pre-commit hooks in CI | low | OPEN |
| 280 | Automated release workflow | low | OPEN |
| 279 | Mobile viewport and WebKit projects to Playwright | low | OPEN |
| 276 | Renovate/Dependabot for automated dependency updates | low | OPEN |
| 275 | Playwright assertions for traceId on Worker API | low | OPEN |
| 274 | Raise coverage thresholds for shared and web | low | OPEN |
| 269 | Migrate Cloudflare deploy credentials to OIDC | low | OPEN |

## Wave Execution Plan

### Wave 0: Foundation
- Create plan document
- Fetch latest main
- Close already-resolved issues (#347, #339, #312)

### Wave 1: Critical Security (#298 SVG XSS) + CI cleanup
- Branch: `feat/wave1-critical-security`
- Fix SVG XSS sanitization in EPUB rendering
- Commit: `fix(security): sanitize SVG content in EPUB to prevent XSS injection`

### Wave 2: High Priority (#303 Zod, #304 reanchoring worker, #306 sync conflict)
- Branch: `feat/wave2-high-priority`
- Parallel implementation using swarm agents

### Wave 3: Accessibility (#302 a11y metadata, #301 RTL)
- Branch: `feat/wave3-accessibility`

### Wave 4: Medium Architecture (#314 schemas, #310 adapter, #307 parsing)
- Branch: `feat/wave4-medium-arch`

### Wave 5: Medium PWA/Features (#311 SW, #309 IndexedDB, #308 fixed-layout)
- Branch: `feat/wave5-medium-pwa`

### Wave 6: Low Priority (#316 OKLCH, #315 View Transitions, #318 AI arch)
- Branch: `feat/wave6-low-improvements`

### Wave 7: CI/Release/Testing improvements
- Branch: `feat/wave7-ci-release`

### Wave 8: E2E Testing
- Branch: `feat/wave8-e2e-testing`

## Quality Gates
- Each wave: `./scripts/quality_gate.sh` must pass
- Commit messages follow `type(scope): description` (max 72 chars)
- Atomic commits via `./scripts/atomic-commit/run.sh`
- PRs created for each wave branch
- Pre-existing issues in touched files are fixed

## Handoff Protocol
Wave N PR merged → Wave N+1 rebased on latest main → continue

## Progress Tracking

| Wave | Branch | Status | PR # |
|------|--------|--------|------|
| 0 | main | planning | - |
| 1 | wave1-critical-security | pending | - |
| 2 | wave2-high-priority | pending | - |
| 3 | wave3-accessibility | pending | - |
| 4 | wave4-medium-arch | pending | - |
| 5 | wave5-medium-pwa | pending | - |
| 6 | wave6-low-improvements | pending | - |
| 7 | wave7-ci-release | pending | - |
| 8 | wave8-e2e-testing | pending | - |
