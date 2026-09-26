# ADR-288: Format ownership is partitioned, and a formatting change is never growth

**Date:** 2026-09-26
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-288 (`plans/288-goap-prettier-cleanup.md`), #1182, ADR-278 (LOC ratchet), ADR-285 (hook parity), AGENTS.md Tier 2 #6

## Context

Paying the #1182 formatting debt in one commit (`prettier --write` over 915
files) surfaced three conflicts, each between a gate that was correct in
isolation and wrong once the tools were allowed to touch each other's files.
None was a formatting mistake. All three were measurement or ownership bugs.

1. **Prettier vs `MAX_LINES_SKILL_MD`.** Prettier's markdown output is
   net-line-positive (it pads tables to their widest cell and inserts blank
   lines around lists). It pushed `pr-review-fix/SKILL.md` from 245 to 251
   lines, failing `validate-skill-format.sh`. Both gates were right; the
   question was which one owned those files.

2. **A test asserting on prettier's quote style.**
   `design-tokens.test.ts` read `globals.css` as text and asserted
   `toContain('[data-theme="sepia"]')`. Prettier normalises CSS attribute
   selectors to single quotes, so a pure reformat turned a test red. The test
   was a formatting canary masquerading as a theme assertion.

3. **The LOC ratchet vs reformatting.** ADR-278's ratchet compares exact line
   counts, so the reformat reported 8 violations, including `ReaderToolbar.tsx`
   "growing" by +238 physical lines with zero new statements.

## Decision

1. **Format ownership is partitioned, and the partition is declared.**
   `.prettierignore` excludes agent skills (`.agents/skills/`, `.opencode/skills/`,
   `.github/skills/`), vendored Impeccable content, and generated output. The
   skill exclusion mirrors the one already in `.pre-commit-config.yaml`, so the
   two lists cannot drift. Prettier owns source and prose docs; the line cap
   owns skills.

2. **A test that reads source as text must not pin formatting.** Assertions over
   raw file content are for _content_ — a selector exists, a key is present, a
   marker is absent. Quoting, spacing and line-wrapping are prettier's
   jurisdiction; pinning them converts every future reformat into a red suite,
   and a suite that cries wolf is a suite people learn to ignore.

3. **A formatting change is never growth, and must be proven, not asserted.**
   The LOC baseline was regenerated in the same commit as the reformat, which
   ADR-278's "only shrinks" rule otherwise forbids. That exception is
   admissible only because the change was _proved_ formatting-only with an
   AST comparison over all 474 changed TS/TSX files — 0 semantic differences.
   Unproven regeneration remains forbidden.

4. **The ratchet's remaining weakness is recorded, not patched.** See below.

## Why partition rather than "just reformat the skill"

Reformatting `pr-review-fix/SKILL.md` down to 250 lines would have made the
format gate pass and left `format:check` and the skill cap fighting over the
same files forever — every future `pnpm format` re-breaks the cap, and every
future cap fix re-breaks the format gate. Whichever the contributor forgot to
run would fail. Ownership has to be disjoint for both gates to be trustworthy.

The same argument already decided the vendored-Impeccable exclusion in
`.pre-commit-config.yaml`; this extends that precedent rather than inventing a
new one.

## Known weakness: the ratchet still measures physical lines

The obvious fix — count non-blank lines so re-wrapping stops registering — was
implemented and **reverted**. It does not work: prettier splits long
expressions across lines, so those lines survive blank-line normalization and
the measured delta was unchanged (`ReaderToolbar.tsx` +238 before and after).

A metric prettier cannot move is required. Candidates, in order of preference:

- **statements per file** (AST-derived) — directly what ADR-278 wants to bound;
- **exported symbols** — good for the "too many responsibilities" signal, blind
  to long bodies;
- **non-trivial lines** (lines with more than a brace or a continuation) — a
  cheap approximation, still prettier-sensitive at the margins.

Not decided here. The ratchet stays on physical lines and the baseline is
regenerated, re-proven, at each future reformat until the metric is replaced.

## Consequences

- `pnpm format:check` is now a real gate, enforced through `quality_gate.sh`
  rather than a separate ci.yml step so local and CI run the same command.
- A contributor editing a skill's markdown will find `prettier --write` does
  not touch it. That is intended; the file is governed by the line cap and
  `validate-skill-format.sh`.
- The reformat was proved equivalent by AST, not by inspection. That proof is
  the artifact that makes the baseline regeneration defensible; a future
  reformat should repeat it rather than assert it.
