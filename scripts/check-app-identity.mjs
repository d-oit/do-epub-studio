#!/usr/bin/env node
// scripts/check-app-identity.mjs
// Repo guard for product identity (name + version) per ADR-104.
//
// 1. Reads apps/web/src/config/app-identity.json and asserts that
//    `name` and `shortName` are the canonical strings (d.o.EPUB Studio
//    / d.o.EPUB) — these are the only allowed spellings in source.
// 2. Scans tracked source/docs for any forbidden spellings of the
//    product name. Build artifacts and the canonical source itself
//    are excluded from the scan.
// 3. Asserts VERSION === root package.json `version`.
// 4. Asserts VERSION is >= the highest released version in CHANGELOG.md.
// 5. Asserts all per-package `package.json` `version` fields == VERSION.
//
// Fails CI on any drift. Run via `scripts/quality_gate.sh`.
//
// Usage:  node scripts/check-app-identity.mjs
// Exit:   0 = clean, 1 = drift detected, 2 = missing required file.
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection */
// The whole point of this script is to walk every file in the repo
// and read its contents — every path and every array index is
// dynamic by design. The walker is bounded by SCAN_EXCLUDE_DIR_PREFIXES
// (skips node_modules, dist, .git, etc.) and SCAN_EXCLUDE_PATHS (the
// canonical source + the guard itself), so untrusted input cannot
// reach the filesystem APIs. Object-injection (lines[i]) is on a
// string array literal that we just split; no user data flows in.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const APP_IDENTITY_PATH = resolve(
  REPO_ROOT,
  'apps/web/src/config/app-identity.json',
);
const VERSION_PATH = resolve(REPO_ROOT, 'VERSION');
const ROOT_PKG_PATH = resolve(REPO_ROOT, 'package.json');
const CHANGELOG_PATH = resolve(REPO_ROOT, 'CHANGELOG.md');

const CANONICAL_NAME = 'd.o.EPUB Studio';
const CANONICAL_SHORT = 'd.o.EPUB';

// Disallowed forms (case-sensitive). "EPUB Studio" alone, "do EPUB Studio",
// "d.o. ePUB Studio", and the lowercase-e "ePUB" form are all forbidden.
// We must allow the canonical "d.o.EPUB Studio" (preceded by ".") while
// rejecting the bare "EPUB Studio" and other variants.
const FORBIDDEN_PATTERNS = [
  /\bdo EPUB Studio\b/,
  /\bd\.o\. ePUB Studio\b/,
  // Bare "EPUB Studio" — must not be preceded by "." (which is the
  // canonical "d.o.EPUB Studio" form). Negative lookbehind handles that.
  /(?<!\.)EPUB Studio\b/,
];

// Files that legitimately contain the brand name but use the canonical
// form. These are excluded from the scan so the canonical source itself
// is not flagged.
const SCAN_EXCLUDE_PATHS = new Set(
  [
    // Canonical source
    'apps/web/src/config/app-identity.json',
    'apps/web/src/config/app-identity.ts',
    'apps/web/src/i18n/en.ts',
    'apps/web/src/i18n/de.ts',
    'apps/web/src/i18n/fr.ts',
    'apps/web/src/features/auth/LoginPage.tsx',
    // The guard script itself
    'scripts/check-app-identity.mjs',
    // Identity-related plans: ADR-104 enumerates the offenders it
    // resolves, so we exclude it to allow the table to remain
    // historically accurate.
    'plans/104-adr-product-identity-and-version-governance.md',
    'plans/104-goap-production-readiness-gap-closure-2026-06-21.md',
    'plans/104-goap-execution-record-2026-06-22.md',
  ].map((p) => p.split('/').join('/')),
);

// Directory prefixes excluded from the scan.
const SCAN_EXCLUDE_DIR_PREFIXES = [
  'node_modules/',
  'apps/web/dist/',
  '.turbo/',
  '.git/',
  'reports/',
  'playwright-report/',
  'test-results/',
  'coverage/',
  'plans/archive/',
];

// File extensions scanned.
const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.html',
  '.yml',
  '.yaml',
  '.css',
]);

let failed = 0;
const errors = [];

function err(file, msg) {
  failed += 1;
  errors.push(`${file}: ${msg}`);
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function fileExists(path) {
  return existsSync(path);
}

function requireFile(path, label) {
  if (!fileExists(path)) {
    err(label, 'required file missing');
    process.exit(2);
  }
  return readText(path);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(REPO_ROOT, full).split('\\').join('/');
    if (SCAN_EXCLUDE_DIR_PREFIXES.some((p) => rel === p.slice(0, -1) || rel.startsWith(p))) {
      continue;
    }
    if (SCAN_EXCLUDE_PATHS.has(rel)) {
      continue;
    }
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && SCAN_EXTENSIONS.has(extname(full))) {
      out.push(rel);
    }
  }
  return out;
}

function getCanonicalIdentity() {
  const raw = requireFile(APP_IDENTITY_PATH, 'app-identity.json');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    err('app-identity.json', `not valid JSON: ${e.message}`);
    process.exit(2);
  }
  return parsed;
}

function assertCanonicalIdentity(identity) {
  if (identity.name !== CANONICAL_NAME) {
    err(
      'app-identity.json',
      `name must be "${CANONICAL_NAME}" (got "${identity.name}")`,
    );
  }
  if (identity.shortName !== CANONICAL_SHORT) {
    err(
      'app-identity.json',
      `shortName must be "${CANONICAL_SHORT}" (got "${identity.shortName}")`,
    );
  }
}

function assertNoForbiddenSpellings(files) {
  for (const rel of files) {
    const text = readText(resolve(REPO_ROOT, rel));
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      for (const pattern of FORBIDDEN_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          err(
            rel,
            `forbidden product name spelling "${match[0]}" (ADR-104) at line ${i + 1}: ${line.trim()}`,
          );
        }
      }
    }
  }
}

function parseVersion(raw) {
  const m = raw.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    raw: `${m[1]}.${m[2]}.${m[3]}`,
  };
}

function cmpSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function getHighestReleasedVersion(changelogText) {
  // Released versions appear as `## [X.Y.Z] - YYYY-MM-DD`. `[Unreleased]`
  // and anything inside `[ ... ]` without a leading `##` is ignored.
  const headings = changelogText.match(/^##\s*\[(\d+\.\d+\.\d+)\][^\n]*$/gm) || [];
  let highest = null;
  for (const heading of headings) {
    const m = heading.match(/^##\s*\[(\d+\.\d+\.\d+)\]/);
    if (!m) continue;
    const parsed = parseVersion(m[1]);
    if (parsed && (!highest || cmpSemver(parsed, highest) > 0)) {
      highest = parsed;
    }
  }
  return highest;
}

function assertVersionParity(version) {
  const rootPkg = JSON.parse(requireFile(ROOT_PKG_PATH, 'root package.json'));
  if (rootPkg.version !== version.raw) {
    err(
      'package.json',
      `root version "${rootPkg.version}" must equal VERSION "${version.raw}"`,
    );
  }
}

function assertPerPackageVersions(version) {
  const dirs = ['apps', 'packages'];
  for (const top of dirs) {
    const full = resolve(REPO_ROOT, top);
    if (!existsSync(full)) continue;
    for (const entry of readdirSync(full)) {
      const sub = resolve(full, entry);
      if (!statSync(sub).isDirectory()) continue;
      const pkgPath = join(sub, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readText(pkgPath));
      if (pkg.version !== version.raw) {
        err(
          relative(REPO_ROOT, pkgPath).split('\\').join('/'),
          `version "${pkg.version}" must equal VERSION "${version.raw}"`,
        );
      }
    }
  }
}

function assertVersionAtLeastReleased(version) {
  if (!fileExists(CHANGELOG_PATH)) {
    err('CHANGELOG.md', 'required file missing');
    return;
  }
  const highest = getHighestReleasedVersion(readText(CHANGELOG_PATH));
  if (highest && cmpSemver(version, highest) < 0) {
    err(
      'VERSION',
      `VERSION "${version.raw}" is less than highest released changelog version "${highest.raw}" (ADR-104)`,
    );
  }
}

const identity = getCanonicalIdentity();
assertCanonicalIdentity(identity);

const files = walk(REPO_ROOT);
assertNoForbiddenSpellings(files);

const versionRaw = requireFile(VERSION_PATH, 'VERSION');
const version = parseVersion(versionRaw);
if (!version) {
  err('VERSION', `not a valid semver string: "${versionRaw}"`);
} else {
  assertVersionParity(version);
  assertPerPackageVersions(version);
  assertVersionAtLeastReleased(version);
}

if (failed > 0) {
  console.error('✗ App identity / version drift detected (ADR-104):');
  for (const line of errors) console.error(`  ${line}`);
  process.exit(1);
}

console.log(
  `✓ App identity and version governance clean (ADR-104).`,
);
console.log(`  Canonical name:   ${identity.name} (${identity.shortName})`);
console.log(`  VERSION:          ${version?.raw ?? '(invalid)'}`);
console.log(`  Files scanned:    ${files.length}`);
