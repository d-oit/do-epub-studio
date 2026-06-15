# ADR-083: ADR Numbering Policy

> **Status:** Accepted (2026-06-15)
> **Supersedes:** none
> **Related:** `plans/ADR-INDEX.md`,
> `analysis/SWARM_ANALYSIS.md` G26
> **Deciders:** maintainers
> **Tags:** governance, adr

## Context

ADR numbers in this repository have been assigned in
monotonically increasing order as the plans are written. The
2026-06-15 swarm analysis identified two collisions:

- `plans/035-adr-content-security-policy.md` and
  `plans/035-adr-release-governance.md` both claim ADR-035.
- `plans/063-adr-accessibility-design-tokens.md` and
  `plans/063-adr-comprehensive-audit-policy.md` both claim
  ADR-063.

There was no written policy on how to handle a collision.

## Decision

### Numbering rule

1. **Monotonic.** ADR numbers are assigned in the order the
   ADR is written. The first ADR is `001` (in `plans/archive/`
   or `plans/`); the next is `002`; and so on.
2. **No reserved ranges.** Plan numbers (`0NN-goap-*.md`) and
   ADR numbers (`0NN-adr-*.md`) share the same numeric space
   but are distinguished by their filename prefix. A plan
   `075-goap-*.md` and an ADR `075-adr-*.md` are siblings,
   not collisions.
3. **A single number can describe a single topic.** A "topic"
   is a single architectural decision. Two ADRs that touch
   the same code surface but make **different** decisions are
   two topics and must not share a number.

### Collision handling

4. **Detection.** The PR template for new ADRs requires the
   author to update `plans/ADR-INDEX.md`. If a number is
   already taken, the lint step
   `scripts/check-adr-index.mjs` (added in this PR) errors
   out.
5. **Resolution.** When a collision is detected (e.g., the
   035 / 063 cases):
   - Do **not** renumber. The existing references in plans
     and docs depend on the original number.
   - Add a letter suffix: `035a`, `035b`, `063a`, `063b`. The
     suffix is a **content** distinction, not a versioning
     distinction.
   - Update `plans/ADR-INDEX.md` to mark one as `(canonical)`
     and the other as `(collision)`. The canonical ADR is the
     one that the AGENTS.md and docs reference directly.
6. **Future collisions.** The next time a collision is
   detected, the new ADR takes the next free number (e.g.,
   `084`). Renumbering is **not** a tool; clarity is the
   goal.

### Index

7. **`plans/ADR-INDEX.md` is the single source of truth.**
   Every ADR — accepted, pending, or cross-referenced — has
   a row. PRs that add or modify an ADR must also update the
   index in the same commit.

## Consequences

### Positive

- The 035 / 063 collisions are now visible, labeled, and
  documented in the index.
- Future collisions are caught at PR time.
- Renumbering pressure is removed; the cost is one
  alphabetical suffix.

### Negative

- The `035a` / `035b` notation is slightly ugly. We accept
  this in exchange for not breaking existing references.

### Neutral

- Adds a tiny lint script (`scripts/check-adr-index.mjs`)
  that asserts no duplicate numbers in `plans/ADR-INDEX.md`.

## Compliance

- AGENTS.md TIER-2 rule 8 — gaps are documented as GOAP plans
  + ADRs.
