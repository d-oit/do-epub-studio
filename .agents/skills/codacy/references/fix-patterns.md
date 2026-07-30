## Fix, Don't Suppress — Patterns

Codacy findings are usually genuine. Suppression is the last resort and
must be justified inline. The repo's standard for the rules Codacy
flags most often:

### `security/detect-non-literal-fs-filename`

The rule (from `eslint-plugin-security`) blocks `fs.*` calls whose first
argument could carry untrusted runtime data — i.e. the OWASP path
traversal pattern. The intent is to prevent an attacker from
controlling which file Node reads.

It is a false alarm when:

- The path is a literal relative to the config / source file (no
  `process.env`, no user input, no `req`/`args`).
- The path is constructed by `path.join(__dirname, '<literal>')`.
- The path is `import.meta.url`-derived and joined with a literal.

**Fix pattern A (preferred for Vite/webpack/rollup configs): use a
static import.**

```ts
// Vite config — works because Vite bundles the config with its own
// loader. JSON and `?raw` imports are resolved at config-load time.
import appIdentity from './src/config/app-identity.json';
import versionText from './src/config/app-identity.json?raw'; // not a thing
```

For the raw text case (e.g. `VERSION`), use the `?raw` suffix in the
companion TS module — but **not** in `vite.config.ts` itself, since
the config bundle is loaded by Node and `?raw` is a Vite-only
transform.

```ts
// src/config/app-identity.ts (Vite-bundled source — ?raw works here)
import versionText from '../../../../VERSION?raw';
import metadata from './app-identity.json';
export const APP_VERSION = versionText.trim();
```

```ts
// vite.config.ts (Node-loaded — ?raw does NOT work here)
import { readFileSync } from 'node:fs';
import path from 'path';
import appIdentity from './src/config/app-identity.json';

// Resolve relative to the config file's own location; path is a
// literal joined with a known directory.
const appVersion = readFileSync(
  path.resolve(__dirname, '../../VERSION'),
  'utf8',
).trim();
```

If the rule still flags it (it may, on Codacy's older ESLint 8), add
an inline `eslint-disable-next-line` with a justification. AGENTS.md
Tier 3 mandates: "If a lint rule is disabled, add inline comment
explaining why."

```ts
// eslint-disable-next-line security/detect-non-literal-fs-filename
//   Path is a literal relative to this config file; no untrusted input
const appVersion = readFileSync(
  path.resolve(__dirname, '../../VERSION'),
  'utf8',
).trim();
```

**Never use `new URL('./file', import.meta.url)`** in a Vite config —
it both flags the rule (the URL is not a literal to the linter) and
bypasses the cleaner static-import pattern.

**Fix pattern B (general Node): use `path.join` with a literal base.**

```ts
// BAD — flagged
const dir = process.env.MY_DIR;
readFileSync(`${dir}/data.json`);

// GOOD — literal base, joined with a literal
const dir = path.join(__dirname, 'data');
readFileSync(path.join(dir, 'config.json'));
```

**Fix pattern C (Node ≥ 20.11 / 22+): use `import.meta.dirname`.**
Same caveat as `__dirname` — Codacy's ESLint 8 may still flag it
because `import.meta.dirname` is not in the rule's static set; add a
targeted disable with a justification.

### `Biome_lint_correctness_useQwikValidLexicalScope`

Codacy's Biome engine flags top-level arrow functions in test files
with "Non-serializable expression must be wrapped with $(...)".
This is a SolidJS-specific rule (`useQwikValidLexicalScope`) that
fires incorrectly on React/JS code.

**Trigger pattern** — any `const fn = (...) => ...` at module scope in
test files:

```ts
// BAD — Codacy Biome flags this (resultDataId varies)
const t = (key: string) => key;
const onNavigate = vi.fn();
const mockHandler = (x: number) => x * 2;
```

**Fix: wrap in `vi.fn()`** — makes it a spiable mock AND avoids the
Biome flag:

```ts
// GOOD — not flagged, and spiable in assertions
const t = vi.fn((key: string) => key);
const onNavigate = vi.fn();
const mockHandler = vi.fn((x: number) => x * 2);
```

**Why `vi.fn()` and not `useCallback`**: Test files are not React
components — `useCallback` doesn't apply. `vi.fn()` is the idiomatic
Vitest pattern for standalone test helpers. If the function doesn't
need spying, `vi.fn(impl)` still works as a passthrough.

**Alternative**: Move the function inside a `describe()` block or
`beforeEach()` — Biome only flags module-level declarations.

### `ESLint8_security_detect-object-injection` (test translation mocks)

Codacy's ESLint security plugin flags `obj[key]` as a "Generic Object
Injection Sink" even when `key` is a string literal from a hardcoded
test mock.

**Trigger pattern** — the common `useTranslation` mock in test files:

```ts
// BAD — Codacy flags translations[key]
const translations: Record<string, string> = { 'key': 'value' };
return Object.hasOwn(translations, key) ? translations[key] : key;
```

**Fix A (preferred): use a Map — avoids both ESLint `detect-object-injection`
and Biome `useQwikValidLexicalScope` with no suppressions needed.**

```ts
const translations = new Map<string, string>([['key', 'value']]);
return translations.get(key) ?? key;
```

Combine with `vi.fn()` wrapper on the `t` function to also avoid the
Biome rule on module-scope arrow functions:

```ts
t: vi.fn((key: string) => {
  const translations = new Map<string, string>([['key', 'value']]);
  return translations.get(key) ?? key;
}),
```

**Fix B: inline disable with justification (when Map is impractical).**

```ts
// eslint-disable-next-line security/detect-object-injection
//   False positive: key is a string literal from hardcoded test mock
return Object.hasOwn(translations, key) ? translations[key] : key;
```

Fix A is preferred because it produces zero local lint warnings and zero
Codacy findings. Fix B silences Codacy but triggers local "unused
disable directive" warnings (the rule only exists in Codacy's ESLint 8).
