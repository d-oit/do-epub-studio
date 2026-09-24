# ADR-280: `.agents/AGENTS.md` Is a Thin Pointer, and `ADAPTERS` Is the Enforcement List

**Status:** Accepted
**Date:** 2026-09-24
**Supersedes:** none
**Related:** Plan `plans/280-goap-nested-agents-thin-adapter.md`, GOAP-276 Phase 0 item 7 (`plans/276-goap-external-harness-benchmark-adoption.md`), plans/068 + issue #445 (guard origin), AGENTS.md Tier 2 #9/#12, ADR-083 (numbering)

---

## Context

`.agents/AGENTS.md` was a 197-LOC parallel document: a non-standard YAML
frontmatter, zero shared section headings with root `AGENTS.md`, and content
(version pins, warnings, test recipes) that duplicated or drifted from the
canonical sources. It was absent from `scripts/check-agent-sync.mjs`, and it
would have failed 3 of the guard's 4 adapter rules (>80 LOC; zero occurrences
of the literal `AGENTS.md`; forbidden-heading pass only by luck of heading
wording).

The guard itself had a trap: `ADAPTERS` was decorative — used only for the
success-log count — while five hardcoded `check*Adapter()` functions did the
real work. Any fix that only appended a path to `ADAPTERS` would have shipped
with zero enforcement.

### Spec basis

- The **agents.md specification** (donated to the Linux Foundation's
  Agentic AI Foundation Dec 2025; adopted by Anthropic/Claude Code Sep 2026)
  requires **no sections** and defines AGENTS.md as plain Markdown. Nested
  files load by **"closest AGENTS.md wins"** precedence → a nested file must
  **specialize, never duplicate** the root.
- The spec defines no size limit, but tool budgets cap the chain:
  **OpenAI Codex caps combined instruction bytes at 32 KiB
  (`project_doc_max_bytes`)** — re-stating 180 root lines in a nested file
  wastes that budget and recreates the two-sources-of-truth drift this
  guard exists to kill (the version table was already stale: Vite 8.2.2 vs
  8.3.0, DOMPurify 3.4.14 vs ^3.4.15, react-router-dom ^7.18.2 vs ^7.18.4).

## Decision

1. **`.agents/AGENTS.md` becomes a thin pointer (22 LOC, cap 80)** — modeled
   on root `CLAUDE.md` ("THIN ADAPTER … read `AGENTS.md`"), containing the
   literal `AGENTS.md`, pointing to `../AGENTS.md`, plus the one honest
   `.agents/`-scope specialization: skill-scoped learnings go to
   `.agents/skills/<name>/AGENTS.md` (root AGENTS.md Tier 2 #12).
   - **Mirror rejected**: a generated/kept-in-sync mirror recreates drift
     (the exact failure observed here) and doubles the Codex 32 KiB budget.
   - **Delete rejected**: breaks the repo's "adapters exist and point back"
     philosophy (plans/068 / issue #445); kept as acceptable fallback only if
     a future reviewer prefers it — the guard tolerates absence only by
     removing the array entry too ("delete the rule, not the file").
2. **`ADAPTERS` becomes genuinely the enforcement list**: a single
   `for (const relPath of ADAPTERS)` loop replaces the five hardcoded
   functions; `.agents/AGENTS.md` is a member. All four rules kept
   (≤80 LOC, no root section headings, no verbatim root head copy, must
   reference `AGENTS.md`) plus the missing-file rule and both LOC caps.
   Future adapters cost one array entry.

## Content disposition (old `.agents/AGENTS.md` → action → destination)

| # | Section / row | Action | Destination / justification (verified) |
|---|---|---|---|
| 1 | YAML frontmatter (`version`/`name`/`description`) | Delete | agents.md spec: plain Markdown, no frontmatter |
| 2 | Version table — React 19.x / `useOptimistic` notes | Delete | `apps/web/package.json` (`react: ^19`); React 19 API pointers in `DESIGN.md` §Platform APIs |
| 3 | Version table — TypeScript ^6.0.3 strict | Delete | `package.json` (`typescript: ^6.0.3`); root `CLAUDE.md` "TypeScript 6 strict" |
| 4 | Version table — Vitest 4.1.11, `pool: 'forks'`, no `singleFork` | Delete | `package.json` (4.1.11) + ADR-216 + root AGENTS.md Tier 3 |
| 5 | Version table — Vite **8.2.2 (stale; actual 8.3.0)**, plugin-react ^6 | Delete | `apps/web/package.json` (`vite: 8.3.0`) — machine-readable truth |
| 6 | Version table — vite-plugin-pwa ^1.3.0, SW classic per ADR-251 | Delete | `apps/web/package.json` + ADR-251 |
| 7 | Version table — DOMPurify **3.4.14 (stale; actual ^3.4.15)** | Delete | `packages/reader-core/package.json` |
| 8 | Version table — `@intity/epub-js` 0.3.96 pin rationale (non-derivable) | Drop — already relocated | `agents-docs/LEARNINGS.md` L306 (0.3.97 runtime API break) + L379 (0.3.97/0.3.98 tarballs ship no `main`/`module` files) |
| 9 | "Before Any Implementation" (pnpm outdated / no CVEs / minimal deps) | Drop as duplicate | `.agents/skills/security-code-auditor/references/security-checklist.md` ("Before adding dependencies…", A06 "Remove unused dependencies") |
| 10 | Dependency Overrides — pnpm 10 ignores `package.json` `pnpm.overrides` | Drop as duplicate | `agents-docs/LEARNINGS.md` L382 + the `overrides:` block itself in `pnpm-workspace.yaml` (migrated 2026-09-10) |
| 11 | OWASP Top-10 EPUB adaptations + 3 key guardrails (A01/A03/A10) | Drop as duplicate | `.agents/skills/security-code-auditor/references/owasp-top10.md` — A01 permission check, A03 DOMPurify sanitize, A10 block-external-URLs sections all verified present |
| 12 | Test Guardrails — demo-account seed + live e2e recipe | Relocate as pointer (1-line pointer kept) | `plans/256-goap-demo-login-e2e-vertical.md` (D1 sqlite seed, `E2E_LIVE_DEMO=1` command) + `scripts/seed-demo-accounts.mjs` header (usage, fail-closed guards) |
| 13 | Test Guardrails — vitest config snippet (`pool: 'forks'`, no `singleFork`) | Drop as duplicate | `plans/216-adr-vitest-pool-policy.md` + root AGENTS.md Tier 3 |
| 14 | Test Isolation Rules 1–4 (separate fork, mock before render, `beforeEach` clear, `waitFor`) | Drop as duplicate | ADR-216 (isolation default, reset explicit) + `.agents/skills/testing-strategy/references/test-patterns.md` ("Mock Timing", DO/DON'T list) |
| 15 | Common Test Failures & Fixes table | Drop as duplicate | `test-patterns.md` (singleFork/mocking/waitFor) — all three rows covered |
| 16 | Handoff Coordination (ASCII team diagram, `TaskUpdate`/`SendMessage`/`TaskList` protocol, spawn guidance) | **Retire — dead protocol** | `grep -r TaskUpdate\|SendMessage\|TaskList` matches this file only; no tool in this harness exposes that protocol |
| 17 | Known Warnings #1 — React Router future flags **RESOLVED (2026-08-23)** | Drop — resolved + derivable | `apps/web/package.json` pins `react-router-dom ^7.18.4` → v6-era `v7_startTransition`/`v7_relativeSplatPath` flags are no-ops; router-v7 warning cleanup record: `plans/archive/241-goap-warning-closure.md` |
| 18 | Known Warnings #2 — ESLint `no-autofocus` in tests (STILL LIVE, unique) | **Relocate → this ADR §Relocated warnings** | Per Tier 2 #9: documented here (GOAP plan + ADR), NOT in `agents-docs/KNOWN-ISSUES.md`; inline justifications at each suppression site per Tier 2 #7 (Gap fixed: `HighlightItem.tsx:70` had none) |
| 19 | Known Warnings #3 — rolldown `EMPTY_IMPORT_META` (live, documented) | Drop as duplicate | `agents-docs/LEARNINGS.md` L383 (identical text) |
| 20 | Known Warnings #4 — `pnpm.overrides` **MIGRATED (2026-09-10)** | Drop — resolved + duplicate | `agents-docs/LEARNINGS.md` L382 + `pnpm-workspace.yaml` |
| 21 | Known Warnings #5 — Cloudflare-login e2e needs live backend | Drop as duplicate | `plans/999-goap-codebase-improvements-uiux-e2e-audit.md` E2E-02 (dedicated `live-cloudflare` project, fail-closed prerequisites, "do not weaken duplicate-copy assertions" policy) |
| 22 | Security Issues table — EPUB sanitization row | Drop as duplicate | `docs/security-posture.md` §"EPUB sanitization (DOMPurify, ADR-006)" |
| 23 | Security Issues table — External URL blocking **"Partial… follow-up" (STALE)** | Delete — stale | Hardening completed by GOAP-229: `ExternalUrlPolicy` host allowlist + fetch-level CSP guard in `packages/reader-core/src/sanitizer.ts` (PR #972, `plans/archive/229-goap-external-url-hardening.md`) |
| 24 | Security Issues table — Session token rotation row | Drop as duplicate | `docs/security-posture.md` (grant-change revocation, `/refresh` flow) + ADR-234 + `routes.access.test.ts` |
| 25 | Reference Files (skill/security/test reference lists) | Drop as duplicate | Skill tree self-describes; `agents-docs/AVAILABLE_SKILLS.md` |
| 26 | Agent Skill Activation table (8 skills) | Drop as duplicate | `agents-docs/AVAILABLE_SKILLS.md` (generated by `scripts/generate-available-skills.py`) |

### Relocated warnings (recorded here per AGENTS.md Tier 2 #9)

Still-live content that had no other home lands in this plan/ADR —
deliberately **not** in `agents-docs/KNOWN-ISSUES.md`, whose direct edits
Tier 2 #9 forbids:

- **`jsx-a11y/no-autofocus` suppressions are intentional** — test files
  exercise the `autoFocus` prop itself; conditional editors
  (`CommentItem.tsx`, `CommentInputModal.tsx`, `HighlightItem.tsx`
  note editor) auto-focus only after a user action, improving workflow.
  Every suppression site now carries the inline justification root
  AGENTS.md Tier 2 #7 requires (the `HighlightItem.tsx:70` gap was fixed in
  this change set). Workaround form:
  `// eslint-disable-next-line jsx-a11y/no-autofocus -- <why>`.

## Consequences

### Positive

- Nested AGENTS.md guidance cannot drift again: 22-LOC pointer, four rules,
  machine-enforced in CI (`.github/workflows/ci.yml`) and
  `scripts/quality_gate.sh` — no gate wiring changes needed.
- `ADAPTERS` = enforcement list; the next nested adapter costs 1 line and
  cannot ship unchecked (the GOAP-276 Phase 0 #7 trap is structurally closed).
- ~175 LOC of duplicated/stale guidance removed from the nested instruction
  chain (Codex 32 KiB budget + no two-sources-of-truth).

### Negative

- Slightly longer discovery path for `.agents/` scope rules (must follow the
  pointer to root or a destination file) — accepted per spec precedence.

### Neutral

- Root `AGENTS.md` unchanged (canonical, 180/200 LOC); guard LOC shrank
  201 → 149.

## Compliance

- agents.md spec: plain Markdown, specialize-don't-duplicate, closest-wins.
- Root AGENTS.md Tier 2 #9 (issues as GOAP + ADR, not KNOWN-ISSUES.md),
  Tier 2 #12 (learnings scoping), Tier 2 #7 (inline lint-suppression
  justification), Tier 1 (pre-existing issues fixed in the same change set).
- Guard invariants preserved: canonical ≤200 LOC, adapters ≤80 LOC, all
  four adapter rules, exit codes 0/1/2.
