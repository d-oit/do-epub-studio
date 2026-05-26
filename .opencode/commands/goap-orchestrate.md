---
description: GOAP-orchestrated task decomposition and execution with 2026 best practices
subtask: true
---

# GOAP Orchestrator Command – Best Practice

You are a GOAP (Goal-Oriented Action Planning) orchestrator specializing in software development. Use the goap agent skill. Your mission is to analyze, decompose, strategize, coordinate, execute, and synthesize solutions for all open issues in this repository.

## Phase 1: ANALYZE – Codebase Understanding

1. **Fetch latest main**: Run `git fetch origin main && git merge origin/main` before starting.
2. **Read ALL of AGENTS.md**: Verify Named Constants, all 4 Tiers, and compliance checklist.
3. **Review coding-guide.md**: Understand architecture, product definition, and delivery rules.
4. **Audit open issues**: Use `gh issue list --state open --limit 100` to enumerate all work.
5. **Map dependencies**: Cross-reference issues for blocking relationships.
6. **Check existing plans/**: Review plans/020-goap-sprint-141.md and plans/007-implementation-phases.md for current phase.

## Phase 2: DECOMPOSE – Break Down into Units

For each issue, produce:
- **GOAP plan** in `plans/` with unique ID (format: `NNN-goap-issue-<number>.md`)
- **ADR** (Architecture Decision Record) within the plan document
- **Implementation steps** with estimated effort
- **Acceptance criteria** mapped to tests

Group issues by:
- **Security-critical**: #339 (ZIP bomb), #312 (dependency scanning)
- **Architecture**: #318 (AI plugins), #314 (schema consolidation)
- **UI/UX**: #316 (OKLCH), #315 (View Transitions)
- **Testing**: #317 (offline E2E)
- **CI/CD**: #345 (CI failure)

## Phase 3: STRATEGIZE – Prioritize & Sequence

1. **Fix CI first** (#345) – broken CI blocks all other work.
2. **Security patches** (#339, #312) – critical vulnerabilities take precedence.
3. **Architectural consolidation** (#314) – reduces technical debt before new features.
4. **Feature implementation** (#318, #316, #315, #317) – build on clean foundation.

## Phase 4: COORDINATE – Parallel Execution

- Security issues can run in parallel with architecture work.
- UI/UX features can be parallelized once architecture is stable.
- Testing can be parallelized with any category.

## Phase 5: EXECUTE – Implementation

For each implementation unit:
1. Create feature branch: `feat/issue-NNN-goap-plan`
2. Implement following AGENTS.md Tier 1–4 rules
3. Run `./scripts/quality_gate.sh` before commit
4. Use `./scripts/atomic-commit/run.sh --message "type(scope): description"`
5. Open PR with GOAP plan reference

## Phase 6: SYNTHESIZE – Documentation & Closeout

1. Update plans/ with implementation notes
2. Verify all acceptance criteria met
3. Reference issues in PR with "Closes #NNN"
4. Run full test suite: `pnpm test && pnpm test:e2e`

## Quality Gates (per AGENTS.md)

- [ ] Fetched and merged latest main
- [ ] Read ALL of AGENTS.md
- [ ] Loaded goap-agent skill
- [ ] All issues documented as GOAP plans + ADRs in plans/
- [ ] Quality gate passed: `./scripts/quality_gate.sh`
- [ ] Commit messages under 72 chars, format: `type(scope): description`
- [ ] Feature branch (not main) used for changes
- [ ] No secrets/tokens exposed
- [ ] MAX_LINES_PER_SOURCE_FILE=500 respected
- [ ] Coverage thresholds met (web: 40%, worker: 55%, shared: 25%, reader-core: 75%)

## Anti-Patterns to Avoid

- **DO NOT** edit KNOWN-ISSUES.md directly – it's a reference mirror.
- **DO NOT** commit to main directly – use feature branches + PRs.
- **DO NOT** skip tests for core permission, sync, or auth flows.
- **DO NOT** hardcode dates – use `date +"%Y-%m-%d"` or `new Date().toISOString()`.
- **DO NOT** delete .gitignore files.

## Shell Commands for Context Injection

!git fetch origin main && git merge origin/main
!gh issue list --state open --limit 100 --json number,title,labels
!ls plans/
!cat AGENTS.md
!./scripts/health-check.sh
!pnpm run typecheck
!pnpm test -- --run
