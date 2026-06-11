# Plan 042: GOAP Learnings Lifecycle Implementation

## Goal
Improve the codebase by ensuring all AI coding agents utilize previous learnings from step 1 of their sessions, and establish a compaction standard to prevent `agents-docs/LEARNINGS.md` from becoming bloated with redundant, deprecated, or obsolete entries.

## Initial World State
- `AGENTS.md` is 142 lines long, close to its 150-line limit, and lacks an explicit blocking gate for loading and applying previous learnings.
- `agents-docs/LEARNINGS.md` has grown to 117 lines (21KB+) of unstructured, chronological bullet points with several duplicates (e.g., TS 6.0 baseUrl deprecations) and session-specific, highly transient merge logs.
- No automated or codified standard exists for compacting learnings, leading to context bloat for subsequent agent runs.

## Desired World State
- `AGENTS.md` strictly under 150 lines, including a new Quality Gate rule enforcing learnings loading as Step 1, and establishing the compaction policy.
- `agents-docs/LEARNINGS.md` restructured into high-density, categorized sections under 20KB/100 lines, with all duplicates and deprecated entries removed/pruned.
- `docs/plans/043-adr-learnings-compaction-policy.md` written and adopted as the system policy.

---

## Action Graph (Phases)

### Phase 1: Research & Policy Definition
- **Tasks**:
  - Review all current 117 lines of `LEARNINGS.md` to identify redundancies, deprecated items, and logical categories.
  - Draft `docs/plans/043-adr-learnings-compaction-policy.md` defining the rules of learnings lifecycle, usage, and compaction.
- **Quality Gate**: Plan and ADR reviews complete.

### Phase 2: Compaction & Structuring of LEARNINGS.md
- **Tasks**:
  - Re-classify all valid learnings into four compact, high-density categories:
    1. **Core Workflows & Process (GOAP, Git, PRs, Dependabot)**
    2. **Testing & Test Isolation (Vitest, Playwright, jsdom, Testkit)**
    3. **Build, CI/CD & Security (GitHub Actions, CodeQL, Codecov, ReDoS)**
    4. **React & Frontend Core (EPUB.js, TypeScript, OKLCH, UI Tokens)**
  - Prune duplicate entries (e.g. `baseUrl` TS6 deprecations on lines 72 and 82).
  - Condense chronological PR merge session details (lines 110-114) into generalized workflows.
- **Quality Gate**: `LEARNINGS.md` has no duplicates, is structured, and total size is reduced.

### Phase 3: AGENTS.md Hardening
- **Tasks**:
  - Add a Tier 2 rule enforcing learnings usage as Step 1.
  - Add a rule for learnings lifecycle compaction.
  - Refactor `AGENTS.md` sections (e.g., table alignments, redundant lists) to guarantee the entire file remains strictly under **150 lines**.
- **Quality Gate**: `wc -l AGENTS.md` is less than 150. `./scripts/minimal_quality_gate.sh` passes.

---

## Exit Criteria
- `AGENTS.md` line count < 150.
- `LEARNINGS.md` size < 20KB, highly readable, structured, and free of redundant or obsolete data.
- Quality gates run and pass successfully.
