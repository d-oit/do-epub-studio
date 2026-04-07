# 001: GOAP Roadmap

## Initial World State
- No scaffold, no schema, no access flow, no reader, no admin UI

## Target World State
- Deployable PWA
- Secure grants and sessions
- Private/public book modes
- Offline reading
- Comments/highlights
- Tests and docs

## Ordered Phases
1. Foundation: monorepo, AGENTS.md, plans, ADRs, CI
2. Domain and schema: enums, DTOs, migrations, test fixtures
3. Access backend: access routes, sessions, signed URLs, audit logging
4. Reader MVP: EPUB.js, TOC, progress save/restore
5. Offline support: service worker, IndexedDB, sync queue
6. Editorial features: highlights, comments, replies
7. Admin UI: books, upload, grants, revoke, audit
8. Hardening: accessibility, security, performance
