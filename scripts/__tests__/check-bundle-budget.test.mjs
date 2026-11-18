import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../check-bundle-budget.mjs');
const baselineScriptPath = path.resolve(__dirname, '../bundle-baseline.mjs');
const rootDir = path.resolve(__dirname, '../..');
const tempDist = path.resolve(__dirname, 'temp-dist-budget');
const assetsDir = path.join(tempDist, 'assets');
const tempBaseline = path.join(__dirname, 'temp-generated-baseline.json');
const tempReport = path.join(__dirname, 'temp-budget-report.md');
const ROUTES = {
  reader: { source: 'src/features/reader/ReaderPage.tsx', file: 'assets/reader-route.js' },
  catalog: { source: 'src/features/catalog/CatalogPage.tsx', file: 'assets/catalog-route.js' },
  admin: { source: 'src/features/admin/AdminDashboardPage.tsx', file: 'assets/admin-route.js' },
};

function childEnv(overrides = {}) {
  const env = { ...process.env };
  for (const key of [
    'BUNDLE_BUDGET_BASELINE',
    'BUNDLE_BUDGET_FAIL_ON_VIOLATION',
    'BUNDLE_BUDGET_NO_BASELINE',
    'BUNDLE_BUDGET_REPORT',
  ]) {
    delete env[key];
  }
  return { ...env, ...overrides };
}

function writeManifest({
  readerData = Buffer.from('reader entry'),
  catalogData = Buffer.from('catalog entry'),
  adminData = Buffer.from('admin entry'),
  readerImports = [],
  readerDynamicImports = [],
  dynamicReaderData = Buffer.from('user-triggered reader chunk'),
  missingReaderFile = false,
  includeSharedChunk = false,
  missingSharedFile = false,
} = {}) {
  const manifest = {};
  const routeData = { reader: readerData, catalog: catalogData, admin: adminData };
  for (const [name, route] of Object.entries(ROUTES)) {
    manifest[route.source] = {
      file: route.file,
      isEntry: true,
      imports: name === 'reader' ? readerImports : [],
      dynamicImports: name === 'reader' ? readerDynamicImports : [],
      css: [],
    };
    if (name !== 'reader' || !missingReaderFile) {
      fs.writeFileSync(path.join(tempDist, route.file), routeData[name]);
    }
  }
  if (readerDynamicImports.length > 0) {
    manifest[readerDynamicImports[0]] = {
      file: 'assets/reader-lazy.js',
      imports: [],
      css: [],
    };
    fs.writeFileSync(path.join(tempDist, 'assets/reader-lazy.js'), dynamicReaderData);
  }

  if (includeSharedChunk) {
    manifest['src/shared.ts'] = { file: 'assets/shared.js', imports: [], css: [] };
    if (!missingSharedFile) fs.writeFileSync(path.join(tempDist, 'assets/shared.js'), 'shared');
  }
  fs.mkdirSync(path.join(tempDist, '.vite'), { recursive: true });
  fs.writeFileSync(path.join(tempDist, '.vite', 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}

function makeBaseline(routeNames = Object.keys(ROUTES)) {
  return {
    generated: '2026-01-01',
    routes: Object.fromEntries(
      routeNames.map((route) => [
        route,
        {
          entry: `assets/previous-${route}.js`,
          gzip: 1,
          brotli: 1,
          totalTransitive: { gzip: 1, brotli: 1 },
        },
      ]),
    ),
  };
}

function writeBaseline(baseline) {
  fs.writeFileSync(tempBaseline, JSON.stringify(baseline));
}

function runScript(args = [], env = {}) {
  return spawnSync('node', [scriptPath, tempDist, ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    env: childEnv(env),
  });
}

function runBaseline() {
  return spawnSync('node', [baselineScriptPath, '--dist', tempDist, '--output', tempBaseline], {
    cwd: rootDir,
    encoding: 'utf8',
    env: childEnv(),
  });
}

describe('check-bundle-budget.mjs (ADR-107 §3)', () => {
  beforeEach(() => {
    fs.rmSync(tempDist, { recursive: true, force: true });
    fs.rmSync(tempBaseline, { force: true });
    fs.rmSync(tempReport, { force: true });
    fs.mkdirSync(assetsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDist, { recursive: true, force: true });
    fs.rmSync(tempBaseline, { force: true });
    fs.rmSync(tempReport, { force: true });
  });

  it('measures only the selected route entry and its imported graph', () => {
    const readerData = crypto.randomBytes(80 * 1024);
    writeManifest({
      readerData,
      catalogData: crypto.randomBytes(100 * 1024),
      adminData: crypto.randomBytes(100 * 1024),
    });

    const generated = runBaseline();
    expect(generated.status).toBe(0);
    const baseline = JSON.parse(fs.readFileSync(tempBaseline, 'utf8'));
    expect(baseline.routes.reader.totalTransitive.gzip).toBe(
      zlib.gzipSync(readerData, { level: 9 }).length,
    );

    const checked = runScript(['--fail-on-violation'], {
      BUNDLE_BUDGET_BASELINE: tempBaseline,
    });
    expect(checked.status).toBe(0);
  });

  it('excludes user-triggered dynamic imports from the initial route aggregate', () => {
    const readerData = Buffer.from('reader entry');
    writeManifest({
      readerData,
      readerDynamicImports: ['src/lazy-reader.ts'],
      dynamicReaderData: Buffer.from('user-triggered reader content'),
    });

    const generated = runBaseline();
    expect(generated.status).toBe(0);
    const baseline = JSON.parse(fs.readFileSync(tempBaseline, 'utf8'));
    expect(baseline.routes.reader.totalTransitive.gzip).toBe(
      zlib.gzipSync(readerData, { level: 9 }).length,
    );
  });

  it('allows files within per-file budgets', () => {
    writeManifest();
    fs.writeFileSync(path.join(assetsDir, 'index-AAAA1111.js'), 'a'.repeat(1024));
    fs.writeFileSync(path.join(assetsDir, 'index-BBBB2222.css'), 'b'.repeat(512));

    const result = runScript();
    expect(result.status).toBe(0);
  });

  it('does not fail an absolute gzip violation unless enforcement is requested', () => {
    writeManifest();
    fs.writeFileSync(path.join(assetsDir, 'index-RAND0000.js'), crypto.randomBytes(500 * 1024));

    const result = runScript();
    expect(result.status).toBe(0);
  });

  it('fails absolute budget violations in enforced mode without baseline comparison', () => {
    writeManifest();
    fs.writeFileSync(path.join(assetsDir, 'index-RAND0000.js'), crypto.randomBytes(500 * 1024));

    const result = runScript(['--no-baseline'], { BUNDLE_BUDGET_FAIL_ON_VIOLATION: '1' });
    expect(result.status).toBe(1);
  });

  it('fails lazy-chunk budget violations in enforced mode without baseline comparison', () => {
    writeManifest();
    fs.writeFileSync(
      path.join(assetsDir, 'admin-route-RAND0000.js'),
      crypto.randomBytes(200 * 1024),
    );

    const result = runScript(['--no-baseline'], { BUNDLE_BUDGET_FAIL_ON_VIOLATION: '1' });
    expect(result.status).toBe(1);
  });

  it('enforces the CSS file gzip budget for lazy stylesheets', () => {
    writeManifest();
    fs.writeFileSync(
      path.join(assetsDir, 'reader-lazy-RAND0000.css'),
      crypto.randomBytes(40 * 1024),
    );

    const result = runScript(['--no-baseline', '--fail-on-violation']);
    expect(result.status).toBe(1);
  });

  it('exits 2 when dist directory is missing', () => {
    fs.rmSync(tempDist, { recursive: true, force: true });
    const result = runScript();
    expect(result.status).toBe(2);
  });

  it('includes all configured route deltas in the report', () => {
    writeManifest({ readerData: crypto.randomBytes(60 * 1024) });
    writeBaseline(makeBaseline());

    const result = runScript([], {
      BUNDLE_BUDGET_BASELINE: tempBaseline,
      BUNDLE_BUDGET_REPORT: tempReport,
    });

    expect(result.status).toBe(0);

    const report = fs.readFileSync(tempReport, 'utf8');
    for (const route of Object.keys(ROUTES)) {
      const routeRows = report.split('\n').filter((line) => line.startsWith(`| ${route} |`));
      expect(routeRows).toHaveLength(2);
    }
  });

  it('fails a raw transitive route budget even when compressed assets fit per-file limits', () => {
    const budgetConfig = JSON.parse(
      fs.readFileSync(path.join(rootDir, '.performance-budgets.json'), 'utf8'),
    );
    const readerLimit = budgetConfig.routeBudgets.reader.maxSize;
    writeManifest({ readerData: Buffer.alloc(readerLimit + 1, 0x61) });

    const result = runScript(['--no-baseline', '--fail-on-violation']);
    expect(result.status).toBe(1);
  });

  it('rejects unknown checker flags and incomplete baseline arguments', () => {
    const unknownFlag = runScript(['--unrecognized-option']);
    expect(unknownFlag.status).toBe(2);

    const missingBaselineValue = spawnSync('node', [baselineScriptPath, '--dist'], {
      cwd: rootDir,
      encoding: 'utf8',
      env: childEnv(),
    });
    expect(missingBaselineValue.status).toBe(2);

    const unknownBaselineFlag = spawnSync('node', [baselineScriptPath, '--unknown'], {
      cwd: rootDir,
      encoding: 'utf8',
      env: childEnv(),
    });
    expect(unknownBaselineFlag.status).toBe(2);

    const escapedDist = `${rootDir}-outside`;
    const escapedCheck = spawnSync('node', [scriptPath, escapedDist, '--no-baseline'], {
      cwd: rootDir,
      encoding: 'utf8',
      env: childEnv(),
    });
    expect(escapedCheck.status).toBe(2);

    const escapedBaseline = spawnSync(
      'node',
      [baselineScriptPath, '--dist', escapedDist, '--output', tempBaseline],
      { cwd: rootDir, encoding: 'utf8', env: childEnv() },
    );
    expect(escapedBaseline.status).toBe(2);
    expect(fs.existsSync(tempBaseline)).toBe(false);
  });

  it('fails enforced comparisons on missing, malformed, or stale baselines', () => {
    writeManifest();
    const missing = runScript(['--fail-on-violation'], {
      BUNDLE_BUDGET_BASELINE: path.join(__dirname, 'no-such-baseline.json'),
    });
    expect(missing.status).toBe(2);

    writeBaseline({ routes: {} });
    const malformed = runScript(['--fail-on-violation'], { BUNDLE_BUDGET_BASELINE: tempBaseline });
    expect(malformed.status).toBe(2);

    writeBaseline(makeBaseline(['reader']));
    const incomplete = runScript(['--fail-on-violation'], { BUNDLE_BUDGET_BASELINE: tempBaseline });
    expect(incomplete.status).toBe(2);

    writeBaseline(makeBaseline([...Object.keys(ROUTES), 'obsolete']));
    const stale = runScript(['--fail-on-violation'], { BUNDLE_BUDGET_BASELINE: tempBaseline });
    expect(stale.status).toBe(2);
  });

  it('fails enforced comparisons on missing route artifacts and transitive files', () => {
    writeBaseline(makeBaseline());
    writeManifest({ missingReaderFile: true });
    const missingEntry = runScript(['--fail-on-violation'], {
      BUNDLE_BUDGET_BASELINE: tempBaseline,
    });
    expect(missingEntry.status).toBe(2);

    writeManifest({
      readerImports: ['src/shared.ts'],
      includeSharedChunk: true,
      missingSharedFile: true,
    });
    const missingTransitive = runScript(['--fail-on-violation'], {
      BUNDLE_BUDGET_BASELINE: tempBaseline,
    });
    expect(missingTransitive.status).toBe(2);
  });

  it('does not write a baseline when a route import or artifact is missing', () => {
    writeManifest({ readerImports: ['missing-module'] });
    const unresolvedImport = runBaseline();
    expect(unresolvedImport.status).toBe(2);
    expect(fs.existsSync(tempBaseline)).toBe(false);

    writeManifest({
      readerImports: ['src/shared.ts'],
      includeSharedChunk: true,
      missingSharedFile: true,
    });
    const missingArtifact = runBaseline();
    expect(missingArtifact.status).toBe(2);
    expect(fs.existsSync(tempBaseline)).toBe(false);
  });
});
