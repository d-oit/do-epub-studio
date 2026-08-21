import { setWASMModules } from 'argon2-wasm-edge';
// GOAP-252: Cloudflare only supports instantiating PRE-COMPILED WebAssembly
// modules (runtime `WebAssembly.compile()` throws "Wasm code generation
// disallowed by embedder"). Importing the `.wasm` files as ES modules makes the
// Pages build compile them at deploy time and hand us `WebAssembly.Module`
// instances, which argon2-wasm-edge's `setWASMModules()` accepts. The wasm
// files are resolved from the package itself (no `exports` map) so no binaries
// are tracked in the repo.
// @ts-expect-error - wrangler's CompiledWasm rule types `.wasm` imports.
import argon2Wasm from 'argon2-wasm-edge/wasm/argon2.wasm';
// @ts-expect-error - wrangler's CompiledWasm rule types `.wasm` imports.
import blake2bWasm from 'argon2-wasm-edge/wasm/blake2b.wasm';

let registered = false;

/**
 * Register the pre-compiled Argon2 wasm modules with argon2-wasm-edge so
 * password hashing/verification works on Cloudflare Workers/Pages. Must run
 * before any `hashPassword`/`verifyPassword` call. Idempotent: subsequent calls
 * are no-ops. Exported from the worker so the Pages Function (which cannot
 * resolve `argon2-wasm-edge` directly) can trigger it.
 */
export async function registerArgon2Wasm(): Promise<void> {
  if (registered) return;
  await setWASMModules({ argon2WASM: argon2Wasm, blake2bWASM: blake2bWasm });
  registered = true;
}
