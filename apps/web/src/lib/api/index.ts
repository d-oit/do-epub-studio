/**
 * API barrel module.
 *
 * Re-exports from `./core` (apiRequest, api, getApiUrl, API_BASE_URL),
 * `./annotations`, and `./progress`. The implementation lives in `core.ts`
 * so that feature modules (`annotations.ts`, `progress.ts`) can import
 * `apiRequest` from `./core` directly, avoiding a barrel-imports-barrel
 * circular dependency.
 */
export { apiRequest, api, getApiUrl, API_BASE_URL } from './core';
export * from './annotations';
export * from './progress';
