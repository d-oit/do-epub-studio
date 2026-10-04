/**
 * AI plugin registry (issue #318, GOAP-318).
 *
 * Extension point for AI-assisted features: apps register plugins at
 * startup and the reader pipeline looks them up by id. The registry is a
 * plain module-level singleton — no framework dependency — so it works in
 * the browser reader, workers, and tests alike.
 */

import type { AiPlugin } from './types';
import { AiPluginNotFoundError, AiPluginRegistrationError } from './types';

const plugins = new Map<string, AiPlugin>();

/**
 * Register an AI plugin.
 * @throws {AiPluginRegistrationError} if a plugin with the same id exists.
 */
export function registerAiPlugin(plugin: AiPlugin): void {
  if (plugins.has(plugin.id)) {
    throw new AiPluginRegistrationError(plugin.id);
  }
  plugins.set(plugin.id, plugin);
}

/**
 * Look up a registered plugin.
 * @throws {AiPluginNotFoundError} if the id is not registered.
 */
export function getAiPlugin(id: string): AiPlugin {
  const plugin = plugins.get(id);
  if (!plugin) {
    throw new AiPluginNotFoundError(id);
  }
  return plugin;
}

/** All registered plugins, in registration order. */
export function listAiPlugins(): readonly AiPlugin[] {
  return [...plugins.values()];
}

/**
 * Unregister a plugin.
 * @returns true if a plugin was removed, false if the id was unknown.
 */
export function unregisterAiPlugin(id: string): boolean {
  return plugins.delete(id);
}

/** Test-only: clear the registry. */
export function resetAiPluginRegistry(): void {
  plugins.clear();
}
