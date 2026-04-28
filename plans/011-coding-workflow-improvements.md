# Plan 011: Coding Workflow Improvements

## Current Status

| Area | Status | Notes |
|------|--------|-------|
| AGENTS.md compliance | 🔴 Needs Work | 79 instructions, needs tiering + reduction to ≤40 |
| pre-commit hook | ✅ Done | `scripts/hooks/pre-commit` exists |
| Gitleaks integration | ✅ Done | Via pre-commit-config.yaml |
| commit-msg hook | ✅ Done | `scripts/hooks/commit-msg` exists |
| validate-workflows.sh | ❌ Missing | Template has this, need to add |
| pin-actions-to-sha.py | ✅ Done | SHAs already pinned in workflows |
| Lint caching | ❌ Missing | Template has lint_cache.sh |
| Language detection | ⚠️ Partial | TypeScript/Python/Shell/Markdown only |
| Configurable skips | ❌ Missing | Need SKIP_TESTS, etc. |
| Named constants | ❌ Missing | Need shell-parseable constants |
| Compliance Self-Check | ❌ Missing | Need to add section to AGENTS.md |

---


## Executive Summary

This plan consolidates improvements from:
1. **Analysis of `d-o-hub/github-template-ai-agents`** - template features to adopt
2. **Issue #234: AGENTS.md compliance ceiling** - instruction prioritization to overcome 68% agent compliance limit

---

## Part A: AGENTS.md Compliance Improvements (Per Issue #234)

### Problem Statement

Research shows frontier models achieve max **68% compliance** at 500 instructions in AGENTS.md. One third of all instructions are ignored—typically those at the **bottom** and those **phrased ambiguously**.

Our current `AGENTS.md` has **245 lines** with **79 discrete bullet-point instructions** — significantly over the ~40 instruction limit for reliable compliance.

### Solution: Tiered Instruction Priority

Reorder and restructure `AGENTS.md` using priority tiers:

| Tier | Content | Placement | Examples |
|------|---------|-----------|----------|
| **TIER 1** | Critical safety/security | Top (first 20 lines) | Never commit to main, no secrets, permission boundaries |
| **TIER 2** | Quality gates (blocking) | Near top | Pre-commit requirements, commit format, tests required |
| **TIER 3** | Style preferences | Middle | Formatting, naming conventions |
| **TIER 4** | Ceremonial/explanatory | Move to agents-docs/ | Links, historical notes, tutorials |

### Implementation Tasks

- [ ] **Audit AGENTS.md** - Count all discrete instructions, assign tier
- [ ] **Reorder by tier** - Move TIER 1 instructions to top
- [ ] **Convert to imperatives** - "DO", "NEVER", "ALWAYS" phrasing
- [ ] **Reduce instruction count** - Target ≤40 discrete imperatives
- [ ] **Move ceremonial content** - To `agents-docs/` with `@see` references
- [ ] **Add Compliance Self-Check** - Before responding, agents verify compliance

### Compliance Self-Check to Add

```markdown
## Compliance Self-Check (Run Before Finalizing Any Response)

- [ ] Did I read ALL of AGENTS.md before starting? (not just first half)
- [ ] Did I check the Named Constants section for any values I used?
- [ ] Did I verify no secrets/tokens appear in my output?
- [ ] Did I confirm my branch name follows conventions?
- [ ] Did I run quality gate before commit?
```

---

## Part B: Missing Scripts to Implement

### Priority 1: Critical Security

| Script | Purpose | Template Source |
|--------|---------|-----------------|
| `pre-commit-hook.sh` | Integrate Gitleaks secret scanning before commits | `.githooks/` + template |
| `.githooks/commit-msg` | Enforce conventional commit format | Template `.githooks/commit-msg` |
| `validate-workflows.sh` | Validate GitHub Actions YAML syntax | Template `scripts/validate-workflows.sh` |

### Priority 2: Supply Chain Security

| Script | Purpose | Template Source |
|--------|---------|-----------------|
| `pin-actions-to-sha.py` | Auto-pin GitHub Actions to secure SHAs | Template `scripts/pin-actions-to-sha.py` |

### Priority 3: Developer Experience

| Script | Purpose | Template Source |
|--------|---------|-----------------|
| `minimal_quality_gate.sh` | Fast lint-only gate for rapid iteration | Template `scripts/minimal_quality_gate.sh` |
| `health-check.sh` | Verify dev environment prerequisites | Template `scripts/health-check.sh` |
| `ai-commit.sh` | AI-assisted commit message generation | Template `scripts/ai-commit.sh` |
| `run_act_local.sh` | Run GitHub Actions locally with `act` | Template `scripts/run_act_local.sh` |

### Priority 4: Quality Gate Enhancement

| Feature | Purpose | Template Source |
|---------|---------|-----------------|
| Lint caching (`.lint_cache.sh`) | Cache lint results for performance | Template `scripts/lib/lint_cache.sh` |
| Rust/Go detection | Expand language auto-detection | Template quality_gate.sh |
| Configurable skips | SKIP_TESTS, SKIP_CLIPPY env vars | Template quality_gate.sh |

---

## Part C: AGENTS.md Named Constants

Add shell-parseable constants to `AGENTS.md`:

```markdown
## Named Constants

```bash
# File size limits (lines)
readonly MAX_LINES_PER_SOURCE_FILE=500
readonly MAX_LINES_PER_SKILL_MD=250
readonly MAX_LINES_AGENTS_MD=150

# Retry and polling configuration
readonly DEFAULT_MAX_RETRIES=3
readonly DEFAULT_RETRY_DELAY_SECONDS=5
readonly DEFAULT_POLL_INTERVAL_SECONDS=5
readonly DEFAULT_MAX_POLL_ATTEMPTS=12
readonly DEFAULT_TIMEOUT_SECONDS=1800

# Git/PR configuration
readonly MAX_COMMIT_SUBJECT_LENGTH=72
readonly MAX_PR_TITLE_LENGTH=72

# Security configuration
readonly GITLEAKS_VERSION="v8.27.2"
```
```

---

## Part D: Metrics Tracking

Create `analysis/agents-md-instruction-count.md`:

```markdown
# AGENTS.md Instruction Count Tracking

| Date | Instruction Count | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|------|-------------------|--------|--------|--------|--------|
| 2026-04-28 | 79 | TBD | TBD | TBD | TBD |
```

### Baseline Analysis (2026-04-28)

Current state of `AGENTS.md`:
- **Total lines**: 245 (exceeds `MAX_LINES_AGENTS_MD=150`)
- **Discrete instructions**: ~79 bullet points
- **Imperative phrasing**: 0 uses of "NEVER", "MUST", "ALWAYS", "DO NOT"
- **Compliance risk**: HIGH - 79 instructions exceeds the ~40 reliable instruction limit

**Instruction distribution**:
- Core References section: 6 items (context only, not actionable)
- Workflow (MANDATORY): 7 items
- Verify Workflow: 20+ items
- Quality Gate Reference: 10 items
- Hard Rules: 9 items
- Constraints: 8 items
- Architecture + Storage: 4 items
- Config + Security: 6 items
- Observability + Error Handling: 4 items
- Localization: 3 items
- Delivery Definition: 6 items
- Skills: 15+ items

---

## Implementation Order

### Phase 1: AGENTS.md Compliance (Immediate)

1. Audit current AGENTS.md instructions
2. Reorder by tier priority
3. Convert to imperative phrasing (add NEVER, MUST, ALWAYS)
4. Add Compliance Self-Check section
5. Create `analysis/agents-md-instruction-count.md`
6. Add Named Constants section with shell-parseable values

### Phase 2: Security Scripts (Complete ✅)

- [x] `pre-commit-hook.sh` - exists at `scripts/hooks/pre-commit`
- [x] Gitleaks integration - via `.pre-commit-config.yaml`
- [x] `commit-msg` hook - exists at `scripts/hooks/commit-msg`
- [ ] Add `validate-workflows.sh` (template feature to adopt)

### Phase 3: Supply Chain Security (Complete ✅)

- [x] GitHub Actions SHAs already pinned in workflows

### Phase 4: Quality Gate Enhancement (Next Sprint)

7. Add lint caching library (`scripts/lib/lint_cache.sh`)
8. Add configurable skips (SKIP_TESTS, SKIP_CLIPPY env vars)
9. Expand language detection (Rust, Go)

### Phase 5: Developer Experience (Backlog)

10. Add `minimal_quality_gate.sh` for fast lint-only checks
11. Add `health-check.sh` for environment verification
12. Consider `ai-commit.sh` and `run_act_local.sh`

---

## Acceptance Criteria

### Part A: AGENTS.md Compliance
- [ ] AGENTS.md has ≤40 discrete instructions after restructure
- [ ] All TIER 1 (critical safety) instructions in first 20 lines
- [ ] All instructions use imperative phrasing (NEVER, MUST, ALWAYS)
- [ ] Compliance Self-Check section added to AGENTS.md
- [ ] `analysis/agents-md-instruction-count.md` created with baseline measurement
- [ ] Named Constants section added with shell-parseable values

### Part B: Security Scripts
- [x] `pre-commit-hook.sh` - already exists at `scripts/hooks/pre-commit`
- [x] Gitleaks - already integrated via `.pre-commit-config.yaml`
- [x] `commit-msg` hook - already exists at `scripts/hooks/commit-msg`
- [ ] `validate-workflows.sh` validates YAML syntax

### Part C: Supply Chain Security
- [x] GitHub Actions SHAs pinned - verified in `.github/workflows/`

### Part D: Quality Gate Enhancement
- [ ] Add lint caching library (`scripts/lib/lint_cache.sh`)
- [ ] Add configurable skips (SKIP_TESTS, SKIP_CLIPPY, etc.)
- [ ] Expand language detection (Rust, Go)

### Part E: Developer Experience
- [ ] Add `minimal_quality_gate.sh` for fast lint-only checks
- [ ] Add `health-check.sh` for environment verification

---

## References

- Template: https://github.com/d-o-hub/github-template-ai-agents
- Issue #234: AGENTS.md compliance ceiling
- Current AGENTS.md: `MAX_LINES_AGENTS_MD=150` self-limiting constant
- `agents-docs/` directory: target for moved content