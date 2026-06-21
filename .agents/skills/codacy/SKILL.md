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

Codacy findings are usually genuine. Suppression is the last resort and
must be justified inline. The repo's standard for the rules Codacy
flags most often:

### `security/detect-non-literal-fs-filename`

The rule (from `eslint-plugin-security`) blocks `fs.*` calls whose first
argument could carry untrusted runtime data — i.e. the OWASP path
traversal pattern. The intent is to prevent an attacker from
controlling which file Node reads.

It is a false alarm when:

- The path is a literal relative to the config / source file (no
  `process.env`, no user input, no `req`/`args`).
- The path is constructed by `path.join(__dirname, '<literal>')`.
- The path is `import.meta.url`-derived and joined with a literal.

**Fix pattern A (preferred for Vite/webpack/rollup configs): use a
static import.**

```ts
// Vite config — works because Vite bundles the config with its own
// loader. JSON and `?raw` imports are resolved at config-load time.
import appIdentity from './src/config/app-identity.json';
import versionText from './src/config/app-identity.json?raw'; // not a thing
```

For the raw text case (e.g. `VERSION`), use the `?raw` suffix in the
companion TS module — but **not** in `vite.config.ts` itself, since
the config bundle is loaded by Node and `?raw` is a Vite-only
transform.

```ts
// src/config/app-identity.ts (Vite-bundled source — ?raw works here)
import versionText from '../../../../VERSION?raw';
import metadata from './app-identity.json';
export const APP_VERSION = versionText.trim();
```

```ts
// vite.config.ts (Node-loaded — ?raw does NOT work here)
import { readFileSync } from 'node:fs';
import path from 'path';
import appIdentity from './src/config/app-identity.json';

// Resolve relative to the config file's own location; path is a
// literal joined with a known directory.
const appVersion = readFileSync(
  path.resolve(__dirname, '../../VERSION'),
  'utf8',
).trim();
```

If the rule still flags it (it may, on Codacy's older ESLint 8), add
an inline `eslint-disable-next-line` with a justification. AGENTS.md
Tier 3 mandates: "If a lint rule is disabled, add inline comment
explaining why."

```ts
// eslint-disable-next-line security/detect-non-literal-fs-filename
//   Path is a literal relative to this config file; no untrusted input
const appVersion = readFileSync(
  path.resolve(__dirname, '../../VERSION'),
  'utf8',
).trim();
```

**Never use `new URL('./file', import.meta.url)`** in a Vite config —
it both flags the rule (the URL is not a literal to the linter) and
bypasses the cleaner static-import pattern.

**Fix pattern B (general Node): use `path.join` with a literal base.**

```ts
// BAD — flagged
const dir = process.env.MY_DIR;
readFileSync(`${dir}/data.json`);

// GOOD — literal base, joined with a literal
const dir = path.join(__dirname, 'data');
readFileSync(path.join(dir, 'config.json'));
```

**Fix pattern C (Node ≥ 20.11 / 22+): use `import.meta.dirname`.**
Same caveat as `__dirname` — Codacy's ESLint 8 may still flag it
because `import.meta.dirname` is not in the rule's static set; add a
targeted disable with a justification.

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
- [ ] Suppressing `security/*` rules without an inline justification
      comment and a follow-up plan entry.
- [ ] Editing `.eslint.config.js` to disable a rule that Codacy
      enforces (Codacy does not read the local ESLint config — it
      runs its own).

## References

- `references/output-format.md` - JSON schema for PR analysis
- `references/supported-tools.md` - Local vs Cloud tool availability
- `references/config-format.md` - `.codacy.yml` schema
- `.agents/skills/security-code-auditor/SKILL.md` — broader security
  patterns and the `safe-regex` / OWASP mappings used by Codacy.
- `AGENTS.md` Tier 1 — required checks and pre-existing-issue policy.
