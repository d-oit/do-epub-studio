#!/usr/bin/env node
// scripts/check-agent-sync.mjs
// Drift guard for per-model agent config files. Per issue #445.
// Extended to the nested `.agents/AGENTS.md` by GOAP-280 (GOAP-276
// Phase 0 item 7) — see plans/280-adr-nested-agents-thin-adapter.md.
//
// Fails CI if any per-agent "thin adapter" file listed in ADAPTERS has
// drifted into a near-copy of AGENTS.md. Thin adapters must stay short
// and point back to AGENTS.md for shared rules.
//
// ADAPTERS IS the enforcement list: every entry is read and validated
// against all four rules (soft LOC cap, forbidden section headings,
// verbatim head copy, explicit AGENTS.md reference). Adding a new
// adapter costs one array entry — no new function.
//
// Also enforces a soft LOC cap on adapter files and a 200-LOC cap on
// the canonical AGENTS.md so neither can grow silently.
// Also verifies local `skills-lock.json` entries (sourceType "local") against
// the sha256 of their canonical SKILL.md so locked skills cannot drift.
//
// Usage:  node scripts/check-agent-sync.mjs
// Exit:   0 = clean, 1 = drift detected, 2 = missing canonical file

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const AGENTS_MD = resolve(REPO_ROOT, 'AGENTS.md');

// Adapters that must stay thin. THIS ARRAY IS ENFORCED — the loop below
// checks every entry; listing a path here is the only step needed to
// bring a new adapter under the guard.
const ADAPTERS = [
  'CLAUDE.md',
  'GEMINI.md',
  '.gemini/README.md',
  '.jules/README.md',
  '.windsurf/README.md',
  '.agents/AGENTS.md',
];

// Per-adapter soft LOC cap.
const SOFT_LOC_CAP = 80;

// Canonical AGENTS.md LOC cap (AGENTS.md "max 200 LOC" rule).
const CANONICAL_LOC_CAP = 200;

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

function readCanonicalAgentsFile() {
  try {
    return readFileSync(AGENTS_MD, 'utf8');
  } catch (error) {
    if (!(error instanceof Error) || error.code !== 'ENOENT') {
      throw error;
    }

    err('AGENTS.md', 'canonical file missing');
    for (const line of errors) console.error(`✗ ${line}`);
    process.exit(2);
  }
}

function validateAdapterContent(relPath, content) {
  const lines = content.split('\n').length;

  if (lines > SOFT_LOC_CAP) {
    err(relPath, `exceeds ${SOFT_LOC_CAP}-line soft cap (currently ${lines})`);
  }

  for (const heading of FORBIDDEN_SECTION_HEADINGS) {
    if (content.includes(heading)) {
      err(
        relPath,
        `contains forbidden heading "${heading}" — adapters must point to AGENTS.md, not copy it`,
      );
    }
  }

  const agentsHead = agentsContent
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .slice(0, 5)
    .join('\n');
  if (content.includes(agentsHead)) {
    err(
      relPath,
      'contains a verbatim block from the start of AGENTS.md — this is a copy, not an adapter',
    );
  }

  if (!content.includes('AGENTS.md')) {
    err(relPath, 'does not reference AGENTS.md — adapters must point to the canonical rules');
  }
}

function checkAdapter(relPath) {
  try {
    validateAdapterContent(relPath, readFileSync(resolve(REPO_ROOT, relPath), 'utf8'));
  } catch (error) {
    if (!(error instanceof Error) || error.code !== 'ENOENT') {
      throw error;
    }

    err(relPath, 'adapter file missing (delete the rule, not the file)');
  }
}

const agentsContent = readCanonicalAgentsFile();
const agentsLines = agentsContent.split('\n').length;

// 2. AGENTS.md LOC guard (enforce the AGENTS.md "max 200 LOC" rule).
if (agentsLines > CANONICAL_LOC_CAP) {
  err('AGENTS.md', `exceeds ${CANONICAL_LOC_CAP} LOC cap (currently ${agentsLines})`);
}

// 3. Local skill-lock audit — `sourceType: "local"` entries pin the sha256
// of the canonical SKILL.md; drift or a missing source fails the check.
const SKILLS_LOCK = resolve(REPO_ROOT, 'skills-lock.json');
if (existsSync(SKILLS_LOCK)) {
  let lock;
  try {
    lock = JSON.parse(readFileSync(SKILLS_LOCK, 'utf8'));
  } catch (error) {
    err('skills-lock.json', 'unreadable or invalid JSON');
    lock = null;
  }
  for (const [name, entry] of Object.entries(lock?.skills ?? {})) {
    if (entry.sourceType !== 'local') continue;
    const skillMd = resolve(REPO_ROOT, entry.source, 'SKILL.md');
    if (!existsSync(skillMd)) {
      err('skills-lock.json', `${name}: missing local source SKILL.md (${entry.source})`);
      continue;
    }
    const hash = createHash('sha256').update(readFileSync(skillMd, 'utf8')).digest('hex');
    if (hash !== entry.computedHash) {
      err(
        'skills-lock.json',
        `${name}: hash mismatch (locked ${entry.computedHash}, found ${hash})`,
      );
    }
  }
}

// 1. Adapter drift guard — ADAPTERS is the single source of enforcement.
for (const relPath of ADAPTERS) {
  checkAdapter(relPath);
}

if (failed > 0) {
  console.error('✗ Agent-adapter/skill-lock drift detected:');
  for (const line of errors) console.error(`  ${line}`);
  process.exit(1);
}

console.log('✓ All agent adapters are thin and reference AGENTS.md.');
console.log('✓ Local skills-lock entries match their SKILL.md hashes.');
console.log(`  AGENTS.md: ${agentsLines} LOC (cap ${CANONICAL_LOC_CAP})`);
console.log(`  ${ADAPTERS.length} adapter files checked (cap ${SOFT_LOC_CAP} LOC each)`);
