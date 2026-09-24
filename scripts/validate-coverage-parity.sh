#!/usr/bin/env bash
# Validate coverage-threshold parity — ADR-282 / GOAP-276 P0 #5.
# Single source of truth: coverage-thresholds.json. Fails when the JSON and
# any vitest.config.ts, codecov.yml, or documented policy (AGENTS.md Tier 2 #4,
# CONTRIBUTING.md) disagree, or when the quality-gate wiring is missing.
# Deterministic and offline: no network, no test execution.
# Exit 0 = parity, Exit 1 = mismatch.
#
# Usage: ./scripts/validate-coverage-parity.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

FAILED=0
SSOT="$REPO_ROOT/coverage-thresholds.json"

if [[ ! -f "$SSOT" ]]; then
  printf '%s✗ coverage-thresholds.json not found: %s%s\n' "$RED" "$SSOT" "$NC"
  exit 1
fi

if ! command -v node &> /dev/null; then
  printf '%s✗ node is required but not available%s\n' "$RED" "$NC"
  exit 1
fi

# js-yaml is a root devDependency; needed to parse codecov.yml faithfully.
if ! node -e "require('js-yaml')" 2>/dev/null; then
  printf '%s✗ js-yaml is required (root devDependency) but not resolvable — run pnpm install%s\n' "$RED" "$NC"
  exit 1
fi

printf '%s═════════════════════════════════════════════════════════════════%s\n' "$BLUE" "$NC"
printf '%s  Coverage Threshold Parity Validation (ADR-282)%s\n' "$BOLD" "$NC"
printf '%s═════════════════════════════════════════════════════════════════%s\n' "$BLUE" "$NC"

# Single node pass: SSOT shape, vitest config derivation, codecov targets,
# documented policy pointers, and gate wiring. Prints one "✗ ..." per mismatch.
if node <<'NODE'
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const root = process.cwd();
const failures = [];
const fail = (m) => failures.push(m);

// package name -> its directory (also used for codecov `paths:`).
const PACKAGES = {
  web: 'apps/web',
  worker: 'apps/worker',
  shared: 'packages/shared',
  'reader-core': 'packages/reader-core',
  schema: 'packages/schema',
  testkit: 'packages/testkit',
  ui: 'packages/ui',
};
const METRICS = ['lines', 'functions', 'branches', 'statements'];
const PKG_NAMES = Object.keys(PACKAGES);
const sorted = (a) => [...a].sort();

// --- 1. coverage-thresholds.json shape: exactly 7 packages x 4 metrics. ---
let ssot = null;
try {
  ssot = JSON.parse(fs.readFileSync(path.join(root, 'coverage-thresholds.json'), 'utf8'));
} catch (e) {
  fail(`coverage-thresholds.json unreadable: ${e.message}`);
}

if (ssot) {
  if (JSON.stringify(sorted(Object.keys(ssot))) !== JSON.stringify(sorted(PKG_NAMES))) {
    fail(`coverage-thresholds.json keys ${JSON.stringify(sorted(Object.keys(ssot)))} != expected packages ${JSON.stringify(sorted(PKG_NAMES))}`);
  }
  for (const pkg of PKG_NAMES) {
    const entry = ssot[pkg];
    if (!entry || typeof entry !== 'object') {
      fail(`coverage-thresholds.json: missing package entry "${pkg}"`);
      continue;
    }
    if (JSON.stringify(sorted(Object.keys(entry))) !== JSON.stringify(sorted(METRICS))) {
      fail(`coverage-thresholds.json ${pkg}: keys ${JSON.stringify(sorted(Object.keys(entry)))} != ${JSON.stringify(sorted(METRICS))}`);
    }
    for (const metric of METRICS) {
      const v = entry[metric];
      if (!Number.isInteger(v) || v < 0 || v > 100) {
        fail(`coverage-thresholds.json ${pkg}.${metric} = ${JSON.stringify(v)} is not an integer in 0..100`);
      }
    }
  }

  // --- 2. Each vitest.config.ts derives thresholds from the SSOT JSON. ---
  const IMPORT_LINE = "import coverageThresholds from '../../coverage-thresholds.json';";
  for (const pkg of PKG_NAMES) {
    const cfgPath = path.join(root, PACKAGES[pkg], 'vitest.config.ts');
    if (!fs.existsSync(cfgPath)) {
      fail(`${PACKAGES[pkg]}/vitest.config.ts not found`);
      continue;
    }
    const src = fs.readFileSync(cfgPath, 'utf8');
    if (!src.includes(IMPORT_LINE)) {
      fail(`${PACKAGES[pkg]}/vitest.config.ts: missing SSOT import (expected exactly: ${IMPORT_LINE})`);
    }
    for (const metric of METRICS) {
      const ref = `coverageThresholds['${pkg}'].${metric}`;
      if (!src.includes(`${metric}: ${ref}`)) {
        fail(`${PACKAGES[pkg]}/vitest.config.ts: thresholds.${metric} is not sourced from ${ref}`);
      }
      if (new RegExp(`${metric}\\s*:\\s*\\d`).test(src)) {
        fail(`${PACKAGES[pkg]}/vitest.config.ts: hard-coded ${metric} literal — thresholds must come from coverage-thresholds.json`);
      }
    }
  }

  // --- 3. codecov.yml mirrors the SSOT `lines` floors via path statuses. ---
  try {
    const codecov = yaml.load(fs.readFileSync(path.join(root, 'codecov.yml'), 'utf8'));
    const status = (codecov && codecov.coverage && codecov.coverage.status) || {};
    const project = status.project || {};
    if (project.default !== false && project.default !== 'off') {
      fail(`codecov.yml: coverage.status.project.default must be false/off to suppress the whole-repo status (got ${JSON.stringify(project.default)})`);
    }
    const named = sorted(Object.keys(project).filter((k) => k !== 'default'));
    if (JSON.stringify(named) !== JSON.stringify(sorted(PKG_NAMES))) {
      fail(`codecov.yml: project statuses ${JSON.stringify(named)} != packages ${JSON.stringify(sorted(PKG_NAMES))}`);
    }
    for (const pkg of PKG_NAMES) {
      const st = project[pkg];
      if (!st || typeof st !== 'object') {
        fail(`codecov.yml: missing project status "${pkg}"`);
        continue;
      }
      const wantTarget = `${ssot[pkg].lines}%`;
      if (String(st.target) !== wantTarget) {
        fail(`codecov.yml ${pkg}: target ${JSON.stringify(st.target)} != coverage-thresholds.json ${pkg}.lines (${wantTarget})`);
      }
      if (String(st.threshold) !== '2%') {
        fail(`codecov.yml ${pkg}: threshold ${JSON.stringify(st.threshold)} != 2% (ADR-282)`);
      }
      const paths = Array.isArray(st.paths) ? st.paths : [];
      if (!paths.includes(`${PACKAGES[pkg]}/`)) {
        fail(`codecov.yml ${pkg}: paths ${JSON.stringify(paths)} must include "${PACKAGES[pkg]}/" (ADR-282 paths route)`);
      }
      if ('base' in st) {
        fail(`codecov.yml ${pkg}: "base:" is deprecated (July 2020) and must not be used`);
      }
    }
    const patch = (status.patch && status.patch.default) || {};
    if (String(patch.target) !== '80%') {
      fail(`codecov.yml patch: target ${JSON.stringify(patch.target)} != 80% (ADR-282)`);
    }
    if (!['0%', '0'].includes(String(patch.threshold))) {
      fail(`codecov.yml patch: threshold ${JSON.stringify(patch.threshold)} != 0% (ADR-282)`);
    }
    if (patch.informational !== true) {
      fail(`codecov.yml patch: informational must be true (ADR-282 decision; flip only via an ADR)`);
    }
    if ('base' in patch) {
      fail('codecov.yml patch: "base:" is deprecated (July 2020) and must not be used');
    }
  } catch (e) {
    fail(`codecov.yml unreadable/invalid: ${e.message}`);
  }

  // --- 4. Documented policy points at the SSOT and restates no numbers. ---
  const DOCS = [
    ['AGENTS.md', /\d{1,3}%[ \t]+(Lines|Functions|lines|functions)\b/],
    ['CONTRIBUTING.md', /\d{1,3}%[ \t]+(Lines|Functions|lines|functions)\b/],
    ['docs/conventions.md', /\d{1,3}%[ \t]+(Lines|Functions|lines|functions)\b/],
  ];
  for (const [file, numberPattern] of DOCS) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    if (!text.includes('coverage-thresholds.json')) {
      fail(`${file}: missing pointer to coverage-thresholds.json (docs must reference the SSOT, ADR-282)`);
    }
    const m = text.match(numberPattern);
    if (m) {
      fail(`${file}: hand-typed coverage number "${m[0]}" — docs hold no threshold values (ADR-282)`);
    }
  }

  // --- 5. Gate wiring: manifest declares the check and the gate runs it. ---
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/gate-manifest.json'), 'utf8'));
    const checks = (manifest.local && manifest.local.checks) || [];
    if (!checks.includes('coverage-parity')) {
      fail('scripts/gate-manifest.json: local.checks must include "coverage-parity"');
    }
  } catch (e) {
    fail(`scripts/gate-manifest.json unreadable: ${e.message}`);
  }
  const gate = fs.readFileSync(path.join(root, 'scripts/quality_gate.sh'), 'utf8');
  if (!gate.includes('validate-coverage-parity.sh')) {
    fail('scripts/quality_gate.sh: does not invoke validate-coverage-parity.sh');
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
NODE
then
  printf '  %s✓%s coverage-thresholds.json ↔ vitest.config.ts ↔ codecov.yml ↔ docs\n' "$GREEN" "$NC"
else
  printf '  %s✗%s coverage threshold parity broken — mismatches listed above (ADR-282)\n' "$RED" "$NC"
  FAILED=1
fi

echo ""
if [[ $FAILED -ne 0 ]]; then
  printf '%s✗ Coverage parity check failed — see above for mismatches%s\n' "$RED" "$NC"
  exit 1
fi

printf '%s✓ Coverage threshold parity validated (ADR-282)%s\n' "$GREEN" "$NC"
exit 0
