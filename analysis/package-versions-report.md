# Package Versions Analysis Report

**Generated:** 2025-09-25  
**Project:** do-epub-studio (Monorepo with pnpm workspaces)  
**Package Manager:** pnpm@10.33.0

---

## Executive Summary

| Category | Count |
|----------|-------|
| Total Outdated Packages | 12 |
| Security Vulnerabilities | 10 (2 low, 2 moderate, 6 high) |
| Critical Security Updates | 6 |
| Routine Updates | 12 |

---

## 1. Current Package Versions

### Root Package (package.json)

| Package | Current Version | Type |
|---------|-----------------|------|
| pnpm | 10.33.0 | Package Manager |
| turbo | 2.9.6 | DevDependency |
| typescript | ^6.0.2 | DevDependency |
| eslint | ^9.0.0 | DevDependency |
| @eslint/js | ^9.0.0 | DevDependency |
| vitest | 4.1.4 | DevDependency |
| @vitest/coverage-v8 | 4.1.4 | DevDependency |
| prettier | ^3.4.2 | DevDependency |
| @playwright/test | ^1.59.1 | DevDependency |
| @axe-core/playwright | ^4.11.1 | DevDependency |
| @lhci/cli | ^0.15.1 | DevDependency |
| eslint-config-prettier | ^10.1.8 | DevDependency |
| eslint-plugin-react | ^7.34.1 | DevDependency |
| eslint-plugin-react-hooks | ^7.0.1 | DevDependency |
| eslint-plugin-import | ^2.29.1 | DevDependency |
| eslint-import-resolver-typescript | ^4.4.4 | DevDependency |
| eslint-plugin-promise | ^7.1.0 | DevDependency |
| eslint-plugin-security | ^3.0.1 | DevDependency |
| eslint-plugin-unicorn | ^64.0.0 | DevDependency |
| globals | ^15.0.0 | DevDependency |
| jsdom | ^29.0.2 | DevDependency |
| rollup-plugin-visualizer | ^7.0.1 | DevDependency |
| typescript-eslint | ^8.24.1 | DevDependency |
| @types/node | ^25 | DevDependency |

### apps/web/package.json

| Package | Current Version | Type |
|---------|-----------------|------|
| react | ^18 | Dependency |
| react-dom | ^18 | Dependency |
| react-router-dom | ^6 | Dependency |
| zod | ^3.25.76 | Dependency |
| zustand | ^5 | Dependency |
| framer-motion | ^12 | Dependency |
| epubjs | ^0.3.93 | Dependency |
| idb | ^8.0.3 | Dependency |
| uuid | ^14.0.0 | Dependency |
| workbox-precaching | ^7.4.0 | Dependency |
| workbox-routing | ^7.4.0 | Dependency |
| workbox-strategies | ^7.4.0 | Dependency |
| workbox-cacheable-response | ^7.4.0 | Dependency |
| workbox-expiration | ^7.4.0 | Dependency |
| vite | 8.0.9 | DevDependency |
| @vitejs/plugin-react | ^4 | DevDependency |
| tailwindcss | ^4.2.2 | DevDependency |
| @tailwindcss/vite | ^4.2.2 | DevDependency |
| postcss | ^8 | DevDependency |
| autoprefixer | ^10 | DevDependency |
| vitest | 4.1.4 | DevDependency |
| @vitest/coverage-v8 | 4.1.4 | DevDependency |
| @testing-library/react | ^16.3.2 | DevDependency |
| @testing-library/jest-dom | ^6.9.1 | DevDependency |
| @testing-library/user-event | ^14.6.1 | DevDependency |
| playwright | ^1.59.1 | DevDependency |
| vite-plugin-pwa | ^1.2.0 | DevDependency |
| fake-indexeddb | ^6.2.5 | DevDependency |
| cross-env | ^10.1.0 | DevDependency |

### apps/worker/package.json

| Package | Current Version | Type |
|---------|-----------------|------|
| @do-epub-studio/schema | workspace:* | Dependency |
| @do-epub-studio/shared | workspace:* | Dependency |
| @libsql/client | ^0.17.3 | Dependency |
| argon2-wasm-edge | ^1.0.23 | Dependency |
| zod | ^3.25.76 | Dependency |
| wrangler | ^4.86.0 | DevDependency |
| @cloudflare/workers-types | ^4.20250415.0 | DevDependency |
| vitest | 4.1.4 | DevDependency |

### packages/reader-core/package.json

| Package | Current Version | Type |
|---------|-----------------|------|
| epubjs | ^0.3.93 | Dependency |
| vitest | 4.1.4 | DevDependency |

### packages/schema/package.json

| Package | Current Version | Type |
|---------|-----------------|------|
| (no production deps) | - | - |

### packages/shared/package.json

| Package | Current Version | Type |
|---------|-----------------|------|
| zod | ^3.25.76 | Dependency |
| vitest | 4.1.4 | DevDependency |

### packages/testkit/package.json

| Package | Current Version | Type |
|---------|-----------------|------|
| (no production deps) | - | - |

### packages/ui/package.json

| Package | Current Version | Type |
|---------|-----------------|------|
| react | ^18 | PeerDependency |
| react-dom | ^18 | PeerDependency |

---

## 2. Outdated Packages

### Critical Priority (Should Update Soon)

| Package | Current | Latest | Location | Priority |
|---------|---------|--------|----------|----------|
| eslint | 9.39.4 | 10.2.1 | Root | HIGH |
| @eslint/js | 9.39.4 | 10.0.1 | Root | HIGH |
| eslint-plugin-security | 3.0.1 | 4.0.0 | Root | HIGH |
| globals | 15.15.0 | 17.5.0 | Root | HIGH |

### Medium Priority (Routine Updates)

| Package | Current | Latest | Location | Priority |
|---------|---------|--------|----------|----------|
| typescript | 6.0.2 | 6.0.3 | All packages | MEDIUM |
| vitest | 4.1.4 | 4.1.5 | Root, web, worker, reader-core, shared | MEDIUM |
| @vitest/coverage-v8 | 4.1.4 | 4.1.5 | Root, web | MEDIUM |
| prettier | 3.8.1 | 3.8.3 | Root | MEDIUM |
| typescript-eslint | 8.58.1 | 8.59.1 | Root | MEDIUM |
| jsdom | 29.0.2 | 29.1.0 | Root | MEDIUM |
| eslint-plugin-promise | 7.2.1 | 7.3.0 | Root | MEDIUM |
| @axe-core/playwright | 4.11.1 | 4.11.2 | Root | LOW |

---

## 3. Security Vulnerabilities

### High Severity (6 vulnerabilities)

#### CVE-2025-54798 - tmp (Arbitrary File write via symlink)
- **Severity:** Low
- **Package:** tmp
- **Vulnerable versions:** <=0.2.3
- **Patched version:** >=0.2.4
- **Path:** `.>@lhci/cli>inquirer>external-editor>tmp` and `.>@lhci/cli>tmp`
- **Recommendation:** Update @lhci/cli or replace with alternative
- **Risk:** Local privilege escalation via symlink attack

#### CVE-2020-7660 / GHSA-5c6j-r48x-rmvq - serialize-javascript (RCE via RegExp.flags)
- **Severity:** High
- **Package:** serialize-javascript
- **Vulnerable versions:** <=7.0.2
- **Patched version:** >=7.0.3
- **Path:** `apps__web>vite-plugin-pwa>workbox-build>@rollup/plugin-terser>serialize-javascript`
- **Recommendation:** Update vite-plugin-pwa to get patched serialize-javascript
- **Risk:** Remote Code Execution

#### CVE-2026-34043 - serialize-javascript (CPU Exhaustion DoS)
- **Severity:** Moderate
- **Package:** serialize-javascript
- **Vulnerable versions:** <7.0.5
- **Patched version:** >=7.0.5
- **Path:** `apps__web>vite-plugin-pwa>workbox-build>@rollup/plugin-terser>serialize-javascript`
- **Recommendation:** Update vite-plugin-pwa
- **Risk:** Denial of Service

#### GHSA-wh4c-j3r5-mjhp - @xmldom/xmldom (XML Injection)
- **Severity:** High
- **Package:** @xmldom/xmldom
- **Vulnerable versions:** <0.8.12
- **Patched version:** >=0.8.12
- **Path:** `apps__web>epubjs>@xmldom/xmldom`
- **Recommendation:** Update epubjs to latest version
- **Risk:** XML injection via unsafe CDATA serialization

#### GHSA-w5hq-g745-h8pq - uuid (Buffer Bounds Check)
- **Severity:** Moderate
- **Package:** uuid
- **Vulnerable versions:** <14.0.0
- **Patched version:** >=14.0.0
- **Path:** `.>@lhci/cli>uuid`
- **Recommendation:** Update @lhci/cli or use newer uuid
- **Risk:** Buffer overflow when buf is provided

#### Additional serialize-javascript vulnerabilities
- **Severity:** High (6 total high)
- **Package:** serialize-javascript
- **Recommendation:** Update vite-plugin-pwa

---

## 4. Recommendations

### Immediate Actions (Critical Security)

1. **Update vite-plugin-pwa** 
   - Current: ^1.2.0
   - Reason: Contains high-severity serialize-javascript vulnerabilities
   - Impact: Fixes 6 high/critical vulnerabilities

2. **Update epubjs**
   - Current: ^0.3.93
   - Reason: Contains high-severity @xmldom/xmldom XML injection
   - Impact: Fixes XML injection vulnerability

3. **Review @lhci/cli usage**
   - Current: ^0.15.1
   - Reason: Contains tmp and uuid vulnerabilities
   - Consider: Removing lighthouse CI if not actively used

### High Priority Updates

4. **Update ESLint ecosystem**
   ```
   eslint: 9.39.4 → 10.2.1
   @eslint/js: 9.39.4 → 10.0.1
   eslint-plugin-security: 3.0.1 → 4.0.0
   globals: 15.15.0 → 17.5.0
   ```
   - Breaking change: ESLint 10.x has flat config as default

5. **Update TypeScript**
   - Current: 6.0.2
   - Latest: 6.0.3
   - Low risk patch update

### Routine Updates (Next Sprint)

6. **Update testing ecosystem**
   ```
   vitest: 4.1.4 → 4.1.5
   @vitest/coverage-v8: 4.1.4 → 4.1.5
   jsdom: 29.0.2 → 29.1.0
   @axe-core/playwright: 4.11.1 → 4.11.2
   ```

7. **Update tooling**
   ```
   prettier: 3.8.1 → 3.8.3
   typescript-eslint: 8.58.1 → 8.59.1
   eslint-plugin-promise: 7.2.1 → 7.3.0
   ```

### Watch List

- **uuid:** Already at ^14.0.0 in web, but @lhci/cli pulls older version
- **framer-motion:** At ^12 (latest major), good
- **zustand:** At ^5 (latest major), good
- **workbox:** At ^7.4.0 (latest), good
- **tailwindcss:** At ^4.2.2 (latest v4), good
- **wrangler:** At ^4.86.0 (latest), good

---

## 5. Update Commands

### Security Updates (Recommended First)
```bash
# Update vite-plugin-pwa for serialize-javascript fixes
pnpm add -w vite-plugin-pwa@latest

# Update epubjs for xmldom fix
pnpm add -w epubjs@latest

# Remove @lhci/cli if not needed
pnpm remove -w @lhci/cli
```

### Major Updates (May Require Breaking Changes)
```bash
# ESLint 10 requires careful migration
pnpm add -w eslint@latest @eslint/js@latest typescript-eslint@latest
pnpm add -w eslint-plugin-security@latest globals@latest
```

### Routine Updates
```bash
# All outdated packages at once
pnpm add -w vitest@latest @vitest/coverage-v8@latest
pnpm add -w prettier@latest typescript@latest
pnpm add -w jsdom@latest @axe-core/playwright@latest
pnpm add -w eslint-plugin-promise@latest
```

---

## 6. Notes

- All workspace packages use `workspace:*` for internal dependencies - this is correct
- pnpm version 10.33.0 is current and appropriate for this project
- TypeScript 6.x is stable; waiting for 6.0.3 patch is fine
- The monorepo structure is well-organized with proper dependency management
- Consider enabling `pnpm update` for automated patch updates

---

*Report generated by analyzing package.json files and pnpm audit/outdated output*
