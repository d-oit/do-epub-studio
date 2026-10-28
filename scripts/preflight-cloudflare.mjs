#!/usr/bin/env node
/**
 * Fail-closed pre-deployment checks for Wrangler-declared Cloudflare resources.
 *
 * Checks production and preview D1, KV, and R2 bindings against Cloudflare's API.
 * It never creates, deletes, or changes account resources.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
const DEFAULT_CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url));
const API_ROOT = 'https://api.cloudflare.com/client/v4/accounts';

/** Extract resource bindings from the raw Wrangler configuration. */
export function extractResourceBindings(config) {
  return {
    production: {
      d1: config.d1_databases ?? [],
      kv: config.kv_namespaces ?? [],
      r2: config.r2_buckets ?? [],
    },
    preview: {
      d1: config.env?.preview?.d1_databases ?? [],
      kv: config.env?.preview?.kv_namespaces ?? [],
      r2: config.env?.preview?.r2_buckets ?? [],
    },
  };
}

/** Cloudflare API tokens and account IDs must be explicit; never guess an account. */
export function resolveCloudflareCredentials(env = process.env) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return null;
  return {
    token: env.CLOUDFLARE_API_TOKEN,
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
  };
}

function loadWranglerConfig(configPath) {
  const { experimental_readRawConfig } = require('wrangler');
  const { rawConfig } = experimental_readRawConfig({ config: configPath });
  if (!rawConfig) throw new Error(`Unable to read Wrangler configuration at ${configPath}`);
  return rawConfig;
}

function cloudflareError(data) {
  return data?.errors?.[0];
}

function resourceLabel(type, name, environment) {
  return `${type} '${name}' (${environment})`;
}

function invalidBinding(issues, type, binding, environment, field) {
  issues.push({
    type: `${type}_CONFIG_ERROR`,
    name: binding.binding ?? binding.database_name ?? binding.bucket_name ?? type,
    env: environment,
    code: 0,
    message: `${resourceLabel(type, binding.binding ?? binding.database_name ?? binding.bucket_name ?? 'binding', environment)} is missing required Wrangler field '${field}'.`,
    resolution: `Set '${field}' in the matching ${environment} binding in wrangler.toml.`,
  });
}

async function checkResource({
  type,
  name,
  environment,
  url,
  headers,
  accountId,
  fetchImpl,
  verified,
  issues,
  missingResolution,
}) {
  try {
    const response = await fetchImpl(url, { headers });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.success) {
      verified.push({ type, name, env: environment });
      return;
    }

    const error = cloudflareError(data);
    const code = error?.code ?? response.status;
    if (type === 'R2' && Number(error?.code) === 10042) {
      issues.push({
        type: 'R2_UNPROVISIONED',
        name,
        env: environment,
        code: 10042,
        message: `Cloudflare R2 is not enabled for account ${accountId}: ${error.message ?? 'Please enable R2 through the Cloudflare Dashboard.'}`,
        resolution: `An account owner must enable R2 at https://dash.cloudflare.com/${accountId}/r2/overview, then create the bucket with: pnpm exec wrangler r2 bucket create ${name}`,
      });
      return;
    }

    if (response.status === 404) {
      issues.push({
        type: `${type}_MISSING`,
        name,
        env: environment,
        code,
        message: `${resourceLabel(type, name, environment)} was not found in account ${accountId}.`,
        resolution: missingResolution,
      });
      return;
    }

    issues.push({
      type: `${type}_API_ERROR`,
      name,
      env: environment,
      code,
      message: `${resourceLabel(type, name, environment)} could not be verified: ${error?.message ?? `Cloudflare API returned HTTP ${response.status}.`}`,
      resolution: `Check CLOUDFLARE_API_TOKEN permissions for read access to ${type}, and verify CLOUDFLARE_ACCOUNT_ID (${accountId}).`,
    });
  } catch (error) {
    issues.push({
      type: `${type}_NETWORK_ERROR`,
      name,
      env: environment,
      code: 0,
      message: `Network error verifying ${resourceLabel(type, name, environment)}: ${error.message}`,
    });
  }
}

/** Check every declared D1, KV, and R2 resource against Cloudflare's API. */
export async function verifyCloudflareResources({
  accountId,
  token,
  bindings,
  fetchImpl = globalThis.fetch,
}) {
  const issues = [];
  const verified = [];
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const apiBase = `${API_ROOT}/${encodeURIComponent(accountId)}`;

  const resources = [
    ...bindings.production.d1.map((binding) => ({
      type: 'D1',
      binding,
      environment: 'production',
    })),
    ...bindings.preview.d1.map((binding) => ({ type: 'D1', binding, environment: 'preview' })),
    ...bindings.production.kv.map((binding) => ({
      type: 'KV',
      binding,
      environment: 'production',
    })),
    ...bindings.preview.kv.map((binding) => ({ type: 'KV', binding, environment: 'preview' })),
    ...bindings.production.r2.map((binding) => ({
      type: 'R2',
      binding,
      environment: 'production',
    })),
    ...bindings.preview.r2.map((binding) => ({ type: 'R2', binding, environment: 'preview' })),
  ];

  for (const { type, binding, environment } of resources) {
    if (type === 'D1') {
      if (!binding.database_id || !binding.database_name) {
        invalidBinding(
          issues,
          type,
          binding,
          environment,
          !binding.database_id ? 'database_id' : 'database_name',
        );
        continue;
      }
      await checkResource({
        type,
        name: binding.database_name,
        environment,
        url: `${apiBase}/d1/database/${encodeURIComponent(binding.database_id)}`,
        headers,
        accountId,
        fetchImpl,
        verified,
        issues,
        missingResolution: `Create the D1 database with 'pnpm exec wrangler d1 create ${binding.database_name}', then update database_id in wrangler.toml.`,
      });
      continue;
    }

    if (type === 'KV') {
      if (!binding.id || !binding.binding) {
        invalidBinding(issues, type, binding, environment, !binding.id ? 'id' : 'binding');
        continue;
      }
      await checkResource({
        type,
        name: binding.binding,
        environment,
        url: `${apiBase}/storage/kv/namespaces/${encodeURIComponent(binding.id)}`,
        headers,
        accountId,
        fetchImpl,
        verified,
        issues,
        missingResolution: `Create the KV namespace with 'pnpm exec wrangler kv namespace create ${binding.binding}', then update id in wrangler.toml.`,
      });
      continue;
    }

    if (!binding.bucket_name || !binding.binding) {
      invalidBinding(
        issues,
        type,
        binding,
        environment,
        !binding.bucket_name ? 'bucket_name' : 'binding',
      );
      continue;
    }
    await checkResource({
      type,
      name: binding.bucket_name,
      environment,
      url: `${apiBase}/r2/buckets/${encodeURIComponent(binding.bucket_name)}`,
      headers,
      accountId,
      fetchImpl,
      verified,
      issues,
      missingResolution: `Create the R2 bucket with 'pnpm exec wrangler r2 bucket create ${binding.bucket_name}'.`,
    });
  }

  return { ok: issues.length === 0, verified, issues };
}

/** Parse Wrangler config and run the mandatory remote resource check. */
export async function runPreflight({
  configPath = DEFAULT_CONFIG,
  env = process.env,
  log = console,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!existsSync(configPath)) {
    throw new Error(`Wrangler configuration file not found at: ${configPath}`);
  }

  const bindings = extractResourceBindings(loadWranglerConfig(resolve(configPath)));
  const credentials = resolveCloudflareCredentials(env);
  if (!credentials) {
    log.error(
      'Preflight failed: set both CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID; remote verification is required.',
    );
    return { ok: false, error: 'CREDENTIALS_MISSING', bindings };
  }

  log.log(`Checking Cloudflare resources for account ${credentials.accountId}...`);
  const result = await verifyCloudflareResources({
    accountId: credentials.accountId,
    token: credentials.token,
    bindings,
    fetchImpl,
  });

  if (result.ok) {
    log.log(`[PASS] All ${result.verified.length} Cloudflare resources verified.`);
    for (const resource of result.verified) {
      log.log(`  ✓ [${resource.type}] ${resource.name} (${resource.env})`);
    }
  } else {
    log.error(`[FAIL] Cloudflare resource verification failed (${result.issues.length} issues):`);
    for (const issue of result.issues) {
      log.error(`  ✖ [${issue.type}] ${issue.message}`);
      if (issue.resolution) log.error(`    Resolution: ${issue.resolution}`);
    }
  }
  return result;
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string', default: DEFAULT_CONFIG },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(`Cloudflare Resource Preflight Validator

Usage:
  pnpm preflight:cloudflare [--config <path>]

Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Verification is always remote and fails closed.
`);
    return;
  }

  const result = await runPreflight({ configPath: resolve(values.config) });
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Preflight execution error: ${error.message}`);
    process.exitCode = 1;
  });
}
