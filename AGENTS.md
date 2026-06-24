# AGENTS.md

**Single source of truth for all AI coding agents.** Read ALL sections before starting work.

---

## Named Constants

```bash
# File size limits (lines)
readonly MAX_LINES_PER_SOURCE_FILE=500
readonly MAX_LINES_PER_SKILL_MD=250
readonly MAX_LINES_AGENTS_MD=150

# Git/PR configuration
readonly MAX_COMMIT_SUBJECT_LENGTH=72
readonly MAX_PR_TITLE_LENGTH=72
```

---

## TIER 1 — CRITICAL (Must Follow)

**NEVER ignore these rules. Violations cause security incidents or data loss.**

- **MUST fetch and integrate latest `main` branch before starting any changes.** Run `git fetch origin main && git merge origin/main` (or rebase) to stay up-to-date.
- **NEVER commit to `main` directly.** Always use feature branches + PRs.
- **NEVER leak secrets, tokens, or credentials in code.** Use `.dev.vars` for local only.
- **NEVER expose R2 file URLs to clients.** Use signed URLs via Workers.
- **NEVER skip tests for core permission, sync, or auth flows.**
- **MUST use Argon2id for password hashing.** Never use bcrypt/scrypt.
- **MUST revoke sessions immediately on grant change.**
- **MUST use multi-signal locators (CFI + text + chapter) for annotations per ADR-006.**
- **MUST emit traceId on every Worker request and critical UI action.**
- **MUST guard every regex against untrusted input** using `matchBounded` / `testBounded` from `@do-epub-studio/shared` per ADR-034.
- **NEVER delete .gitignore files.** Binary/test fixtures must be generated via scripts, not tracked. Deleting .gitignore surfaces binary artifacts into the repo and breaks CI reproducibility.
- **MUST follow the disclosure process in `SECURITY.md` for any vulnerability — never open a public issue first.**
- **MUST adhere to the compensating controls and security decisions in `docs/security-posture.md` when modifying auth or resource loading.**
- **MUST verify git worktree branch matches PR head branch before pushing.** Use `git branch --show-current` (in worktree) + `gh pr view <N> --json headRefName` to confirm. Pushing to a wrong branch won't trigger CI for the PR. Use `git push origin <worktree-branch>:<pr-head-branch> --force` to target the correct branch.**
- **MUST use semantic design tokens (\`text-foreground\`, \`bg-background\`, etc.) from \`globals.css\` for all UI components to ensure WCAG 2.1 AA accessibility compliance per ADR-063.**
- **NEVER merge a PR with failing CI checks.** Before merging, verify ALL required checks pass via `gh pr checks <N>`. NEVER use `--admin` to bypass branch protection or merge with failing checks. If a check fails, fix the failure first — no exceptions.
- **MUST always fix pre-existing issues when encountered.** Whenever you touch a file (or surface an issue via analysis, lint, typecheck, test, security audit, or review), you MUST fix the pre-existing issue in the same change set — regardless of whether it is in the diff scope. Deferral is not allowed. If a pre-existing issue is too large for the current change, open a follow-up GOAP plan + ADR + tracking issue and link it from the current PR description; the current PR is not mergeable until the follow-up exists. Pre-existing issues in unrelated files are addressed by either: (a) fixing them in the current PR, or (b) opening a follow-up GOAP plan that is actively worked on. "Leave it for later" with no follow-up is a violation.
- **MUST pass Codacy Static Code Analysis before merge.** The `Codacy Static Code Analysis` row in `gh pr checks <PR>` is treated as a required check on this repo. New issues from `codacy pull-request gh <org> <repo> <pr>` MUST be fixed in code; suppressions are last-resort and require an inline justification. Local ESLint does NOT cover root-level configs (`vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`) — Codacy does, so a green local `pnpm lint` does not guarantee Codacy green. Always re-check `gh pr checks` after pushing. See `.agents/skills/codacy/SKILL.md`.
- **MUST use static imports over `readFileSync` for repo-bundled assets.** When a Vite/webpack/rollup config or a Node-bundled source needs a JSON file or a static text file (e.g. `VERSION`), prefer `import x from './file.json'` (Vite) or `path.join(__dirname, 'literal')` (Node) over `readFileSync(new URL(..., import.meta.url))`. The `new URL` pattern trips Codacy's `security/detect-non-literal-fs-filename` rule (OWASP path-traversal guard) because the URL is non-literal at the call site. See `.agents/skills/security-code-auditor/SKILL.md` § "File-System Path Patterns".

---

## TIER 2 — QUALITY GATES (Blocking)

**Run these before every commit. Failures block merge.**

1. **Run `./scripts/quality_gate.sh` before commit.** No exceptions.
2. **Validate workflows:** All GitHub Actions workflows MUST pass validation via `./scripts/validate-workflows.sh` (includes `actionlint` and `zizmor` security scanning).
3. **Use `./scripts/atomic-commit/run.sh --message "type(scope): description"`.**
3. **Coverage Thresholds:** Enforce minimum coverage via `test:coverage`.
   - `web`: 55% Lines, 48% Functions | `worker`: 55% Lines, 50% Functions
   - `shared`: 40% Lines, 50% Functions | `reader-core`: 72% Lines, 70% Functions
   - `schema`: 15% Lines, 5% Functions | `testkit`: 25% Lines, 20% Functions
   - `ui`: 10% Lines, 5% Functions
4. **Validate commit message:** Run `./scripts/validate-commit-message.sh` or ensure format matches `type(scope): description` (max 72 chars).
5. **NEVER ignore lint warnings, typecheck errors, or test failures.**
6. **If a lint rule is disabled, add inline comment explaining why.**
7. **MUST load `goap-agent` skill for any analysis, planning, or multi-step task.** Use GOAP methodology (analyze → decompose → strategize → coordinate → execute → synthesize).
8. **Document ALL issues as GOAP plans + ADRs in `plans/`.** Warnings, pre-existing issues, and unfixable items each get a GOAP plan with an ADR defining policy. Do NOT edit KNOWN-ISSUES.md directly — that is a reference mirror of monitor-tier items only.
9. **Releases MUST be cut via the `release-management` skill — no manual tags, no direct CHANGELOG edits.**

---

## TIER 3 — STYLE (Guidelines)

**Follow these for consistency. Non-blocking but reviewed.**

- **Max 500 LOC per source file.**
- **No hardcoded environment-specific URLs.**
- **No hardcoded dates.** Use current date from environment: `date +"%Y-%m-%d"` or `new Date().toISOString()`. Never write literal dates like "September 2025" in plans/documentation.
- **No `any` unless justified and isolated.**
- **Use Zod for boundary validation, Zustand for state, Tailwind for styling.**
- **Use Vitest + Playwright with `pool: 'forks'` for test isolation.**
- **Use OKLCH for color tokens** to ensure perceptually uniform lightness and wide-gamut P3 support.
- **Enable View Transitions** for all page-to-page navigations.
- **Enforce mutual exclusivity** for reader side-panels (TOC, Settings, etc.).
- **Document coding workflow changes via `learn` skill.**

---

## TIER 4 — REFERENCE (See Agents-Docs)

- **Architecture decisions:** See `docs/coding-guide.md` and `plans/archive/002-006`
- **TRIZ analysis:** See `plans/archive/001-triz-analysis.md` + `plans/archive/002-triz-resolution.md`
- **Skills catalog:** Run `ls .agents/skills/` or see `agents-docs/AVAILABLE_SKILLS.md`
- **GOAP + ADR pattern:** See `plans/020-goap-sprint-141.md` + `plans/024-adr-warning-management.md`
- **Learnings:** See `agents-docs/LEARNINGS.md`
- **Current phase:** All 28 swarm gaps (G1–G28) closed as of 2026-06-15. Rate limiter DO cutover also complete. See `analysis/SWARM_ANALYSIS.md` for resolution evidence.
- **Swarm completion:** See `plans/097-goap-swarm-close-all-gaps.md` for final execution record.

---

## Compliance Self-Check

Run this before finalizing ANY response:

- [ ] Did I read ALL of AGENTS.md (not just first half)?
- [ ] Did I fetch and merge latest main branch before starting work?
- [ ] Did I check Named Constants for any values I used?
- [ ] Did I verify no secrets/tokens in my output?
- [ ] Did I load `goap-agent` skill for analysis/planning tasks?
- [ ] Did I document all warnings/issues as GOAP plans + ADRs (not direct KNOWN-ISSUES.md edits)?
- [ ] Did I fix every pre-existing issue I touched or surfaced (or open a follow-up GOAP + ADR + tracking issue linked from this PR)?
- [ ] Did I run quality gate before commit?
- [ ] Is my commit message under 72 chars with correct format?
- [ ] Did I use feature branch (not main) for changes?

---

## Skills Reference

| Category         | Skills                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Coordination** | `goap-agent`, `triz-analysis`, `triz-solver`, `task-decomposition`, `agent-coordination`, `learn`, `do-web-doc-resolver`, `jules-delegator` |
| **Backend**      | `cloudflare-worker-api`, `secure-invite-and-access`, `turso-schema-migrations`, `pwa-offline-sync`, `cicd-pipeline`      |
| **Reader/UI**    | `epub-rendering-and-cfi`, `reader-ui-ux`, `accessibility-auditor`                                                        |
| **Testing**      | `testing-strategy`, `testdata-builders`, `test-runner`, `dogfood`                                                        |
| **DevOps**       | `github-workflow`, `cicd-pipeline`, `migration-refactoring`                                                              |
| **Workflow**     | `github-actions-version-fix`, `github-pr-autopilot`, `release-management`                                                |
| **Security**     | `security-code-auditor`, `privacy-first`                                                                                 |
| **Quality**      | `code-quality`, `code-review-assistant`, `shell-script-quality`, `anti-ai-slop`, `agents-md`                             |

---

## Key Commands

```bash
# Quality gates
./scripts/quality_gate.sh              # Full gate (lint + typecheck + test + design)
SKIP_DESIGN=1 ./scripts/quality_gate.sh  # Skip impeccable detector
IMPECCABLE_REQUIRED=1 ./scripts/quality_gate.sh  # Design gate blocks on findings
./scripts/minimal_quality_gate.sh      # Fast gate (lint + typecheck only)
./scripts/health-check.sh              # Dev environment check

# Commit workflow
./scripts/atomic-commit/run.sh --message "type(scope): description"
./scripts/validate-commit-message.sh <file>  # Validate commit message

# Skills
skill learn                         # Capture discoveries
```

---

_See `agents-docs/` for detailed documentation on workflow, hooks, context management, and troubleshooting. See `llms.txt` and `llms-full.txt` for structured LLM context._
