// commitlint configuration for do-epub-studio
// Adopted from github-template-ai-agents (issue #451).
//
// ADR-279: this file is a MIRROR of scripts/lib/commit-types.sh — the single
// source of truth for commit validation. The canonical enforcer is
// scripts/hooks/commit-msg, both locally (git hook) and in CI
// (.github/workflows/validate-commit-title.yml runs the hook itself, so CI
// parity with local commits is by construction). commitlint stays advisory
// (`pnpm commitlint`); it is never a CI gate.
//
// Drift protection — scripts/__tests__/commit-validator-parity.test.mjs runs
// in CI and asserts:
//   - type-enum is EXACTLY COMMIT_TYPES from scripts/lib/commit-types.sh
//     (14 types: the shell list plus security/a11y/plans, which real history
//     uses; `style` was previously missing here — that was the drift bug)
//   - scope-enum MUST be absent: scopes are dynamic (`goap-277`, `plan-121`,
//     PR numbers, wave labels — 74 distinct scopes in the last 500 commits),
//     and the local hook accepts any [a-z0-9_-]+ scope. An enum here made
//     commitlint stricter than the hook and red on live main history
//     (`ci(goap-277):`, `docs(agents):`).
//   - header-max-length is 72 (the hook's subject cap)
//   - no rule inherited from config-conventional stays at error level unless
//     it is on the parity allowlist (structural rules the hook also enforces)
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'ci',
        'chore',
        'build',
        'revert',
        'security',
        'a11y',
        'plans',
      ],
    ],
    'header-max-length': [2, 'always', 72],

    // ADR-279: rules config-conventional enables at level 2 that
    // scripts/hooks/commit-msg does NOT enforce. Explicit `[0]` is required —
    // merely omitting them would leave the stricter `extends` value active.
    // Keep this list in sync with the parity test's disabled-rules set.
    'subject-case': [0],
    'subject-full-stop': [0],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'header-trim': [0],
  },
};
