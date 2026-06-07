#!/usr/bin/env node
// scripts/check-agent-sync.mjs
// Drift guard for per-model agent config files. Per issue #445.
//
// Fails CI if any per-agent "thin adapter" file (CLAUDE.md, GEMINI.md,
// .gemini/README.md, .jules/README.md, .windsurf/README.md) has drifted
// into a near-copy of AGENTS.md. Thin adapters must stay short and
// point back to AGENTS.md for shared rules.
//
// Also enforces a soft LOC cap on adapter files so they cannot grow
// silently.
//
// Usage:  node scripts/check-agent-sync.mjs
// Exit:   0 = clean, 1 = drift detected, 2 = missing file

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const AGENTS_MD = resolve(REPO_ROOT, 'AGENTS.md');

// Adapters that must stay thin.
const ADAPTERS = [
  'CLAUDE.md',
  'GEMINI.md',
  '.gemini/README.md',
  '.jules/README.md',
  '.windsurf/README.md',
];

// Per-adapter soft LOC cap.
const SOFT_LOC_CAP = 80;

// Sections from AGENTS.md that must NOT appear (verbatim) in adapters.
const FORBIDDEN_SECTION_HEADINGS = [
  '## Named Constants',
  '## TIER 1',
  '## TIER 2',
  '## TIER 3',
  '## TIER 4',
  '## Compliance Self-Check',
  '## Skills Reference',
  '## Key Commands',
];

let failed = 0;
const errors = [];

function err(file, msg) {
  failed += 1;
  errors.push(`${file}: ${msg}`);
}

// 1. AGENTS.md must exist.
if (!existsSync(AGENTS_MD)) {
  err('AGENTS.md', 'canonical file missing');
  for (const line of errors) console.error(`✗ ${line}`);
  process.exit(2);
}

const agentsContent = readFileSync(AGENTS_MD, 'utf8');
const agentsLines = agentsContent.split('\n').length;

// 2. AGENTS.md LOC guard (enforce the AGENTS.md "max 200 LOC" rule).
if (agentsLines > 200) {
  err('AGENTS.md', `exceeds 200 LOC cap (currently ${agentsLines})`);
}

// 3. Per-adapter checks.
for (const relPath of ADAPTERS) {
  const fullPath = resolve(REPO_ROOT, relPath);
  if (!existsSync(fullPath)) {
    err(relPath, 'adapter file missing (delete the rule, not the file)');
    continue;
  }
  const content = readFileSync(fullPath, 'utf8');
  const lines = content.split('\n').length;

  // Soft LOC cap.
  if (lines > SOFT_LOC_CAP) {
    err(relPath, `exceeds ${SOFT_LOC_CAP}-line soft cap (currently ${lines})`);
  }

  // Drift detection: forbidden headings.
  for (const heading of FORBIDDEN_SECTION_HEADINGS) {
    if (content.includes(heading)) {
      err(
        relPath,
        `contains forbidden heading "${heading}" — adapters must point to AGENTS.md, not copy it`,
      );
    }
  }

  // Drift detection: large verbatim block from AGENTS.md.
  // Take the first 5 non-empty lines of AGENTS.md and assert they do not
  // all appear in the adapter.
  const agentsHead = agentsContent
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .slice(0, 5)
    .join('\n');
  if (content.includes(agentsHead)) {
    err(
      relPath,
      'contains a verbatim block from the start of AGENTS.md — this is a copy, not an adapter',
    );
  }

  // Adapter MUST reference AGENTS.md (proves it is a delta file).
  if (!/AGENTS\.md/.test(content)) {
    err(relPath, 'does not reference AGENTS.md — adapters must point to the canonical rules');
  }
}

if (failed > 0) {
  console.error('✗ Agent-adapter drift detected:');
  for (const line of errors) console.error(`  ${line}`);
  process.exit(1);
}

console.log('✓ All agent adapters are thin and reference AGENTS.md.');
console.log(`  AGENTS.md: ${agentsLines} LOC (cap 200)`);
console.log(`  ${ADAPTERS.length} adapter files checked (cap ${SOFT_LOC_CAP} LOC each)`);
