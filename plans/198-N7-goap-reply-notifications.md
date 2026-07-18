# Plan 198-N7: GOAP — Comment Reply Notifications

**Status:** ✅ COMPLETED (Plan 199 verified 2026-07-18 — notification system implemented)
**Date:** 2026-07-18
**Decision:** ADR-198 (Verified-Closure Methodology)
**Priority:** P3
**Source:** Plan 121 (N7), Plan 120 (Cluster 12)
**Ships as:** `feat/comment-reply-notifications`

## Goal

Notify users when someone replies to their comment, enabling asynchronous
discussion within the reading experience.

## Context

The comment system supports `parent_comment_id` for threaded replies, but
there is no notification mechanism. Users must manually check for replies.

## Decompose

| ID | Task | Effort | Deps |
|----|------|--------|------|
| T1 | Design notification schema (D1 `notifications` table) | S | — |
| T2 | Add notification trigger on comment reply (Worker route) | M | T1 |
| T3 | Create `GET /api/notifications` endpoint with pagination | M | T1 |
| T4 | Add notification badge to ReaderToolbar | S | T3 |
| T5 | Create NotificationPanel component | M | T3 |
| T6 | Add i18n keys for notification types | S | T5 |
| T7 | Add tests (Worker + web component) | M | T5 |

## Risks

- **Notification volume:** Active discussions could generate many notifications
- **Privacy:** Notifications may reveal reading activity to other users
- **Offline:** Notifications need offline queue consideration

## Acceptance Criteria

- [ ] Replying to a comment creates a notification for the parent author
- [ ] Notifications appear in a panel accessible from the toolbar
- [ ] Notifications are paginated and mark-as-read
- [ ] i18n keys exist for all notification strings
- [ ] Tests cover notification creation, retrieval, and UI
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` pass
