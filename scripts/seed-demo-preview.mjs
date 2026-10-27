#!/usr/bin/env node
// ADR-1014: deliberate preview D1/R2 provisioning; never run as a deployment hook.
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { seedDemoAccounts } from './seed-demo-accounts.mjs';
import { createPreviewOperations } from './lib/demo-preview-transport.mjs';
import { createDemoEpub } from './lib/demo-sample.mjs';

const require = createRequire(import.meta.url);
const DEFAULT_CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url));

/** Select explicit, non-inherited preview resources and reject production aliases. */
export function selectPreviewTarget(raw) {
  const preview = raw.env?.preview;
  if (preview?.vars?.ENVIRONMENT !== 'preview' || !preview.vars.DEMO_ACCOUNTS_PROD_ALLOWLIST) {
    throw new Error('Preview must declare ENVIRONMENT=preview and a demo allowlist.');
  }
  if (preview.vars.DEMO_LOGIN_ENABLED !== '1')
    throw new Error('Preview demo login must be enabled.');
  const production = raw.d1_databases?.find((entry) => entry.binding === 'DB');
  const productionDatabases = [
    ...(raw.d1_databases ?? []),
    ...(raw.env?.production?.d1_databases ?? []),
  ];
  const database = preview.d1_databases?.find((entry) => entry.binding === 'DB');
  const productionBucket = raw.r2_buckets?.find((entry) => entry.binding === 'BOOKS_BUCKET');
  const productionBuckets = [...(raw.r2_buckets ?? []), ...(raw.env?.production?.r2_buckets ?? [])];
  const bucket = preview.r2_buckets?.find((entry) => entry.binding === 'BOOKS_BUCKET');
  if (
    !production?.database_id ||
    !production.database_name ||
    !database?.database_id ||
    !database.database_name ||
    productionDatabases.some(
      (entry) =>
        database.database_id === entry.database_id ||
        database.database_name === entry.database_name,
    )
  )
    throw new Error('Preview DB must be explicitly configured and distinct from production.');
  if (
    !productionBucket?.bucket_name ||
    !bucket?.bucket_name ||
    productionBuckets.some((entry) => bucket.bucket_name === entry.bucket_name)
  ) {
    throw new Error(
      'Preview BOOKS_BUCKET must be explicitly configured and distinct from production.',
    );
  }
  return {
    databaseId: database.database_id,
    databaseName: database.database_name,
    bucket: bucket.bucket_name,
    vars: preview.vars,
  };
}

export async function provisionPreviewDemo({
  rawConfig,
  operations,
  enableAdmin = false,
  hasPassword,
  seedEnv = process.env,
  log = console,
}) {
  const target = selectPreviewTarget(rawConfig);
  // Isolation is checked before even migrations can write to the target database.
  await operations.migrate();
  const result = await seedDemoAccounts({
    db: operations.db,
    hasPassword,
    log,
    env: {
      ...target.vars,
      DEMO_ACCOUNTS_ENABLED: '1',
      DEMO_ADMIN_ENABLED: enableAdmin ? '1' : '0',
      DEMO_ADMIN_PASSWORD: seedEnv.DEMO_ADMIN_PASSWORD,
      DEMO_READER_PASSWORD: seedEnv.DEMO_READER_PASSWORD,
    },
  });
  if (!result.ok || !result.bookId) throw new Error('Demo accounts and book were not provisioned.');

  const bytes = await createDemoEpub();
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const storageKey = `books/${result.bookId}/demo-sample-${sha256}.epub`;
  await operations.put(storageKey, bytes);
  await operations.db(
    `INSERT INTO book_files (id, book_id, storage_provider, storage_key, original_filename, mime_type, file_size_bytes, sha256, epub_version)
     SELECT ?, ?, 'r2', ?, 'demo.epub', 'application/epub+zip', ?, ?, '3.0'
     WHERE NOT EXISTS (SELECT 1 FROM book_files WHERE book_id = ? AND storage_key = ?)`,
    [
      `demo-sample-${result.bookId}-${sha256}`,
      result.bookId,
      storageKey,
      bytes.length,
      sha256,
      result.bookId,
      storageKey,
    ],
  );
  log.log(
    `Preview demo ready; administrator ${enableAdmin ? 'enabled explicitly' : 'disabled by default'}.`,
  );
  return { ...result, storageKey, sha256, fileSizeBytes: bytes.length };
}

export function parsePreviewOptions(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'enable-admin': { type: 'boolean', default: false },
      local: { type: 'boolean', default: false },
      remote: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
      'persist-to': { type: 'string' },
      config: { type: 'string', default: DEFAULT_CONFIG },
    },
  });
  if (values.help) return values;
  if (values.local === values.remote) throw new Error('Choose exactly one of --local or --remote.');
  if (values['persist-to'] && !values.local) throw new Error('--persist-to requires --local.');
  return values;
}

export async function main(argv = process.argv.slice(2)) {
  const values = parsePreviewOptions(argv);
  if (values.help) {
    console.log(
      'Usage: node scripts/seed-demo-preview.mjs (--local | --remote) [--enable-admin] [--persist-to DIRECTORY] [--config FILE]',
    );
    return;
  }
  const configPath = resolve(values.config);
  const { experimental_readRawConfig } = require('wrangler');
  const { rawConfig } = experimental_readRawConfig({ config: configPath });
  const target = selectPreviewTarget(rawConfig);
  const operations = createPreviewOperations({
    target,
    configPath,
    local: values.local,
    persistTo: values['persist-to'],
  });
  return provisionPreviewDemo({ rawConfig, operations, enableAdmin: values['enable-admin'] });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    // Boundaries may throw errors containing credentials; never echo arbitrary errors.
    console.error(
      'Preview demo provisioning failed. Choose --local or --remote explicitly; verify isolated preview configuration, credentials and resource access. Use --help for usage.',
    );
    process.exitCode = 1;
  });
}
