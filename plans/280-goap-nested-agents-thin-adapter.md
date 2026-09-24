# GOAP-280: `.agents/AGENTS.md` Thin Pointer + Real Adapter Enforcement

**Status:** IN PROGRESS (implementation complete in this change set; gate + commit + PR by parent session)
**Date:** 2026-09-24
**Parent:** GOAP-276 Phase 0 item 7 (`plans/276-goap-external-harness-benchmark-adoption.md`)
**ADR:** `plans/280-adr-nested-agents-thin-adapter.md`
**Related:** plans/068 + issue #445 (drift guard origin), AGENTS.md Tier 2 #9/#12, ADR-083 (numbering)

## Problem

`.agents/AGENTS.md` (197 LOC, non-standard YAML frontmatter) escaped
`scripts/check-agent-sync.mjs` entirely, and the guard had a structural trap:
the `ADAPTERS` array was **decorative** — only consumed for the success-log
count — while five hardcoded `check*Adapter()` functions did the actual
enforcement. Adding a path to `ADAPTERS` alone would have shipped unchecked.
The nested file itself would have failed 3 of 4 adapter rules (>80 LOC; zero
occurrences of the literal `AGENTS.md`) and carried stale "current version"
pins (Vite 8.2.2 vs `apps/web/package.json` 8.3.0; DOMPurify 3.4.14 vs
`packages/reader-core/package.json` ^3.4.15; react-router-dom ^7.18.2 vs
^7.18.4) — exactly the two-sources-of-truth drift class the guard exists to
kill.

## Decision

See ADR-280: rewrite `.agents/AGENTS.md` as a ≤80-LOC thin pointer
(option a: pointer; mirror and delete rejected), refactor the guard so
`ADAPTERS` is genuinely the enforcement list via a single loop, and
relocate/retire every unique section per the ADR's content-disposition
table.

## Phases

1. **Rewrite `.agents/AGENTS.md`** as a thin pointer: literal `AGENTS.md`
   reference, `../AGENTS.md` canonical link, and the one honest
   `.agents/`-scope specialization (skill-scoped learnings →
   `.agents/skills/<name>/AGENTS.md` per root AGENTS.md Tier 2 #12).
2. **Refactor `scripts/check-agent-sync.mjs`**: `for (const relPath of ADAPTERS)`
   replaces the five hardcoded functions; `.agents/AGENTS.md` becomes a
   member; all four adapter rules and both LOC caps retained.
3. **Content disposition** per ADR-280 table: unique still-live content
   relocated (recorded in the ADR per Tier 2 #9 — NOT in
   `agents-docs/KNOWN-ISSUES.md`), duplicates dropped with destinations
   verified by grep, stale/resolved rows deleted.
4. **Fix surfaced pre-existing issue**: `HighlightItem.tsx:70` had the only
   `jsx-a11y/no-autofocus` suppression missing the inline justification
   root AGENTS.md Tier 2 #7 requires.

## Verification (executed 2026-09-24)

- `node scripts/check-agent-sync.mjs` → exit 0, "6 adapter files checked".
- Break tests on `.agents/AGENTS.md`, each exit 1 then restored:
  forbidden heading `## Key Commands`; missing `AGENTS.md` literal;
  member file deleted (missing-adapter rule).
- `wc -l .agents/AGENTS.md` = 22 (cap 80); `grep -c "AGENTS.md"` = 7 (≥1).
- `node scripts/check-adr-index.mjs` → exit 0 (ADR-083).
- `agents-docs/KNOWN-ISSUES.md` untouched (`git status` clean for it).

## Out of scope (parent session)

- `./scripts/quality_gate.sh` run (AGENTS.md Tier 2 #13 serialization —
  worktree has no `node_modules`; run `pnpm install` first), commit, push,
  PR, Codacy re-check.
- Ticking Phase 0 item 7 in `plans/276-goap-external-harness-benchmark-adoption.md`
  once this merges.
