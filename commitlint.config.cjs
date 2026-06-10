// commitlint configuration for do-epub-studio
// Adopted from github-template-ai-agents (issue #451).
// Enforces the conventional commit format used by this repo.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'ci',
        'docs',
        'refactor',
        'test',
        'build',
        'chore',
        'security',
        'a11y',
        'plans',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'web',
        'worker',
        'reader-core',
        'shared',
        'schema',
        'testkit',
        'ui',
        'infra',
        'ci',
        'security',
        'ux',
        'a11y',
        'deps',
        'agents',
        'plans',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};
