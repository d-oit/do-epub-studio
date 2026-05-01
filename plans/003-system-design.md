# SYSTEM DESIGN (POST-TRIZ)

This file MUST be derived from TRIZ resolution.

## Reference

- TRIZ Solver Output: `analysis/triz-core-2026-04-07.md`
- Previous Resolution: `plans/002-triz-resolution.md`

## Required mapping

Each system decision must reference:

- contradiction resolved
- TRIZ principle used

## Sections

### 1. Storage model (R2 vs Turso)

| Decision | Contradiction | Resolution |
|----------|---------------|------------|
| R2 for EPUB files | Performance vs Flexibility | Adapter pattern (#1 Segmentation, #6 Universality) |
| Turso for app state | N/A | Schema-bound queries for state |

**TRIZ Justification**: Contradiction #3 resolved via system-level separation - adapter layer isolates storage backend.

### 2. Access model (email + password)

| Decision | Contradiction | Resolution |
|----------|---------------|------------|
| Token-based progressive trust | Security vs Usability | Time + Condition separation |
| Short-lived tokens (15 min) + refresh | - | #8 Anti-Weight (caching), #12 Equipotentiality |

**TRIZ Justification**: Contradiction #1 - IFR: strong security WITHOUT authentication friction. Token refresh provides continuity (#20) while short lifespans improve security.

### 3. Offline model

| Decision | Contradiction | Resolution |
|----------|---------------|------------|
| Dual-cache architecture | Offline vs Access Control | Space + Condition separation |
| TTL-cached permissions (24h) | - | #1 Segmentation (separate cache) |
| Zombie detection on sync | - | #23 Feedback (detect revoked access) |

**TRIZ Justification**: Contradiction #2 - IFR: offline reading WITHOUT allowing access after revocation. Separate permission state from content with TTL.

### 4. Reader architecture

| Decision | Contradiction | Resolution |
|----------|---------------|------------|
| Progressive disclosure UI | Simplicity vs Feature Richness | Time + Condition separation |
| Reading Mode / Editorial Mode | - | #15 Dynamics (context-aware) |
| Lazy-load advanced features | - | #10 Preliminary Action (load ahead) |

**TRIZ Justification**: Contradiction #4 - IFR: rich features WITHOUT cluttering UI. Mode switching resolves condition-based conflict.

### 5. Sync strategy

| Decision | Contradiction | Resolution |
|----------|---------------|------------|
| CRDT-based annotations | Local-first vs Consistency | System-level separation |
| Last-write-wins for progress | - | #16 Partial action (acceptable approximation) |
| Conflict resolution UI | - | #6 Universality (one system, multiple resolution modes) |

**TRIZ Justification**: Contradiction #5 - IFR: local-first editing WITHOUT consistency conflicts. CRDTs provide automatic merge; UI handles rare edge cases.

## Rule

No design decision without TRIZ justification.
