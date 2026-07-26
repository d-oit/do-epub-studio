# Plan 200: GOAP — Final Cleanup & Compliance Swarm

**Status:** COMPLETED
**Date:** 2026-07-23
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Strategy:** Swarm — independent tasks executed in parallel

## Goal

Close the remaining small compliance, safety, and documentation gaps found in the
2026-07-23 codebase audit. All items are independent and can be executed in parallel.

## Audit Results (2026-07-23)

| Signal | Result |
|--------|--------|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS (7/7) |
| `pnpm test:unit` | PASS (862 web tests) |
| `pnpm build` | PASS |
| `./scripts/validate-workflows.sh` | PASS (11/11) |
| FIXME/HACK/@ts-ignore | 0 |
| Open issues | 0 |
| Open PRs | 1 (Dependabot #830 — failing lint CI) |
| Prior GOAP plans | All COMPLETED (195-199) |

## Tasks

### T1: ADR Status Field Corrections (P2)
- 4 ADR files say "Proposed" but ADR-INDEX marks them "Accepted"
- ADR-113 Decision #2 promoted 105, 107, 110, 113 to Accepted
- Update file headers in: 105, 107, 110, 113

### T2: Zod Validation for Notification Fetch Calls (P1)
- `NotificationBadge.tsx:21` and `NotificationPanel.tsx:42` use `res.json()` with `as` cast
- Replace with Zod schema validation for runtime type safety
- Add `UnreadCountResponseSchema` and `NotificationResponseSchema`

### T3: Structured Logger in Service Worker (P2)
- `sw.ts:95` uses raw `console.error('Error estimating storage:', err)`
- Convert to structured JSON logging matching existing SW pattern
- Use `{ level, traceId, event, error }` format

### T4: WCAG 2.2 Touch Target Documentation Fix (P2)
- AGENTS.md does NOT reference 44px — no change needed
- WCAG 2.2 AA (SC 2.5.8) requires 24px minimum
- Project already uses 44px (exceeds AAA requirement)

### T5: Review Dependabot PR #830 (P1)
- `@fontsource/instrument-serif` 5.2.8 → 5.3.0
- PR has failing lint CI checks (pre-existing) — cannot merge per AGENTS.md

## Task Completion Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T1 (ADR status) | ✅ | 4 ADR files updated: 105, 107, 110, 113 → "Accepted" |
| T2 (Zod validation) | ✅ | `NotificationBadge.tsx` + `NotificationPanel.tsx` use Zod `.parse()` |
| T3 (structured log) | ✅ | `sw.ts:94-99` — JSON structured error with traceId |
| T4 (WCAG docs) | ✅ | N/A — AGENTS.md doesn't reference 44px; no change needed |
| T5 (Dependabot PR) | ⚠️ | PR #830 has failing lint CI — blocked per AGENTS.md |

## Acceptance Criteria

- [x] ADR 105, 107, 110, 113 file headers updated to "Accepted"
- [x] Notification components use Zod validation for fetch responses
- [x] SW console.error uses structured logging format
- [x] WCAG touch target assessment complete (no AGENTS.md change needed)
- [ ] Dependabot PR #830 — blocked by failing lint CI (pre-existing)
- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes (7/7)
- [x] `pnpm test:unit` passes (862 web tests)
- [x] `pnpm build` passes

## Execution Strategy

**Swarm** — all 5 tasks are independent and executed in parallel.

| Task | Agent Type | Dependencies |
|------|-----------|-------------|
| T1 (ADR status) | code-quality | None |
| T2 (Zod validation) | code-quality | None |
| T3 (structured log) | code-quality | None |
| T4 (WCAG docs) | accessibility-auditor | None |
| T5 (Dependabot PR) | code-review-assistant | None |

## Learnings

1. **Zod v4 is available in both web and shared packages** — use `z.object().parse()` for runtime validation of fetch responses instead of type assertions with `as`.
2. **Service Worker structured logging** — always use `JSON.stringify()` with `{ level, traceId, event, error }` format, matching the pattern in `observability.ts`.
3. **ADR status hygiene** — when ADR-INDEX marks an ADR as "Accepted", the file header must be updated too. ADR-113 Decision #2 promoted 4 ADRs but the files were never patched.
4. **WCAG 2.2 AA touch target is 24px minimum (SC 2.5.8)** — the 44px figure is Level AAA (SC 2.5.5). Projects targeting AA should use 24px; projects targeting AAA should use 44px.
5. **Dependabot PRs with failing CI** — per AGENTS.md, never merge with failing checks. The lint failures on PR #830 are pre-existing and need separate resolution.
