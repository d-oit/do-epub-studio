'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const madge = require('madge');

const projectRoot = path.resolve(process.env.MADGE_PROJECT_ROOT || path.join(__dirname, '..'));
const sourceExtensions = ['.ts', '.tsx'];
const moduleExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const pwaRegister = path.join(
  projectRoot,
  'apps/web/node_modules/vite-plugin-pwa/dist/client/build/register.js',
);
const workerConfiguration = path.join(projectRoot, 'apps/worker/src/worker-configuration.d.ts');

// Register on the same filing-cabinet instance Madge's dependency-tree uses.
const madgeRequire = createRequire(require.resolve('madge'));
const dependencyTreeRequire = createRequire(madgeRequire.resolve('dependency-tree'));
const filingCabinet = dependencyTreeRequire('filing-cabinet');
const originalResolvers = Object.fromEntries(
  sourceExtensions.map((extension) => [extension, filingCabinet.getLookup(extension)]),
);

function resolveFile(baseDirectory, moduleName) {
  const target = path.resolve(baseDirectory, moduleName);
  const candidates = [
    target,
    ...moduleExtensions.map((extension) => `${target}${extension}`),
    ...moduleExtensions.map((extension) => path.join(target, `index${extension}`)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function resolveViteOrPlatformImport({ dependency, filename }) {
  if (dependency === 'virtual:pwa-register') {
    return fs.existsSync(pwaRegister) ? pwaRegister : '';
  }

  if (dependency === 'cloudflare:workers') {
    return fs.existsSync(workerConfiguration) ? workerConfiguration : '';
  }

  if (dependency.endsWith('?raw')) {
    const rawFile = path.resolve(path.dirname(filename), dependency.slice(0, -4));
    if (fs.existsSync(rawFile)) return rawFile;
  }

  if (dependency.startsWith('@/')) {
    return resolveFile(path.join(projectRoot, 'apps/web/src'), dependency.slice(2));
  }

  try {
    return require.resolve(dependency, { paths: [path.dirname(filename)] });
  } catch {
    return '';
  }
}

for (const extension of sourceExtensions) {
  const originalResolver = originalResolvers[extension];
  if (!originalResolver) throw new Error(`Madge has no resolver for ${extension}`);

  filingCabinet.register(extension, (options) => {
    return originalResolver(options) || resolveViteOrPlatformImport(options);
  });
}

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(filePath);
    if (
      entry.isFile() &&
      sourceExtensions.includes(path.extname(entry.name)) &&
      !entry.name.endsWith('.d.ts')
    ) {
      return [filePath];
    }
    return [];
  });
}

async function main() {
  const defaultRoots = [
    'apps/web/src',
    'apps/worker/src',
    'packages/shared/src',
    'packages/schema/src',
    'packages/reader-core/src',
    'packages/ui/src',
    'packages/testkit/src',
  ];
  const sourceRoots = process.argv.slice(2).length ? process.argv.slice(2) : defaultRoots;
  const sourceFiles = sourceRoots.flatMap((sourceRoot) =>
    collectSourceFiles(path.resolve(projectRoot, sourceRoot)),
  );
  const graph = await madge(sourceFiles, {
    baseDir: projectRoot,
    fileExtensions: sourceExtensions.map((extension) => extension.slice(1)),
    // CSS, declarations, and other assets are not runtime code edges in this check.
    dependencyFilter: (dependencyPath) =>
      codeExtensions.has(path.extname(dependencyPath)) && !dependencyPath.endsWith('.d.ts'),
  });

  console.log(`Processed ${Object.keys(graph.obj()).length} files`);

  const skipped = graph.warnings().skipped;
  if (skipped.length > 0) {
    console.error(`Skipped ${skipped.length} unresolved imports:`);
    for (const dependency of skipped) console.error(dependency);
  }

  const cycles = graph.circular();
  for (const [index, cycle] of cycles.entries()) {
    console.log(`${index + 1}) ${cycle.join(' > ')}`);
  }
  console.log(
    cycles.length > 0
      ? `Found ${cycles.length} circular dependencies`
      : 'No circular dependency found!',
  );

  if (skipped.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`Madge circular check failed: ${error.stack || error}`);
  process.exitCode = 1;
});
