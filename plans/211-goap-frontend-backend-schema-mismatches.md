# GOAP 211: Fix Critical Frontend/Backend Schema Mismatches

**Date:** 2026-08-02
**Status:** 🔄 IN PROGRESS
**Goal:** Fix integration bugs where frontend sends data that fails backend Zod validation, breaking core reader features (progress save, offline sync). All CI must pass.

**Related:** ADR-006 (multi-signal locator), Plan 208 (schema centralization), Plan 098 (i18n drift)

## 1. Analysis

### Critical Integration Bugs

| ID | Gap | Priority | Location | Fix |
|----|-----|----------|----------|-----|
| F1 | Progress save always fails — frontend sends `{cfi}` only, backend requires `MultiSignalLocatorSchema` (cfi+selectedText+chapterRef) | P0 | `useEpubProgress.ts:57`, `sync.ts:179-187`, `progress.ts:60` | Relax `ProgressUpdateSchema` to accept partial locator OR fix frontend to send full locator |
| F2 | Offline sync sends POST for progress but worker only registers PUT | P0 | `sync.ts:179` | Change `api.post` to `api.put` or use `apiRequest` with PUT |
| F3 | Offline highlight sync sends flat fields instead of nested `locator` object | P0 | `sync.ts:195-202` | Restructure payload to match `HighlightCreateSchema` |
| F4 | Offline bookmark sync sends `chapter` instead of `chapterRef`, empty `selectedText` fails min(1) | P0 | `sync.ts:204-212` | Fix field names, populate selectedText from annotation text |
| F5 | Offline comment sync sends flat locator fields, silently stripped by server | P1 | `sync.ts:214-221` | Restructure to use nested `locator` object |
| F6 | Offline resolve/reply queued items missing `type` field, misrouted by syncItem | P1 | `useAnnotationHandlers.ts:184-188`, `useReaderHandlers.ts:138-142` | Add `type: 'comment-resolve'` to queue item, handle in syncItem |
| F7 | Dead code: `if (!navigator.onLine)` after successful API call never executes | P2 | `useAnnotationHandlers.ts:78,136`, `useReaderHandlers.ts:45,92` | Remove dead offline-after-online branches |
| F8 | Progress entity type mislabeled as 'highlight' in parseLocatorRow | P2 | `progress.ts:46` | Change to `'progress'` |
| F9 | Legacy `AnnotationLocatorSchema` exported but unused | P3 | `schemas.ts:33-43` | Remove dead export |

### Out of Scope
- FTS5 indexing pipeline (separate feature, not a bug fix)
- Service worker tests (testing infrastructure, not schema mismatch)
- NotificationPanel inline Zod schemas (minor, not breaking)

## 2. Decomposition

| Task | Priority | Deps | Skill |
|------|----------|------|-------|
| T1: Fix ProgressUpdateSchema to accept partial locator (F1) | P0 | None | `code-quality` |
| T2: Fix offline sync progress PUT method (F2) | P0 | None | `code-quality` |
| T3: Fix offline sync highlight payload shape (F3) | P0 | None | `code-quality` |
| T4: Fix offline sync bookmark payload shape (F4) | P0 | None | `code-quality` |
| T5: Fix offline sync comment payload shape (F5) | P1 | None | `code-quality` |
| T6: Fix offline resolve/reply queue type routing (F6) | P1 | None | `code-quality` |
| T7: Remove dead offline-after-online branches (F7) | P2 | None | `code-quality` |
| T8: Fix progress entity type label (F8) | P2 | None | `code-quality` |
| T9: Remove legacy AnnotationLocatorSchema (F9) | P3 | None | `code-quality` |
| T10: Update sync.test.ts to validate against real schemas | P1 | T1-T6 | `testing-strategy` |
| G1: Run quality gate | P1 | T1-T10 | — |
| G2: Create PR + address CI feedback | P1 | G1 | `github-workflow` |
| G3: Review and roast PR | P1 | G2 | `code-review-assistant` |

## 3. Execution Strategy

**Hybrid** — T1-T9 parallel (independent fixes), T10 sequential (needs T1-T6), G1-G3 sequential.

### Phase 1: Implementation (Parallel Swarm)
- T1 + T2 + T3 + T4 + T5 + T6 + T7 + T8 + T9 — all parallel

### Phase 2: Test Updates (Sequential)
- T10: Update sync.test.ts to validate against real schemas

### Phase 3: Validation (Sequential)
- G1: Quality gate
- G2: PR creation + CI

### Phase 4: Review (Sequential)
- G3: Roast the PR

## 4. Acceptance Criteria

- [ ] `ProgressUpdateSchema` accepts partial locator (cfi-only for progress saves)
- [ ] Offline progress sync uses PUT method matching worker route
- [ ] Offline highlight sync sends nested `locator` object matching `HighlightCreateSchema`
- [ ] Offline bookmark sync sends `chapterRef` (not `chapter`) and non-empty `selectedText`
- [ ] Offline comment sync sends nested `locator` object
- [ ] Offline resolve/reply items have `type` field and are handled correctly in `syncItem`
- [ ] Dead `if (!navigator.onLine)` branches after successful API calls are removed
- [ ] Progress `parseLocatorRow` uses `'progress'` entity type
- [ ] Legacy `AnnotationLocatorSchema` removed from schema package
- [ ] `sync.test.ts` validates payloads against real Zod schemas
- [ ] `./scripts/quality_gate.sh` passes
- [ ] PR created and CI green
