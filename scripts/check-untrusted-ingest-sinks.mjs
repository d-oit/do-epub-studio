#!/usr/bin/env node
// scripts/check-untrusted-ingest-sinks.mjs
//
// Hermetic proof that untrusted-PR-text consumers contain no
// dynamic-execution sinks (GOAP-276 Phase 1): no `eval`, no `sh -c`,
// no `exec`, no shell-enabled `spawn`.
//
// Scope is the executable content of the named consumers:
//   - shell-tagged fenced blocks in Markdown
//   - `.sh`/`.bash`/`.bats`/`.zsh` files (comment lines stripped)
//   - `run:` blocks in workflow YAML
//   - `.js`/`.mjs`/`.cjs`/`.ts`/`.tsx`/`.py` files (comment lines stripped)
//
// Every configured target MUST exist — a renamed consumer fails the check
// instead of silently passing vacuously.
//
// Usage:
//   node scripts/check-untrusted-ingest-sinks.mjs            # default targets
//   node scripts/check-untrusted-ingest-sinks.mjs <paths...> # explicit targets

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const DEFAULT_TARGETS = [
  '.agents/skills/pr-review-fix',
  '.agents/skills/pr-roast-batch-close',
  '.agents/skills/github-pr-autopilot',
  'scripts/smart-update-pr.sh',
  '.github/workflows/bot-repush-guard.yml',
  '.github/workflows/duplicate-pr-guard.yml',
  'scripts/check-duplicate-prs.mjs',
];

const SINKS = [
  { name: 'eval', re: /(?<![\w.])eval\b/ },
  { name: 'shell -c', re: /(?<![\w-])(?:ba|da|k|z)?sh\s+-c\b/ },
  { name: 'exec', re: /(?<![\w.])exec\b/ },
  { name: 'exec()', re: /(?<![\w.])exec(?:Sync|File)?\s*\(/ },
  { name: 'shell-enabled spawn', re: /\bshell\s*(?::|=)\s*(?:true|True)\b/ },
  { name: 'Function constructor', re: /new\s+Function\s*\(/ },
  { name: 'spawn', re: /(?<![\w.])spawn(?:Sync)?\s*\(/ },
  {
    name: 'os.system/subprocess',
    re: /(?<![\w.])os\.system\s*\(|(?<![\w.])subprocess\.(?:run|call|Popen|check_output)\s*\(/,
  },
];

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'dash', 'ksh', 'console']);

function walk(target, out = []) {
  const stat = statSync(target, { throwIfNoEntry: false });
  if (!stat) throw new Error(`target does not exist: ${relative(ROOT, target)}`);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(target, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      walk(join(target, entry.name), out);
    }
  } else {
    out.push(target);
  }
  return out;
}

// Executable-content extraction per file type. Returns [{ line, text }].
function isComment(text) {
  const trimmed = text.trimStart();
  return trimmed.startsWith('#') || trimmed.startsWith('//');
}

function executableLines(file, content) {
  const ext = file.slice(file.lastIndexOf('.'));
  const lines = content.split('\n');
  const out = [];

  if (ext === '.md') {
    let fence = null;
    let lang = '';
    for (let i = 0; i < lines.length; i++) {
      const match = /^\s*(?:```|~~~)\s*([^\s`~]*)/.exec(lines[i]);
      if (fence === null) {
        if (match) {
          fence = i;
          lang = match[1].toLowerCase();
        }
        continue;
      }
      if (match) {
        fence = null;
        continue;
      }
      if (SHELL_LANGS.has(lang)) out.push({ line: i + 1, text: lines[i] });
    }
    return out.filter(({ text }) => !isComment(text));
  }

  if (ext === '.yml' || ext === '.yaml') {
    for (let i = 0; i < lines.length; i++) {
      const run = /^(\s*)(?:-\s+)?run:\s*(.*)$/.exec(lines[i]);
      if (!run) continue;
      const [, indent, rest] = run;
      if (/^[|>][-+]?\s*$/.test(rest)) {
        const childIndent = indent.length;
        for (let j = i + 1; j < lines.length; j++) {
          const line = lines[j];
          if (line.trim() === '') continue;
          const leading = line.length - line.trimStart().length;
          if (leading <= childIndent) break;
          out.push({ line: j + 1, text: line });
        }
      } else {
        out.push({ line: i + 1, text: rest });
      }
    }
    return out.filter(({ text }) => !isComment(text));
  }

  // Whole-file scan for shell/JS/TS/Python, minus comment-only lines.
  for (let i = 0; i < lines.length; i++) {
    if (isComment(lines[i])) continue;
    out.push({ line: i + 1, text: lines[i] });
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    console.log('Usage: node scripts/check-untrusted-ingest-sinks.mjs [paths...]');
    return 0;
  }
  const targets = (args.length > 0 ? args : DEFAULT_TARGETS).map((p) =>
    p.startsWith('/') ? p : join(ROOT, p),
  );

  let files;
  try {
    files = targets.flatMap((target) => walk(target));
  } catch (error) {
    console.error(`✗ ${error.message}`);
    return 1;
  }

  const findings = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const { line, text } of executableLines(file, content)) {
      for (const sink of SINKS) {
        if (sink.re.test(text)) {
          findings.push({ file: relative(ROOT, file), line, sink: sink.name, text: text.trim() });
          break;
        }
      }
    }
  }

  for (const finding of findings) {
    console.error(`✗ ${finding.file}:${finding.line} [${finding.sink}] ${finding.text}`);
  }

  if (findings.length > 0) {
    console.error(
      `✗ ${findings.length} dynamic-execution sink(s) found in untrusted-ingest consumers`,
    );
    return 1;
  }
  console.log(`✓ untrusted-ingest sink check clean (${files.length} file(s), 0 findings)`);
  return 0;
}

process.exit(main());
