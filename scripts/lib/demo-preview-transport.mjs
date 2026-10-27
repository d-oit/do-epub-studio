// ADR-1014: external I/O for the explicit preview seed; no shell interpolation.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const executeFile = promisify(execFile);

async function withTemporaryFile(name, bytes, action) {
  const directory = await mkdtemp(join(tmpdir(), 'epub-demo-'));
  try {
    const file = join(directory, name);
    await writeFile(file, bytes, { mode: 0o600 });
    return await action(file);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** SQL literals are used only by Wrangler's local CLI, which has no params API. */
export function bindLocalSql(sql, params = []) {
  let index = 0;
  // All statements are repository-owned; callers cannot supply SQL templates.
  const statement = sql.replace(/'(''|[^'])*'|\?/g, (token) => {
    if (token !== '?') return token;
    if (index >= params.length) throw new Error('Missing SQL parameter');
    const value = params[index++];
    if (value === null) return 'NULL';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value !== 'string') throw new Error('Unsupported SQL parameter');
    return `CAST(X'${Buffer.from(value).toString('hex')}' AS TEXT)`;
  });
  if (index !== params.length) throw new Error('Extra SQL parameter');
  return statement;
}

export function createPreviewOperations({
  target,
  configPath,
  local = false,
  persistTo,
  env = process.env,
  runFile = executeFile,
  fetcher = fetch,
}) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!local && (!accountId || !apiToken)) {
    throw new Error('Remote seeding requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.');
  }
  const wrangler = join(
    dirname(require.resolve('wrangler/package.json')),
    require('wrangler/package.json').bin.wrangler,
  );
  const common = ['--config', configPath, '--env', 'preview'];
  const mode = local
    ? ['--local', ...(persistTo ? ['--persist-to', persistTo] : [])]
    : ['--remote'];
  const run = async (args) => {
    try {
      return await runFile(process.execPath, [wrangler, ...args], {
        env: { ...env, WRANGLER_SEND_METRICS: 'false' },
        maxBuffer: 4 * 1024 * 1024,
      });
    } catch {
      // execFile errors include command arguments/output; keep SQL hashes and tokens private.
      throw new Error(
        'Wrangler preview operation failed; check resource access and migration state.',
      );
    }
  };
  return {
    migrate: () => run(['d1', 'migrations', 'apply', 'DB', ...common, ...mode]),
    db: async (sql, params = []) => {
      if (local) {
        // Keep bound password hashes out of process arguments and Wrangler argv logs.
        const { stdout } = await withTemporaryFile('query.sql', bindLocalSql(sql, params), (file) =>
          run(['d1', 'execute', 'DB', ...common, ...mode, '--json', '--file', file]),
        );
        const results = JSON.parse(stdout);
        if (!results[0]?.success) throw new Error('Local preview database query failed.');
        return { rows: results[0].results ?? [] };
      }
      const response = await fetcher(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(target.databaseId)}/query`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, params }),
        },
      );
      const body = await response.json();
      if (!response.ok || !body.success || !body.result?.[0]?.success) {
        throw new Error('Remote preview database query failed; check D1 access and schema.');
      }
      return { rows: body.result[0].results ?? [] };
    },
    put: async (key, bytes) => {
      await withTemporaryFile('demo.epub', bytes, (file) =>
        run([
          'r2',
          'object',
          'put',
          `${target.bucket}/${key}`,
          ...common,
          ...mode,
          '--file',
          file,
          '--content-type',
          'application/epub+zip',
        ]),
      );
    },
  };
}
