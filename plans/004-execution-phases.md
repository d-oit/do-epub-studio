# EXECUTION PHASES

Only after TRIZ + design.

## Phase 0: Foundation (DONE)

- [x] repo setup
- [x] skills installed (skill-creator, skill-evaluator, triz-analysis, triz-solver)
- [x] config (wrangler.jsonc, turso)
- [x] TRIZ analysis complete: `analysis/triz-core-2026-04-07.md`
- [x] TRIZ resolution complete

## Phase 1: Schema + Access System

**Contradictions solved:** #1 Security vs Usability

| Task | TRIZ Principle |
|------|----------------|
| Implement token-based auth | #12 Equipotentiality, #8 Anti-Weight |
| Short-lived tokens + refresh | #20 Continuity of useful action |
| Password hashing with KDF | #3 Local Quality |

## Phase 2: Reader MVP

**Contradictions solved:** #4 Simplicity vs Feature Richness

| Task | TRIZ Principle |
|------|----------------|
| Progressive disclosure UI | #15 Dynamics |
| Reading Mode / Editorial Mode | #15 Dynamics |
| Lazy-load features | #10 Preliminary Action |

## Phase 3: Offline Sync

**Contradictions solved:** #2 Offline vs Access Control, #5 Local-first vs Consistency

| Task | TRIZ Principle |
|------|----------------|
| Dual-cache architecture | #1 Segmentation |
| Permission state TTL cache | #8 Anti-Weight |
| Zombie detection on sync | #23 Feedback |
| CRDT-based annotations | #40 Composite Materials |
| Last-write-wins for progress | #16 Partial action |

## Phase 4: Editorial Features

**Contradictions solved:** #3 Performance vs Flexibility

| Task | TRIZ Principle |
|------|----------------|
| Storage adapter layer | #6 Universality |
| Feature flags | #35 Parameter changes |
| Extensible JSON payloads | #30 Flexible shells |

## Rule

Each phase must reference which contradiction it solves.

## Quality Gate

Before moving to next phase:
```bash
./scripts/quality_gate.sh
```
