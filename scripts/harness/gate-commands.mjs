/**
 * Canonical resolver from `scripts/gate-manifest.json` `local.checks` ids to
 * the exact command each gate check runs. This is the ONLY place a manifest
 * check id is bound to a command; sensor profiles reference check ids by name
 * and never re-declare argv. Drift (id missing from the manifest, or a
 * manifest check with no resolver entry) fails
 * `scripts/harness/check-profiles-consistency.mjs`.
 *
 * The commands mirror what `scripts/quality_gate.sh` actually invokes
 * (ADR-246 parity): root pnpm scripts for turbo tasks, direct script runners
 * for standalone checks.
 */
export const GATE_COMMANDS = Object.freeze({
  lint: ['pnpm', 'lint'],
  typecheck: ['pnpm', 'typecheck'],
  'test:coverage': ['pnpm', 'test:coverage'],
  build: ['pnpm', 'build'],
  smoke: ['pnpm', 'test:e2e:smoke'],
  design: ['bash', 'scripts/run-impeccable.sh'],
  'check-loc': ['node', 'scripts/check-loc.mjs'],
  'format:check': ['pnpm', 'format:check'],
  'coverage-parity': ['bash', 'scripts/validate-coverage-parity.sh'],
  'untrusted-ingest': ['node', 'scripts/check-untrusted-ingest-sinks.mjs'],
  'profiles-consistency': ['node', 'scripts/harness/check-profiles-consistency.mjs'],
  'llms-drift': ['bash', 'scripts/check-llms-drift.sh'],
  'compliance-drift': ['bash', 'scripts/generate-compliance-doc.sh', '--check'],
  'dora-report': ['bash', 'scripts/report-dora.sh'],
  'standards-matrix': ['node', 'scripts/validate-standards-matrix.mjs'],
  'gate-parity': ['bash', 'scripts/validate-gate-parity.sh'],
  'validate-git-hooks.sh': ['bash', 'scripts/validate-git-hooks.sh'],
  'validate-workflows.sh': ['bash', 'scripts/validate-workflows.sh'],
  'validate-skills.sh': ['bash', 'scripts/validate-skills.sh'],
  'check-agent-sync.mjs': ['node', 'scripts/check-agent-sync.mjs'],
  'check-app-identity.mjs': ['node', 'scripts/check-app-identity.mjs'],
  'check-adr-index.mjs': ['node', 'scripts/check-adr-index.mjs'],
  'check-plan-references.mjs': ['node', 'scripts/check-plan-references.mjs'],
  'validate-skill-format.sh': ['bash', 'scripts/validate-skill-format.sh'],
  'validate-links.sh': ['bash', 'scripts/validate-links.sh'],
  markdownlint: ['markdownlint', '.'],
  'dead-code-check.sh': ['bash', 'scripts/dead-code-check.sh'],
  'check-bundle-budget': ['node', 'scripts/check-bundle-budget.mjs', '--fail-on-violation'],
  'harness-version': ['node', 'scripts/check-harness-version.mjs'],
  'skills-catalog': ['python3', 'scripts/generate-available-skills.py', '--check'],
});
