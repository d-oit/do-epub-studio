# GOAP Plan: Swarm Implementation Progress Update

**Date:** 2026-05-26
**Goal:** Track progress of all 26 open GitHub issues implementation.

## Implementation Summary

### Status Legend
- ✅ **Closed** - Issue closed in GitHub
- 🔄 **PR Merged** - Implementation merged to main
- 🔶 **PR Open** - PR created, awaiting merge
- ⬜ **Pending** - Not yet started

### Issue Status

| # | Issue | Priority | Status | PR |
|---|-------|----------|--------|----|
| 347 | CI failure on main | critical | ✅ Closed | - |
| 339 | ZIP Bomb vulnerability | critical | ✅ Closed | #348 |
| 298 | SVG XSS sanitization | critical | ✅ Closed | #349 |
| 303 | Zod Worker validation | high | ✅ Closed | #350 |
| 304 | Reanchoring Web Worker | high | ✅ Closed | #350 |
| 306 | Sync conflict resolution | high | 🔶 PR #351 | #351 |
| 302 | A11y metadata extraction | high | 🔶 PR #351 | #351 |
| 301 | RTL/vertical text | high | 🔶 PR #351 | #351 |
| 314 | Schema consolidation | medium | 🔶 PR #351 | #351 |
| 312 | Dep vulnerability scanning | medium | ✅ Closed | #348 |
| 311 | SW update notification UX | medium | 🔶 PR pending | wave4 |
| 310 | Annotation adapter | medium | 🔶 PR pending | wave4 |
| 307 | EPUB parsing Web Worker | medium | 🔶 PR pending | wave4 |
| 316 | OKLCH color migration | low | 🔶 PR pending | wave4 |
| 309 | IndexedDB encryption | medium | ⬜ Pending | - |
| 308 | Fixed-layout EPUB | medium | ⬜ Pending | - |
| 315 | View Transitions API | low | ⬜ Pending | - |
| 318 | AI plugin architecture | low | ⬜ Pending | - |
| 283 | SBOM generation | low | ✅ Already in CI | - |
| 281 | Pre-commit hooks in CI | low | ⬜ Pending | - |
| 280 | Automated release workflow | low | ✅ Already exists | - |
| 279 | Playwright mobile/WebKit | low | ⬜ Pending | - |
| 276 | Dependabot | low | ✅ Already configured | - |
| 275 | TraceId assertions | low | ⬜ Pending | - |
| 274 | Raise coverage thresholds | low | ⬜ Pending | - |
| 269 | OIDC Cloudflare | low | ✅ Already in release workflow | - |

### PR Status

| # | Branch | Issues | Status |
|---|--------|--------|--------|
| PR #349 | feat/wave1-critical-security | #298 | ✅ Merged |
| PR #350 | feat/wave2-high-priority | #303, #304 | ✅ Merged |
| PR #351 | feat/wave3-remaining-high-pri | #301, #302, #306, #314 | 🔶 Open |
| PR pending | feat/wave4-mid-priority | #307, #310, #311, #316 | 🔶 Pending push |
| - | feat/wave5-remaining | #308, #309, #315, #318 | ⬜ Planned |
| - | feat/wave6-ci-testing | #275, #274, #281, #279, #269 | ⬜ Planned |
| - | feat/wave7-e2e | #317 | ⬜ Planned |

## Issues Already in Codebase (No Changes Needed)

The following issues are already implemented in the codebase:
- **#283 SBOM**: Already generated in CI and release workflows
- **#280 Release workflow**: Already exists with SBOM, signing, SLSA
- **#276 Dependabot**: Already configured for GHA, npm, and Docker
- **#269 OIDC**: Release workflow already has `id-token: write`

## Remaining To-Do (Ordered by Priority)

### Wave 5: Medium PWA/Features
- #309 Encrypt IndexedDB offline data with session-derived key
- #308 Fixed-layout EPUB support
- #315 View Transitions API for page navigation
- #318 AI-assisted features plugin architecture
- Branch: `feat/wave5-remaining`

### Wave 6: CI/Release/Testing Improvements
- #275 Playwright assertions for traceId on Worker API responses
- #274 Raise coverage thresholds for shared and web
- #281 Run pre-commit hooks in CI
- #279 Add mobile viewport and WebKit projects to Playwright
- #269 OIDC short-lived tokens
- Branch: `feat/wave6-ci-testing`

### Wave 7: E2E Testing
- #317 Offline functionality E2E tests with network simulation
- Branch: `feat/wave7-e2e`

## Stats

- **Total issues**: 26
- **Closed/Resolved**: 11 (42%)
- **Implemented (PR open)**: 6 (23%)
- **Remaining**: 9 (35%)
