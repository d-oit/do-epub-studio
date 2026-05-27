# ADR-043: Learnings Lifecycle and Compaction Policy

**Status:** ✅ Accepted — Policy validated by ongoing learnings compaction in Plans 042, 059-062

## Context
As the project grows, AI coding agents document critical runtime breakthroughs, tool behaviors, and config quirks in `agents-docs/LEARNINGS.md`. However, without an active lifecycle policy:
- The list grew chronologically, resulting in unstructured bullet points that are hard to scan.
- Redundant and duplicate entries accumulated (e.g., TS6 `baseUrl` deprecations documented multiple times).
- Session-specific, highly transient logs (e.g. details of a specific PR merge wave) bloated the file.
- Subsequent agents spent valuable context window space reading outdated or repetitive entries.
- In `AGENTS.md`, there was no explicit, blocking Quality Gate rule forcing agents to load/apply learnings at Step 1, causing occasional re-discovery of known quirks.

## Decision
We establish a strict, formal policy for the capture, usage, and lifecycle of project learnings.

### 1. Mandatory Usage (Quality Gate Step 1)
- Every agent session **MUST** start by loading and reviewing `agents-docs/LEARNINGS.md` (or running `skill learn` or checking csm CLI memory context) before editing files.
- This rule is added as a **TIER 2 (Quality Gates - Blocking)** requirement in `AGENTS.md`.

### 2. High-Density Categorization
All learnings in `agents-docs/LEARNINGS.md` must be classified under four high-density, logical headers:
1. **Core Workflows & Process (GOAP, Git, PRs, Dependabot)**
2. **Testing & Test Isolation (Vitest, Playwright, jsdom, Testkit)**
3. **Build, CI/CD & Security (GitHub Actions, CodeQL, Codecov, ReDoS)**
4. **React & Frontend Core (EPUB.js, TypeScript, OKLCH, UI Tokens)**

### 3. Compaction and Pruning Trigger
- When `agents-docs/LEARNINGS.md` exceeds **100 entries** or **20KB**, it triggers a mandatory compaction task.
- **Compaction rules**:
  - **Prune duplicates**: Remove any identical or overlapping rules.
  - **Prune obsolete items**: Remove entries about tools or versions that have been fully replaced.
  - **Consolidate**: Group related narrow entries into a single comprehensive bullet.
  - **Generalize**: Convert session-specific details (such as a specific PR number or date) into generalized workflow rules.

### 4. AGENTS.md Line Limits Preservation
- `AGENTS.md` must strictly adhere to the named constant `MAX_LINES_AGENTS_MD=150`.
- To integrate the new learnings rules without exceeding 150 lines, `AGENTS.md` sections will be optimized for brevity, removing trailing empty lines, merging short rules, and simplifying long Markdown tables.

## Consequences
- **Positive**:
  - Context window consumption for agents is significantly reduced.
  - Agents immediately benefit from clean, structured, non-redundant guidelines.
  - Preventing re-discovery of known tool/config quirks is codified in the blocking quality gate.
- **Negative**:
  - Compaction requires periodic manual/agent attention when the size threshold is crossed.
