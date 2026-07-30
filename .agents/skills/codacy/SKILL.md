---
name: codacy
version: 1.1.0
description: Orchestrate static analysis using Codacy. Required PR check on this repo. Use for querying PR analysis, triaging issues, fixing (not suppressing) findings, and local analysis. See SKILL.md for fix patterns and the required-check policy.
category: quality
allowed-tools: Bash Read
license: MIT
---

# Codacy Static Analysis

Orchestrate static analysis using Codacy Analysis CLI (local) and Codacy
Cloud CLI (remote). **Codacy is a required PR check on this repo per
AGENTS.md Tier 1 — `gh pr checks` showing `fail` on the
`Codacy Static Code Analysis` row blocks merge.**

## Installation & Auth

```bash
npm i -g @codacy/analysis-cli @codacy/codacy-cloud-cli
export CODACY_API_TOKEN=<your-api-token>
```

The Cloud CLI (`codacy pull-request gh <org> <repo> <pr>`) is the source
of truth. The local `codacy-analysis-cli` covers only JS/TS/Shell; for
anything else, rely on the Cloud PR report.

## PR Triage Workflow

1. **Get PR analysis**:
   ```bash
   codacy pull-request gh <org> <repo> <prNumber> --output json > /tmp/codacy-pr.json
   ```
2. **Inspect the report**:
   - `pullRequest.isUpToStandards` — top-level gate.
   - `pullRequest.quality.isUpToStandards` — quality gate
     (default threshold: 0 new issues).
   - `newIssues[]` — every entry has `resultDataId` (numeric), `filePath`,
     `lineNumber`, `patternInfo.id` (e.g. `ESLint8_security_detect-non-literal-fs-filename`),
     `commitIssue.message`, and `commitIssue.lineText`.
3. **Categorize each issue**:
   - **Real, fixable in code** → fix it; do NOT suppress.
   - **False positive** → suppress via Cloud CLI
     (`codacy pull-request gh ... --ignore-issue <resultDataId> --ignore-reason FalsePositive`).
     Always justify in the PR description.
   - **Tool misconfiguration** → fix `.codacy.yml` or the underlying
     tool config; do NOT suppress.

   The numeric `resultDataId` is required for suppressions, not the hash.

## Fix, Don't Suppress — Patterns

See [references/fix-patterns.md](references/fix-patterns.md) for detailed fix patterns covering regex, lint, type, test, and security issues.

## Local Analysis

```bash
codacy-analysis-cli analyze --pr --output-format json
```

### ⚠️ Security Warning (RCE Risk)
**NEVER** use the `--install-dependencies` flag when running
`codacy-analysis-cli` on untrusted code or in a shared environment.
This flag can execute arbitrary code during dependency installation,
leading to Remote Code Execution (RCE).

### Local Lint Coverage Gaps

The repo's `pnpm lint` scripts scope ESLint to `src/`:

```jsonc
// apps/web/package.json
"lint": "eslint src --ext .ts,.tsx"
```

This means `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`
and other root-level configs are **not** linted locally. Codacy lints
the whole file. Always run Codacy after pushing, even if local lint
is green.

To run ESLint on a config file directly (e.g. when chasing a Codacy
finding):

```bash
pnpm exec eslint apps/web/vite.config.ts
```

## Configuration

Codacy is configured via `.codacy.yml` in the repository root. See
`references/config-format.md`. The repo currently relies on Codacy
defaults: ESLint 8 (security plugin enabled), ShellCheck, markdownlint,
Trivy for dependency scanning, CodeQL for cross-tool coverage.

## Required Check vs Informational

`gh pr checks <PR>` shows Codacy as a row. On this repo (per AGENTS.md
Tier 1) it is **required**. If it shows `fail`:

1. Pull the report:
   ```bash
   codacy pull-request gh d-oit do-epub-studio <PR> --output json
   ```
2. For each `newIssues[]` entry, decide: fix or suppress.
3. Push the fix / suppression comment.
4. Re-poll `gh pr checks` until the row is `pass`.

The branch has no GitHub-side `branch protection` `required status
checks` configured, so technically the merge button is not blocked
automatically — but AGENTS.md Tier 1 forbids merging with a failing
Codacy check regardless of GitHub enforcement.

## Known Limitations

| Tool Category | Status | Note |
|---------------|--------|------|
| JS/TS/Shell   | ✅ Works | ESLint, Stylelint, ShellCheck |
| Python/Ruby   | ❌ Fails | Missing runtimes/venv issues |
| Java/PMD      | ❌ Fails | Missing Java runtime |
| opengrep test exclusions | ⚠️ Partial | `.codacy.yml` `exclude_paths` works for ESLint but cloud-side opengrep may still flag HTML-like strings in test files (`<!DOCTYPE html>`, `</html>`). Remove ALL HTML literals from tests. |
| Biome in test files | ⚠️ False positives | `useQwikValidLexicalScope` (SolidJS rule) flags `const fn = () => ...` at module scope in test files. Use `vi.fn()` wrapper instead. See fix patterns above. |

Always cross-reference with Cloud CLI for full PR data.

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "Local analysis shows 0 issues, so we are good." | Analysis CLI has limited local tool support AND the repo's `pnpm lint` skips configs. Cloud CLI is the source of truth. |
| "I'll suppress it; it's a false positive." | Codacy accepts suppressions, but the bar is high. If the rule can be fixed in 2-3 lines, fix it. Suppression with no justification will be challenged in review. |
| "I'll use the issue hash for suppression." | Codacy CLI requires the numeric `resultDataId` for suppressions. |
| "ESLint 10 (local) doesn't flag it, so it's fine." | Codacy uses ESLint 8. Rule set, parser, and scope analyzer differ. Always verify on Codacy. |

## Red Flags

- [ ] Relying solely on local `codacy-analysis` for non-JS projects.
- [ ] Attempting to suppress issues without a valid `--ignore-reason`.
- [ ] Using issue hashes for CLI suppressions.
- [ ] **Using `--install-dependencies` flag.**
- [ ] Pushing a PR without `gh pr checks` showing Codacy `pass`.
- [ ] Using bare `const fn = () => ...` at module scope in test files
      (triggers Biome `useQwikValidLexicalScope`). Use `vi.fn()` instead.
- [ ] Suppressing `security/*` rules without an inline justification
      comment and a follow-up plan entry.
- [ ] `while (true)` in production code — Codacy flags it as "Unexpected
      constant condition" and "Unnecessary conditional, value is always
      truthy". Use `for (;;)` for infinite loops; it is semantically
      identical and does not trigger constant-condition rules.
- [ ] `process.env.X || 'fallback'` in test files — Codacy flags it as
      "Non-serializable expression must be wrapped with $(...)". In test
      files, replace with a plain string literal. The env var lookup adds
      no value in a mock environment and confuses static analysis.
- [ ] Editing `.eslint.config.js` to disable a rule that Codacy
      enforces (Codacy does not read the local ESLint config — it
      runs its own).

## Impeccable vs Codacy

| Check | Tool | Scope |
|-------|------|-------|
| Code quality / security | Codacy (required) | All source files |
| Design quality (UI) | Impeccable (warning → required) | UI components |
| Accessibility | axe-core + Impeccable pre-audit | UI components |

Codacy is the **required** static-analysis check. Impeccable is a **UI-only** deterministic check for design anti-patterns. Both run in CI; Codacy blocks merge, Impeccable warns (promoted to required after first sprint).

## References

- `references/output-format.md` - JSON schema for PR analysis
- `references/supported-tools.md` - Local vs Cloud tool availability
- `references/config-format.md` - `.codacy.yml` schema
- `.agents/skills/security-code-auditor/SKILL.md` — broader security
  patterns and the `safe-regex` / OWASP mappings used by Codacy.
- `AGENTS.md` Tier 1 — required checks, pre-existing-issue policy. `.impeccable/config.json` — detector config.
