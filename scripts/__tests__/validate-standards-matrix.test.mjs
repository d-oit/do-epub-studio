import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRealTestFile, validateMatrix, validateRow } from '../validate-standards-matrix.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, '../validate-standards-matrix.mjs');

function runValidator(root) {
  return spawnSync('node', [scriptPath, '--root', root], { encoding: 'utf8', timeout: 30_000 });
}

const FAKE_TEST_FILE = 'packages/fake/src/__tests__/fake.test.ts';

const VALID_ROW = {
  spec: 'epub-33',
  clauseId: '5.7',
  clauseTitle: 'Spine section',
  requirement: 'The spine defines the default reading order.',
  implementationModule: ['packages/reader-core/src/parser/epub-parser.ts'],
  tests: [FAKE_TEST_FILE],
  evidence: ['docs/epub-capability-matrix.md'],
  status: 'implemented',
};

function writeMatrix(root, rows, extra = {}) {
  const dir = join(root, 'docs/standards');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'epub-conformance-matrix.json'),
    `${JSON.stringify(
      {
        matrixVersion: 1,
        updatedAt: '2026-11-19',
        policy: {
          stableBaseline: 'epub-33',
          experimentalSpecs: ['epub-34', 'epub-rs-34'],
          certification: 'only epub-33 certifies; drafts are experimental',
          implementededRequiresTest: true,
          nonImplementedRequiresExceptionNote: true,
        },
        rows,
        ...extra,
      },
      null,
      2,
    )}\n`,
  );
}

function makeTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'standards-matrix-'));
  const testFile = join(root, FAKE_TEST_FILE);
  mkdirSync(dirname(testFile), { recursive: true });
  writeFileSync(
    testFile,
    "import { describe, it, expect } from 'vitest';\ndescribe('fake', () => { it('works', () => expect(true).toBe(true)); });\n",
  );
  return root;
}

describe('validateRow', () => {
  it('accepts a valid implemented row with a real test reference', () => {
    const root = makeTempRoot();
    try {
      expect(validateRow(VALID_ROW, root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an implemented row with no test references', () => {
    const root = makeTempRoot();
    try {
      const errors = validateRow({ ...VALID_ROW, tests: [] }, root);
      expect(errors.some((e) => e.includes('MUST reference at least one test file'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('rejects an implemented row referencing a nonexistent test file', () => {
    const root = makeTempRoot();
    try {
      const errors = validateRow(
        { ...VALID_ROW, tests: ['packages/nope/src/__tests__/missing.test.ts'] },
        root,
      );
      expect(errors.some((e) => e.includes('does not exist'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an implemented row referencing a non-test file', () => {
    const root = makeTempRoot();
    try {
      const errors = validateRow(
        { ...VALID_ROW, tests: ['docs/standards/epub-conformance-matrix.json'] },
        root,
      );
      expect(errors.some((e) => e.includes('not a real test file'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects partial rows without a documented exception note', () => {
    const root = makeTempRoot();
    try {
      const errors = validateRow({ ...VALID_ROW, status: 'partial', tests: [], notes: '' }, root);
      expect(errors.some((e) => e.includes('documented exception note'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects unknown status values', () => {
    const root = makeTempRoot();
    try {
      const errors = validateRow({ ...VALID_ROW, status: 'supported' }, root);
      expect(errors.some((e) => e.includes('status must be one of'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('isRealTestFile', () => {
  it('recognizes a test file with declarations', () => {
    const root = makeTempRoot();
    try {
      expect(isRealTestFile(root, FAKE_TEST_FILE)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects missing files', () => {
    const root = makeTempRoot();
    try {
      expect(isRealTestFile(root, 'missing.test.ts')).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('validateMatrix (schema + evidence integrity)', () => {
  it('passes a fully valid matrix', () => {
    const root = makeTempRoot();
    try {
      writeMatrix(root, [
        VALID_ROW,
        {
          ...VALID_ROW,
          spec: 'epub-rs-34',
          clauseId: '2.2',
          status: 'partial',
          tests: [],
          notes: 'exception',
        },
      ]);
      const result = runValidator(root);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('✓');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when a supported row has no test evidence', () => {
    const root = makeTempRoot();
    try {
      writeMatrix(root, [{ ...VALID_ROW, tests: [] }]);
      const result = runValidator(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('MUST reference at least one test file');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when a partial row lacks an exception note', () => {
    const root = makeTempRoot();
    try {
      writeMatrix(root, [{ ...VALID_ROW, status: 'not-implemented', tests: [] }]);
      const result = runValidator(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('documented exception note');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails on duplicate (spec, clauseId) pairs', () => {
    const root = makeTempRoot();
    try {
      writeMatrix(root, [VALID_ROW, VALID_ROW]);
      const result = runValidator(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('duplicate');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when the stable baseline is not epub-33', () => {
    const root = makeTempRoot();
    try {
      writeMatrix(root, [VALID_ROW], {
        policy: { stableBaseline: 'epub-34', experimentalSpecs: [] },
      });
      const errors = validateMatrix(root);
      expect(errors.some((e) => e.includes('stableBaseline'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
