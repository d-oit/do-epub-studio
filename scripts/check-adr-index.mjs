#!/usr/bin/env node
// check-adr-index.mjs — Validate ADR-INDEX.md for duplicates and missing files (ADR-083)
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const fileIdx = process.argv.indexOf('--file');
const indexPath = fileIdx !== -1
  ? join(repoRoot, process.argv[fileIdx + 1])
  : join(repoRoot, 'plans', 'ADR-INDEX.md');

let content;
try {
  content = readFileSync(indexPath, 'utf-8');
} catch {
  console.error(`Cannot read ADR index: ${indexPath}`);
  process.exit(1);
}

const errors = [];
const numbers = new Map();

function addNumber(baseNum, entry) {
  const existing = numbers.get(baseNum);
  if (existing) {
    existing.push(entry);
  } else {
    numbers.set(baseNum, [entry]);
  }
}

const sections = content.split(/^## /m).filter(s => s.trim());

for (const section of sections) {
  const lines = section.split('\n');
  const sectionName = lines[0]?.trim() || 'Unknown';
  const tableLines = lines.filter(l => l.startsWith('|') && !l.startsWith('|---'));
  if (tableLines.length < 2) continue;

  for (const line of tableLines.slice(1)) {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const numStr = cells[0];
    const filePath = cells[2];

    const baseMatch = numStr.match(/^(\d+)/);
    if (!baseMatch) continue;
    const baseNum = baseMatch[1];

    // ADR-083 §2: plan numbers (0NN-goap-*) and ADR numbers (0NN-adr-*) share
    // the numeric space but are distinguished by filename prefix — a matching
    // plan/ADR pair (e.g. GOAP-244 + ADR-244) is a sibling relationship, not a
    // collision. Only ADR rows participate in duplicate detection.
    const isAdrRow = filePath && filePath.includes('-adr-');
    if (isAdrRow) {
      addNumber(baseNum, { row: line, section: sectionName, num: numStr });
    }

    if (sectionName.startsWith('Accepted') && filePath) {
      const cleanPath = filePath.replace(/`/g, '').trim();
      const fullPath = join(repoRoot, cleanPath);
      if (!existsSync(fullPath)) {
        errors.push(`File not found: ${cleanPath} (ADR ${numStr})`);
      }
    }
  }
}

for (const [base, entries] of numbers) {
  if (entries.length > 2) {
    errors.push(`Duplicate ADR ${base}: ${entries.map(e => e.num).join(', ')}`);
  }
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.num)) {
      errors.push(`Exact duplicate: ADR ${e.num}`);
    }
    seen.add(e.num);
  }
}

if (errors.length > 0) {
  console.error('ADR index validation FAILED:');
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(`✓ ADR index validation passed (ADR-083).`);
console.log(`  Numbers tracked: ${numbers.size}`);
