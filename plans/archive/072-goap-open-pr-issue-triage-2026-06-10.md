# GOAP Plan: Open PR/Issue Triage and Failure Resolution (2026-06-10)

**Orchestrator**: goap-agent swarm mode
**Repository**: do-epub-studio
**Current branch**: `fix/epub-sanitization-hardening-10893744634142080706`

## 1. Analysis

### Inventory

| Source | Evidence | Current status |
| --- | --- | --- |
| Open PRs | `gh pr list --state open` returned #440, #458, #460, #461, #462, #465, #466, #471 | 8 open |
| Open issues | `gh issue list --state open` returned #442-#454 | 13 open |
| Review comments | `gh api .../pulls/{number}/comments` returned no review comments for all open PRs | No human review comments to address |
| PR #440 | Codacy `ACTION_REQUIRED`; GitHub Build/Lint/Typecheck/Unit/E2E/CodeQL/DepScan/Chromatic success; UI Tests pending | P0 |
| PR #458 | All listed checks success; Codacy clean | Already addresses #442-#454 in PR body |
| PR #471 | All listed checks success; Codacy clean | Clean DX follow-up |
| PR #460/#461/#462 | Dependabot action bumps; Codacy/CodeQL mostly green; Pre-commit failed; auto-merge failed | P1 |
| PR #465/#466 | Dependabot dependency bumps; Codacy/CodeQL/Typecheck/Unit green; Lint/Pre-commit failed | P1 |
| Working tree | PR #440 branch was ahead by 1 local commit before edits; sanitizer refactor now adds local sanitizer/test changes | Validated reader-core gates green |
| Swarm finding | Sanitizer review found missing inline SVG allowlist and URL hardening gaps | Fixed by adding `SAFE_SVG_TAGS` to EPUB body allowlist, expanding URL scheme checks to `href`/`src`/`xlink:href`, and adding sanitizer regressions |
| Issue mapping | #458 is primary carrier for #442-#454; #471 is clean DX follow-up | Several #442-#454 items are partial in #458, but no additional implementation was requested in this pass |

### Current P0 finding

PR #440 still fails Codacy after the remote branch's latest commit. The remaining high-risk pattern is `WHOLE_DOCUMENT: true` in `packages/reader-core/src/sanitizer.ts`. The local refactor replaces that with head/body fragment sanitization and no whole-document DOMPurify mode. It also adds inline SVG preservation and URL scheme hardening tests.

## 2. Decomposition

| ID | Task | Priority | Dependency | Owner |
| --- | --- | --- | --- | --- |
| 1 | Refactor `sanitizeEpubDocument` to avoid DOMPurify `WHOLE_DOCUMENT` while preserving head/body structure | P0 | inventory | goap-agent |
| 2 | Validate sanitizer tests, reader-core lint, and reader-core typecheck | P0 | 1 | goap-agent |
| 3 | Push validated PR #440 changes and re-check status | P0 | 2 | goap-agent |
| 4 | Inspect Dependabot pre-commit/lint failures on #460-#466 and propose minimal fixes or close rationale | P1 | inventory | swarm agents |
| 5 | Confirm #458/#471 satisfy open issues #442-#454 and require no additional implementation | P1 | inventory | swarm agents |
| 6 | Run repository quality gates if changes remain within scope | P0 | 3-5 | goap-agent |

## 3. Strategy

**Hybrid + swarm**:
- Sequential P0 path for security-sensitive sanitizer changes.
- Parallel read-only swarm for PR failure triage and issue/plan mapping.
- Final sequential validation before push.

## 4. Quality Gates

| Gate | Command |
| --- | --- |
| Sanitizer unit tests | `pnpm --filter @do-epub-studio/reader-core test:unit -- sanitizer.test.ts` |
| Reader-core lint | `pnpm --filter @do-epub-studio/reader-core lint` |
| Reader-core typecheck | `pnpm --filter @do-epub-studio/reader-core typecheck` |
| Repo gate if needed | `./scripts/quality_gate.sh` |
| Workflow validation if CI files change | `./scripts/validate-workflows.sh` |

## 5. Execution Notes

- Do not merge or push to `main`.
- Do not edit Dependabot-owned branches unless a concrete local fix is validated.
- No secrets or credentials should be introduced.
- All regexes over untrusted input must remain guarded by `matchBounded`/`testBounded`.

## 6. Synthesis Checklist

- [x] Latest `main` fetched and merged with `--ff-only` where applicable.
- [x] Open PR/inventory/check status captured.
- [x] PR review comments checked and found empty.
- [x] PR #440 sanitizer refactor implemented locally.
- [x] Reader-core sanitizer tests, lint, and typecheck passed.
- [ ] PR #440 local changes pushed after validation.
- [x] Dependabot failure triage completed — resolved via PR #472 (SHA allowlist + eslint ignore). See plan 073.
- [x] Final quality gate status recorded — ALL PASSED.
