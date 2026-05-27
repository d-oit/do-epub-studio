---
name: codacy
version: 1.0.0
description: Orchestrate static analysis using Codacy. Use for querying PR analysis, triaging issues, suppressing false positives, and local analysis.
category: quality
allowed-tools: Bash Read
license: MIT
---

# Codacy Static Analysis

Orchestrate static analysis using Codacy Analysis CLI (local) and Codacy Cloud CLI (remote).

## Installation & Auth

```bash
npm i -g @codacy/analysis-cli @codacy/codacy-cloud-cli
export CODACY_API_TOKEN=<your-api-token>
```

## PR Triage Workflow

1. **Get PR analysis**:
   `codacy pull-request gh <org> <repo> <prNumber> --output json > /tmp/codacy-pr.json`
2. **Categorize issues**:
   - False positives → Suppress via Cloud CLI.
   - Real issues → Fix in code.
3. **Suppress false positives**:
   `codacy pull-request gh <org> <repo> <prNumber> --ignore-issue <numeric-resultDataId> --ignore-reason FalsePositive`
   *Note: Use numeric `resultDataId`, NOT hash IDs.*

## Local Analysis

```bash
codacy-analysis-cli analyze --pr --output-format json
```

### ⚠️ Security Warning (RCE Risk)
**NEVER** use the `--install-dependencies` flag when running `codacy-analysis-cli` on untrusted code or in a shared environment. This flag can execute arbitrary code during the dependency installation phase, leading to Remote Code Execution (RCE).

## Configuration

Codacy is configured via `.codacy.yml` in the repository root. See `references/config-format.md`.

## Known Limitations

| Tool Category | Status | Note |
|---------------|--------|------|
| JS/TS/Shell   | ✅ Works | ESLint, Stylelint, ShellCheck |
| Python/Ruby   | ❌ Fails | Missing runtimes/venv issues |
| Java/PMD      | ❌ Fails | Missing Java runtime |

Always cross-reference with Cloud CLI for full PR data.

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "Local analysis shows 0 issues, so we are good." | Analysis CLI has limited local tool support; Cloud CLI is the source of truth. |
| "I'll use the issue hash for suppression." | Codacy CLI requires the numeric `resultDataId` for suppressions. |

## Red Flags

- [ ] Relying solely on local `codacy-analysis` for non-JS projects.
- [ ] Attempting to suppress issues without a valid `--ignore-reason`.
- [ ] Using issue hashes for CLI suppressions.
- [ ] **Using `--install-dependencies` flag.**

## References

- `references/output-format.md` - JSON schema for PR analysis
- `references/supported-tools.md` - Local vs Cloud tool availability
- `references/config-format.md` - `.codacy.yml` schema
