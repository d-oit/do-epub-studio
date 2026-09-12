/**
 * Engine-less editorial review plugin (GOAP-999 Wave 4, AI-01/AI-02).
 *
 * Infrastructure only. This plugin exists so the capability seam, consent gate
 * and UI states are wired for every category; it performs NO inference and
 * MUST report `engine_missing` for every request. Returning a schema-shaped
 * finding here would be a fabricated result, so the behaviour is pinned by
 * test.
 *
 * Replacing this with a real engine is a separate qualification milestone
 * (see `qualification.ts` and ADR-999 D5) — not a configuration change.
 */

import type { AiPlugin, EditorialReviewCapability, EditorialReviewRequest } from '../types';
import type { EditorialCategory, EditorialReviewOutcome } from '../editorial-findings';

export interface LocalEditorialPluginOptions {
  /** Overrides the reported engine name (qualification bookkeeping). */
  engine?: string;
  /** Overrides the reported model name (qualification bookkeeping). */
  model?: string;
}

/**
 * Every category this plugin would serve. Kept explicit so the UI can list the
 * full contract while availability stays gated by `qualification.ts`.
 */
export const EDITORIAL_PLUGIN_CATEGORIES: readonly EditorialCategory[] = [
  'spelling',
  'grammar',
  'story',
  'logic',
];

export function createLocalEditorialPlugin(
  options: LocalEditorialPluginOptions = {},
): AiPlugin {
  const capability: EditorialReviewCapability = {
    kind: 'editorial',
    // Nothing to run: the qualification gate may only report a category as
    // available when this is true, so a milestone flip cannot masquerade as a
    // working engine.
    hasEngine: () => false,
    review(_request: EditorialReviewRequest): Promise<EditorialReviewOutcome> {
      // No engine is bundled. Say so — never a fabricated finding, never a
      // bare "no findings" that would read as a successful clean run.
      return Promise.resolve({ status: 'unavailable', reason: 'engine_missing' });
    },
  };

  return {
    id: 'local-editorial',
    title: `${options.engine ?? 'On-device'} editorial review (engine not bundled)`,
    version: '0.1.0',
    capabilities: { editorial: capability },
  };
}

/** Reported provenance for this plugin — surfaced so callers never guess. */
export function localEditorialProvenance(options: LocalEditorialPluginOptions = {}) {
  return {
    engine: options.engine ?? 'none',
    model: options.model ?? 'none',
    ruleId: null,
  } as const;
}
