import fs from 'node:fs';
import path from 'node:path';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function measureRoutes(distDir, fileSizes, gzipSizes, routeBudgets) {
  const errors = [];
  if (!isRecord(routeBudgets) || Object.keys(routeBudgets).length === 0) {
    return { routes: [], errors: ['.performance-budgets.json has no configured route budgets'] };
  }

  const manifestPath = [
    path.join(distDir, '.vite', 'manifest.json'),
    path.join(distDir, 'manifest.json'),
  ].find((file) => fs.existsSync(file));
  if (!manifestPath) {
    return { routes: [], errors: [`Vite manifest not found under ${distDir}`] };
  }

  let manifestData;
  try {
    manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return {
      routes: [],
      errors: [`Vite manifest ${manifestPath} is unreadable/invalid: ${error.message}`],
    };
  }
  if (!isRecord(manifestData) || Object.keys(manifestData).length === 0) {
    return {
      routes: [],
      errors: [`Vite manifest ${manifestPath} must contain build entries`],
    };
  }

  const manifest = new Map(Object.entries(manifestData));
  const resolveEntry = (routeName, src) => {
    if (manifest.has(src)) return manifest.get(src);
    for (const chunk of manifest.values()) {
      if (isRecord(chunk) && (chunk.src === src || chunk.name === `${routeName}-route`)) {
        return chunk;
      }
    }
    return null;
  };

  const collectTransitive = (routeName, entry) => {
    const ids = new Set();
    const visited = new Set();
    const queue = [entry];
    let queueIndex = 0;
    while (queueIndex < queue.length) {
      const chunk = queue[queueIndex++];
      if (!isRecord(chunk)) {
        errors.push(`route "${routeName}": manifest contains an invalid chunk`);
        continue;
      }
      if (typeof chunk.file !== 'string' || chunk.file.length === 0) {
        errors.push(`route "${routeName}": manifest chunk has no output file`);
        continue;
      }
      const file = chunk.file;
      if (visited.has(file)) continue;
      visited.add(file);
      ids.add(file);
      if (!fileSizes.has(file)) {
        errors.push(`route "${routeName}": manifest output "${file}" is missing from dist`);
      }

      if (chunk.css !== undefined && !Array.isArray(chunk.css)) {
        errors.push(`route "${routeName}": manifest CSS list for "${file}" is invalid`);
      } else {
        for (const cssFile of chunk.css || []) {
          if (typeof cssFile !== 'string' || cssFile.length === 0) {
            errors.push(`route "${routeName}": manifest CSS reference for "${file}" is invalid`);
          } else {
            ids.add(cssFile);
            if (!fileSizes.has(cssFile)) {
              errors.push(`route "${routeName}": referenced CSS "${cssFile}" is missing from dist`);
            }
          }
        }
      }

      if (chunk.imports !== undefined && !Array.isArray(chunk.imports)) {
        errors.push(`route "${routeName}": manifest imports for "${file}" are invalid`);
      } else {
        for (const importId of chunk.imports || []) {
          if (typeof importId !== 'string' || !manifest.has(importId)) {
            errors.push(
              `route "${routeName}": manifest import "${String(importId)}" is unresolved`,
            );
          } else {
            queue.push(manifest.get(importId));
          }
        }
      }
    }
    return ids;
  };

  const routes = [];
  for (const [routeName, config] of Object.entries(routeBudgets)) {
    if (!isRecord(config) || typeof config.entry !== 'string' || config.entry.length === 0) {
      errors.push(`route "${routeName}" has no configured entry source`);
      continue;
    }
    if (!Number.isSafeInteger(config.maxSize) || config.maxSize <= 0) {
      errors.push(`route "${routeName}" has no positive integer maxSize in bytes`);
      continue;
    }

    const entry = resolveEntry(routeName, config.entry);
    if (!isRecord(entry) || typeof entry.file !== 'string' || entry.file.length === 0) {
      errors.push(`route "${routeName}": entry "${config.entry}" not found in Vite manifest`);
      continue;
    }
    if (!fileSizes.has(entry.file) || !gzipSizes.has(entry.file)) {
      errors.push(`route "${routeName}": entry artifact "${entry.file}" is missing from dist`);
      continue;
    }

    let totalBytes = 0;
    let totalGzip = 0;
    for (const file of collectTransitive(routeName, entry)) {
      if (!fileSizes.has(file) || !gzipSizes.has(file)) continue;
      totalBytes += fileSizes.get(file);
      totalGzip += gzipSizes.get(file);
    }
    routes.push({
      route: routeName,
      entry: entry.file,
      entryGzip: gzipSizes.get(entry.file),
      totalBytes,
      totalGzip,
      maxSize: config.maxSize,
    });
  }
  return { routes, errors: [...new Set(errors)] };
}

export function checkRouteBudgets(routes) {
  const sections = routes.map((route) => ({
    ...route,
    absoluteFail: route.totalBytes > route.maxSize,
    passed: route.totalBytes <= route.maxSize,
  }));
  return {
    sections,
    violations: sections.filter((route) => route.absoluteFail),
  };
}

export function checkBaselineDelta(routes, baseline, routeBudgets) {
  const errors = [];
  if (!isRecord(routeBudgets) || Object.keys(routeBudgets).length === 0) {
    return {
      sections: [],
      violations: [],
      errors: ['.performance-budgets.json has no configured route budgets'],
    };
  }

  const configuredRoutes = Object.keys(routeBudgets).sort();
  const baselineRoutes = Object.keys(baseline.routes).sort();
  for (const route of configuredRoutes) {
    if (!Object.hasOwn(baseline.routes, route)) {
      errors.push(`baseline route "${route}" is missing`);
    }
  }
  for (const route of baselineRoutes) {
    if (!Object.hasOwn(routeBudgets, route)) {
      errors.push(`baseline route "${route}" is no longer configured`);
    }
  }

  const currentByRoute = new Map(routes.map((route) => [route.route, route]));
  const sections = [];
  const violations = [];
  for (const routeName of configuredRoutes) {
    const current = currentByRoute.get(routeName);
    const record = baseline.routes[routeName];
    if (!current || !record) continue;
    const entryDelta = current.entryGzip - record.gzip;
    const totalDelta = current.totalGzip - record.totalTransitive.gzip;
    const totalPct =
      ((current.totalGzip - record.totalTransitive.gzip) / record.totalTransitive.gzip) * 100;
    const entryFail = entryDelta > 10 * 1024;
    const totalFail = totalPct > 3;
    const passed = !entryFail && !totalFail;
    if (!passed) {
      violations.push({ route: routeName, entryDelta, totalDelta, totalPct, entryFail, totalFail });
    }
    sections.push({
      route: routeName,
      entryDelta,
      totalDelta,
      totalPct,
      entryFail,
      totalFail,
      passed,
    });
  }
  return { sections, violations, errors: [...new Set(errors)] };
}
