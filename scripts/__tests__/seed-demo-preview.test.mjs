import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  provisionPreviewDemo,
  selectPreviewTarget,
  parsePreviewOptions,
} from '../seed-demo-preview.mjs';
import { createPreviewOperations, bindLocalSql } from '../lib/demo-preview-transport.mjs';
import { createDemoEpub, SAMPLE_TEXT } from '../lib/demo-sample.mjs';
import { RESERVED } from '../seed-demo-accounts.mjs';

const workerRequire = createRequire(new URL('../../apps/worker/package.json', import.meta.url));
const { createClient } = workerRequire('@libsql/client');
const JSZip = workerRequire('jszip');
const clients = [];
const silent = { log: vi.fn(), error: vi.fn(), warn: vi.fn() };

function config() {
  return {
    d1_databases: [{ binding: 'DB', database_name: 'production', database_id: 'production-id' }],
    r2_buckets: [{ binding: 'BOOKS_BUCKET', bucket_name: 'production-books' }],
    env: {
      preview: {
        vars: {
          ENVIRONMENT: 'preview',
          DEMO_LOGIN_ENABLED: '1',
          DEMO_ACCOUNTS_PROD_ALLOWLIST: 'demo-preview',
        },
        d1_databases: [{ binding: 'DB', database_name: 'preview', database_id: 'preview-id' }],
        r2_buckets: [{ binding: 'BOOKS_BUCKET', bucket_name: 'preview-books' }],
      },
    },
  };
}

async function database() {
  const client = createClient({ url: 'file::memory:' });
  clients.push(client);
  const calls = [];
  const db = async (sql, args = []) => {
    calls.push({ sql, args });
    return client.execute({ sql, args });
  };
  const migrate = vi.fn(async () => {
    const directory = new URL('../../packages/schema/migrations/', import.meta.url);
    for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
      await client.executeMultiple(await readFile(new URL(file, directory), 'utf8'));
    }
  });
  return { client, calls, db, migrate, put: vi.fn() };
}

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
  vi.clearAllMocks();
});

describe('isolated preview provisioning', () => {
  it('requires exactly one explicit local or remote mode before configuration or I/O', () => {
    expect(() => parsePreviewOptions([])).toThrow(/exactly one/);
    expect(() => parsePreviewOptions(['--local', '--remote'])).toThrow(/exactly one/);
    expect(() => parsePreviewOptions(['--remote', '--persist-to', '/tmp/state'])).toThrow(
      /requires --local/,
    );
    expect(parsePreviewOptions(['--local']).local).toBe(true);
    expect(parsePreviewOptions(['--remote']).remote).toBe(true);
  });

  it('rejects missing preview configuration, production environments and shared resources before any I/O', async () => {
    const variants = [
      (raw) => delete raw.env.preview,
      (raw) => {
        raw.env.preview.vars.ENVIRONMENT = 'production';
      },
      (raw) => {
        raw.env.preview.vars.DEMO_ACCOUNTS_PROD_ALLOWLIST = '';
      },
      (raw) => {
        raw.env.preview.d1_databases[0].database_id = 'production-id';
      },
      (raw) => {
        raw.env.preview.d1_databases[0].database_name = 'production';
      },
      (raw) => {
        raw.env.preview.r2_buckets[0].bucket_name = 'production-books';
      },
      (raw) => delete raw.r2_buckets,
    ];
    for (const mutate of variants) {
      const rawConfig = config();
      mutate(rawConfig);
      const operations = { migrate: vi.fn(), db: vi.fn(), put: vi.fn() };
      await expect(provisionPreviewDemo({ rawConfig, operations })).rejects.toThrow();
      expect(operations.migrate).not.toHaveBeenCalled();
      expect(operations.db).not.toHaveBeenCalled();
      expect(operations.put).not.toHaveBeenCalled();
    }
  });

  it('rejects production environment overlays even when root resources are distinct', async () => {
    for (const production of [
      {
        d1_databases: [
          { binding: 'DB', database_id: 'preview-id', database_name: 'production-overlay' },
        ],
      },
      {
        d1_databases: [
          { binding: 'DB', database_id: 'production-overlay-id', database_name: 'preview' },
        ],
      },
      { r2_buckets: [{ binding: 'BOOKS_BUCKET', bucket_name: 'preview-books' }] },
    ]) {
      const rawConfig = config();
      rawConfig.env.production = production;
      const operations = { migrate: vi.fn(), db: vi.fn(), put: vi.fn() };
      await expect(provisionPreviewDemo({ rawConfig, operations })).rejects.toThrow(
        /distinct from production/,
      );
      expect(operations.migrate).not.toHaveBeenCalled();
      expect(operations.db).not.toHaveBeenCalled();
      expect(operations.put).not.toHaveBeenCalled();
    }
  });

  it('migrates a fresh database, seeds accounts and links an actual EPUB; reseeding is idempotent', async () => {
    const operations = await database();
    const run = () =>
      provisionPreviewDemo({
        rawConfig: config(),
        operations,
        hasPassword: async () => 'argon2id-test-hash',
        log: silent,
      });
    const first = await run();
    await operations.client.execute(
      "UPDATE book_access_grants SET expires_at = '2000-01-01T00:00:00Z', revoked_at = datetime('now')",
    );
    // Migrations are an operator step on each CLI run; emulate Wrangler's pending-only behavior.
    operations.migrate.mockImplementation(async () => {});
    const second = await run();
    expect(first.bookId).toBe(second.bookId);
    expect(first.sha256).toBe(second.sha256);
    const grants = await operations.client.execute(
      'SELECT expires_at, revoked_at FROM book_access_grants',
    );
    expect(grants.rows[0].expires_at).toBeNull();
    expect(grants.rows[0].revoked_at).toBeNull();
    const users = await operations.client.execute(
      'SELECT email, created_by_demo, disabled_at FROM users',
    );
    expect(users.rows).toHaveLength(2);
    expect(users.rows.every((user) => user.created_by_demo === 1)).toBe(true);
    expect(users.rows.find((user) => user.email === RESERVED.admin.email).disabled_at).toBeTruthy();
    const files = await operations.client.execute('SELECT * FROM book_files');
    expect(files.rows).toHaveLength(1);
    const [key, bytes] = operations.put.mock.calls[0];
    expect(files.rows[0].storage_key).toBe(key);
    expect(files.rows[0].file_size_bytes).toBe(bytes.length);
    expect(files.rows[0].sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    const archive = await JSZip.loadAsync(bytes);
    expect(await archive.file('mimetype').async('string')).toBe('application/epub+zip');
    expect(await archive.file('EPUB/start.xhtml').async('string')).toContain(SAMPLE_TEXT);
    expect(await archive.file('EPUB/next.xhtml').async('string')).toContain('Try annotations');
  });

  it('enables the preview administrator only on deliberate opt-in', async () => {
    const operations = await database();
    await provisionPreviewDemo({
      rawConfig: config(),
      operations,
      enableAdmin: true,
      hasPassword: async () => 'hash',
      log: silent,
    });
    const row = await operations.client.execute({
      sql: 'SELECT disabled_at FROM users WHERE email = ?',
      args: [RESERVED.admin.email],
    });
    expect(row.rows[0].disabled_at).toBeNull();
  });

  it('refuses a reserved non-demo user before account or content writes', async () => {
    const operations = await database();
    await operations.migrate();
    operations.migrate.mockImplementation(async () => {});
    await operations.client.execute({
      sql: 'INSERT INTO users (id,email) VALUES (?,?)',
      args: ['real', RESERVED.admin.email],
    });
    await expect(
      provisionPreviewDemo({ rawConfig: config(), operations, log: silent }),
    ).rejects.toThrow(/non-demo account/);
    expect(operations.calls.every(({ sql }) => sql.startsWith('SELECT'))).toBe(true);
    expect(operations.put).not.toHaveBeenCalled();
  });

  it('refuses an existing book not controlled by demo users before account or content writes', async () => {
    const operations = await database();
    await operations.migrate();
    operations.migrate.mockImplementation(async () => {});
    await operations.client.execute(
      "INSERT INTO books (id,slug,title) VALUES ('real','demo','Private manuscript')",
    );
    await expect(
      provisionPreviewDemo({ rawConfig: config(), operations, log: silent }),
    ).rejects.toThrow(/not owned/);
    expect(operations.calls.every(({ sql }) => sql.startsWith('SELECT'))).toBe(true);
    expect(operations.put).not.toHaveBeenCalled();
  });

  it('generates stable sample bytes instead of tracking a binary fixture', async () => {
    expect(await createDemoEpub()).toEqual(await createDemoEpub());
  });
});

describe('preview transport boundaries', () => {
  it('sends SQL and values separately through the remote D1 JSON API', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ success: true, result: [{ success: true, results: [{ id: 'demo' }] }] }),
    );
    const target = selectPreviewTarget(config());
    const operations = createPreviewOperations({
      target,
      configPath: '/config/wrangler.toml',
      fetcher,
      env: { CLOUDFLARE_ACCOUNT_ID: 'test-account', CLOUDFLARE_API_TOKEN: 'test-token' },
    });
    const params = ["a'); DROP TABLE users; --", 7, null];
    expect(await operations.db('SELECT ?, ?, ?', params)).toEqual({ rows: [{ id: 'demo' }] });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ sql: 'SELECT ?, ?, ?', params });
    expect(fetcher.mock.calls[0][0]).toContain('/database/preview-id/query');
  });

  it('preserves placeholder-like characters inside data and SQL literals in local mode', () => {
    const value = "demo' ? ; DROP TABLE users; --";
    expect(
      bindLocalSql("SELECT '?' AS literal, ? AS value, ? AS n, ? AS absent", [value, 3, null]),
    ).toBe(
      `SELECT '?' AS literal, CAST(X'${Buffer.from(value).toString('hex')}' AS TEXT) AS value, 3 AS n, NULL AS absent`,
    );
    expect(() => bindLocalSql('SELECT ?', [])).toThrow(/Missing/);
    expect(() => bindLocalSql('SELECT 1', ['extra'])).toThrow(/Extra/);
  });

  it('uses explicit local preview state and invokes Wrangler without a shell', async () => {
    const runFile = vi.fn(async () => ({
      stdout: JSON.stringify([{ success: true, results: [] }]),
    }));
    const operations = createPreviewOperations({
      target: selectPreviewTarget(config()),
      configPath: '/config/wrangler.toml',
      local: true,
      persistTo: '/tmp/demo state',
      runFile,
      env: {},
    });
    await operations.migrate();
    await operations.db('SELECT ?', ['$(untrusted)']);
    await operations.put('books/demo/sample.epub', Buffer.from('sample'));
    for (const [, args, options] of runFile.mock.calls) {
      expect(args).toEqual(
        expect.arrayContaining(['--env', 'preview', '--local', '--persist-to', '/tmp/demo state']),
      );
      expect(options.shell).toBeUndefined();
      expect(args).not.toContain('--remote');
    }
    expect(runFile.mock.calls[2][1]).toContain('preview-books/books/demo/sample.epub');
  });

  it('redacts child command output when a transport fails', async () => {
    const operations = createPreviewOperations({
      target: selectPreviewTarget(config()),
      configPath: '/config/wrangler.toml',
      local: true,
      runFile: async () => {
        throw new Error('sensitive-bound-password-hash');
      },
      env: {},
    });
    await expect(operations.migrate()).rejects.toThrow('Wrangler preview operation failed');
    await expect(operations.migrate()).rejects.not.toThrow('sensitive-bound-password-hash');
  });
});
