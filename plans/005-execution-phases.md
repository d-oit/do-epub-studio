# EXECUTION PHASES (GOAP Roadmap)

Only after TRIZ + design. References ADR-002 through ADR-006.

## Phase 0: Foundation ✅

**Completed:**
- [x] pnpm + Turbo monorepo setup
- [x] apps/web, apps/worker structure
- [x] packages/ skeleton
- [x] Skills installed (skill-creator, skill-evaluator, triz-analysis, triz-solver)
- [x] wrangler.jsonc configured
- [x] TRIZ analysis complete
- [x] TRIZ resolution complete
- [x] ADRs created (storage, auth, offline, annotation, monorepo)

## Phase 1: Schema + Access System

**Contradiction solved:** #1 Security vs Usability  
**TRIZ Principles:** #12 Equipotentiality, #8 Anti-Weight, #20 Continuity

### Tasks

| # | Task | Package | Deliverable |
|---|------|---------|-------------|
| 1.1 | Create SQL migrations | packages/schema | 0001-initial-schema.sql |
| 1.2 | Define DTOs and enums | packages/shared | types.ts, enums.ts |
| 1.3 | Zod validation schemas | packages/shared | schemas.ts |
| 1.4 | Access request endpoint | apps/worker | POST /api/access/request |
| 1.5 | Password validation (Argon2id) | apps/worker | auth/password.ts |
| 1.6 | Session token issuance | apps/worker | session.ts |
| 1.7 | Signed R2 URL generation | apps/worker | storage/signed-url.ts |
| 1.8 | Audit logging middleware | apps/worker | audit.ts |
| 1.9 | Session refresh endpoint | apps/worker | POST /api/access/refresh |
| 1.10 | Logout endpoint | apps/worker | POST /api/access/logout |

### Acceptance Criteria

- [ ] Grant created via admin
- [ ] Reader authenticates with email + optional password
- [ ] Session token issued
- [ ] Signed URL returned for EPUB
- [ ] Audit log entries created

## Phase 2: Reader MVP

**Contradiction solved:** #4 Simplicity vs Feature Richness  
**TRIZ Principles:** #15 Dynamics, #10 Preliminary Action

### Tasks

| # | Task | Package | Deliverable |
|---|------|---------|-------------|
| 2.1 | Vite + PWA setup | apps/web | vite.config.ts, manifest.json |
| 2.2 | EPUB.js integration | packages/reader-core | epub-loader.ts |
| 2.3 | TOC extraction | packages/reader-core | toc.ts |
| 2.4 | Basic reader UI | apps/web | ReaderPage.tsx |
| 2.5 | Theme controls (light/dark/sepia) | apps/web | ThemeSelector.tsx |
| 2.6 | Typography controls | apps/web | TypographyControls.tsx |
| 2.7 | Progress save/restore | apps/web | progress.ts |
| 2.8 | Bookmarks CRUD | apps/web | BookmarkButton.tsx |
| 2.9 | Resume position UI | apps/web | ResumePrompt.tsx |

### Acceptance Criteria

- [ ] EPUB loads in browser
- [ ] TOC navigation works
- [ ] Theme/typography changes apply
- [ ] Progress persists across sessions
- [ ] Bookmarks save

## Phase 3: Offline Sync

**Contradiction solved:** #2 Offline vs Access Control, #5 Local-first vs Consistency  
**TRIZ Principles:** #1 Segmentation, #8 Anti-Weight, #23 Feedback

### Tasks

| # | Task | Package | Deliverable |
|---|------|---------|-------------|
| 3.1 | Service worker setup | apps/web | sw.ts |
| 3.2 | Cache Storage strategy | apps/web | cache-strategy.ts |
| 3.3 | IndexedDB schema | apps/web | db.ts |
| 3.4 | Sync queue implementation | apps/web | sync-queue.ts |
| 3.5 | Permission caching | apps/web | permission-cache.ts |
| 3.6 | Offline detection | apps/web | useOnlineStatus.ts |
| 3.7 | Zombie detection | apps/web | session-validator.ts |
| 3.8 | Conflict resolution UI | apps/web | ConflictResolver.tsx |

### Acceptance Criteria

- [ ] App works offline after first visit
- [ ] Annotations save locally
- [ ] Sync queue processes on reconnect
- [ ] Revoked sessions detected on sync

## Phase 4: Editorial Features

**Contradiction solved:** #3 Performance vs Flexibility  
**TRIZ Principles:** #6 Universality, #35 Parameter Changes, #30 Flexible Shells

### Tasks

| # | Task | Package | Deliverable |
|---|------|---------|-------------|
| 4.1 | Highlight creation | apps/web | HighlightButton.tsx |
| 4.2 | CFI anchor extraction | packages/reader-core | cfi.ts |
| 4.3 | Comment panel UI | apps/web | CommentPanel.tsx |
| 4.4 | Comment CRUD API | apps/worker | comments routes |
| 4.5 | Reply threading | apps/web | CommentThread.tsx |
| 4.6 | Comment status (open/resolved) | apps/web | CommentStatus.tsx |
| 4.7 | Re-anchoring logic | packages/reader-core | reanchor.ts |
| 4.8 | Annotation sync | apps/web | annotation-sync.ts |

### Acceptance Criteria

- [ ] Text selection creates highlight
- [ ] Comments attach to location
- [ ] Replies thread correctly
- [ ] Comments can be resolved
- [ ] Offline comments sync

## Phase 5: Admin UI

### Tasks

| # | Task | Package | Deliverable |
|---|------|---------|-------------|
| 5.1 | Books list page | apps/web | BooksPage.tsx |
| 5.2 | Book creation form | apps/web | CreateBookForm.tsx |
| 5.3 | EPUB upload | apps/web | UploadEpub.tsx |
| 5.4 | Grant management | apps/web | GrantEditor.tsx |
| 5.5 | Audit log viewer | apps/web | AuditLog.tsx |
| 5.6 | Book settings | apps/web | BookSettings.tsx |

## Phase 6: Hardening

### Tasks

- Accessibility audit (WCAG 2.1 AA)
- Security audit (OWASP)
- Performance optimization
- Regression test coverage
- Documentation completion

## Quality Gate

Before moving to next phase:
```bash
./scripts/quality_gate.sh
```

## Rule

Each phase must reference which contradiction it solves and which TRIZ principles apply.
