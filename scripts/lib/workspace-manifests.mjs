#!/usr/bin/env node
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function lstatIfExists(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

// Mirrors pnpm-workspace.yaml: the root manifest plus immediate apps/packages workspaces.

export function listWorkspaceManifestPaths(repoRoot) {
  const root = resolve(repoRoot);
  const rootManifest = join(root, 'package.json');

  let rootPackage;
  try {
    if (!lstatIfExists(rootManifest)?.isFile()) {
      throw new TypeError('manifest must be a regular file');
    }
    rootPackage = JSON.parse(readFileSync(rootManifest, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read root package manifest ${rootManifest}: ${error.message}`);
  }
  if (!rootPackage || typeof rootPackage !== 'object' || Array.isArray(rootPackage)) {
    throw new Error(`Root package manifest ${rootManifest} must contain a JSON object`);
  }

  const workspaceManifests = [];
  for (const top of ['apps', 'packages']) {
    const directory = join(root, top);
    const directoryInfo = lstatIfExists(directory);
    if (!directoryInfo) continue;
    if (!directoryInfo.isDirectory()) {
      throw new Error(`Workspace directory ${directory} must be a real directory`);
    }

    const entries = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const entry of entries) {
      const workspace = join(directory, entry);
      if (lstatIfExists(join(workspace, '.git'))) continue;
      if (entry === 'node_modules') continue;

      const manifest = join(workspace, 'package.json');
      const manifestInfo = lstatIfExists(manifest);
      if (!manifestInfo) continue;
      if (!manifestInfo.isFile()) {
        throw new Error(`Workspace package manifest ${manifest} must be a regular file`);
      }
      workspaceManifests.push(`./${top}/${entry}/package.json`);
    }
  }

  return ['./package.json', ...workspaceManifests.sort()];
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 3) throw new Error('Usage: workspace-manifests.mjs [repo-root]');
    const root = process.argv[2] ?? process.cwd();
    process.stdout.write(`${listWorkspaceManifestPaths(root).join('\n')}\n`);
  } catch (error) {
    console.error(`workspace manifest enumeration failed: ${error.message}`);
    process.exitCode = 1;
  }
}
