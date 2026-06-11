# GOAP Plan: Agent Harness Improvements

Date: 2026-05-17
Status: ✅ Superseded — All improvements adopted incrementally via ADR-037 and Plans 038-061

## Goal

Use `d-o-hub/github-template-ai-agents` as a reference to improve this repository's AI-agent workflow, quality gates, and automation without replacing the existing EPUB Studio-specific rules.

## Current State

- Local `main` was fast-forwarded to `origin/main` before analysis.
- Existing local strengths: single-source `AGENTS.md`, domain skills, skill symlinks, atomic commit scripts, workflow validation, action SHA validation, Dependabot, CodeQL, and release automation.
- Template strengths not fully present locally: centralized agent constants, LOC enforcement, executable command verification, richer skill eval runner, GitHub label/issue automation, broader agent command scaffolding, and explicit branch-protection fixtures.
- During validation, `scripts/validate-workflows.sh` had duplicated empty `elif` branches that broke `pnpm lint`; this was fixed as part of the analysis because it blocked the existing gate.

## Decomposition

1. Centralize agent harness configuration.
   - Add `.agents/config.sh` or equivalent shared config for constants currently duplicated across `AGENTS.md`, scripts, and docs.
   - Keep EPUB Studio thresholds authoritative and do not relax security rules.

2. Add LOC enforcement to quality gates.
   - Adapt template `scripts/loc_gate.sh`.
   - Wire it into `scripts/minimal_quality_gate.sh` and `scripts/quality_gate.sh`.
   - Preserve generated/build artifact exclusions.

3. Upgrade skill quality validation.
   - Expand from structural checks to executable eval checks based on template `scripts/run-evals.py`.
   - Track eval coverage for all canonical skills. Current local count: 14 eval files for 35 skills; template count: 49 eval files for 52 skills.

4. Add command-documentation verification.
   - Evaluate the template `discover-commands.sh` / `verify-commands.sh` pattern.
   - Scope it to commands in `AGENTS.md`, `agents-docs/`, `.opencode/commands/`, `.gemini/commands/`, and scripts docs.
   - Avoid executing arbitrary commands; categorize and cache validation metadata.

5. Harden GitHub repository automation.
   - Consider importing template pieces for labels, issue templates, branch protection/ruleset documentation, yaml lint, commitlint, and gitleaks workflows.
   - Reconcile with existing `.github/SECURITY-SETTINGS.md`, CodeQL, Dependabot, and SHA pinning.

6. Improve multi-agent command ergonomics.
   - Review template `.claude/commands`, `.gemini/commands`, `.opencode/commands`, and permission docs.
   - Add only commands that map to existing EPUB Studio workflows: quality gate, atomic commit, GOAP plan, CI fix, release, and dogfood.

## Strategy

Hybrid execution:

- Phase 1: Add non-invasive checks that only report gaps.
- Phase 2: Make checks blocking once false positives are resolved.
- Phase 3: Add GitHub automation and command wrappers after local checks are stable.

## Quality Gates

- `./scripts/minimal_quality_gate.sh`
- `./scripts/quality_gate.sh`
- Skill validation and eval runner
- GitHub workflow validation
- Action SHA validation

Validation performed:

- `bash -n scripts/validate-workflows.sh`: passed.
- `./scripts/validate-workflows.sh`: passed.
- `./scripts/minimal_quality_gate.sh`: passed after rerunning outside the sandbox so the local ShellCheck wrapper could install its binary outside the writable workspace.

## Risks

- Copying the template wholesale would weaken local domain specificity.
- Command verification can become unsafe if it executes discovered commands instead of classifying them.
- Blocking LOC or skill-eval checks too early could stall unrelated feature work.

## Recommended Order

1. LOC gate and centralized config.
2. Skill eval coverage and runner.
3. Command verification in report-only mode.
4. GitHub label/issue/branch-protection automation.
5. Agent command wrappers and docs sync.
