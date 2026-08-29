/**
 * Proof-of-concept AI plugin: local (on-device) text summarization
 * (issue #318, GOAP-318).
 *
 * Local-first contract: inference runs on-device; book text never leaves the
 * device. The inference engine is injected (dependency inversion) so
 * reader-core carries no heavy runtime dependency. The production
 * Transformers.js-backed engine is deliberately NOT wired in this change:
 * bundling onnxruntime-web's ~23 MB WASM asset breaks the PWA build
 * (vite-plugin-pwa injectManifest hard-fails beyond its 2 MiB precache
 * limit), so provider wiring is a follow-up architecture-sprint task. Until
 * an engine is registered, `summarize()` fails closed with
 * `AiProviderUnavailableError` — it never silently skips or falls back to
 * a network service.
 *
 * @see plans/262-goap-issue-318.md (ADR — rejected-alternatives section)
 */

import { isAiEnabled } from '../consent';
import { AiNotEnabledError, AiProviderUnavailableError } from '../types';
import type {
  AiPlugin,
  AiSummarizationResult,
  AiSummarizeOptions,
  TextProcessingCapability,
} from '../types';

export interface LocalSummarizationPluginOptions {
  /**
   * On-device inference engine. When omitted (the default today),
   * summarization fails closed with `AiProviderUnavailableError`.
   */
  engine?: {
    summarize(text: string, options?: AiSummarizeOptions): Promise<string>;
  };
}

export function createLocalSummarizationPlugin(options?: LocalSummarizationPluginOptions): AiPlugin {
  const engine = options?.engine;

  const text: TextProcessingCapability = {
    kind: 'text',
    async summarize(input: string, options?: AiSummarizeOptions): Promise<AiSummarizationResult> {
      if (!isAiEnabled()) {
        throw new AiNotEnabledError();
      }
      if (!engine) {
        throw new AiProviderUnavailableError(
          'no on-device inference engine registered (Transformers.js provider is a follow-up, see GOAP-318 ADR)',
        );
      }
      const source = input.trim();
      if (!source) {
        throw new AiProviderUnavailableError('empty input');
      }
      const started = performance.now();
      const summary = (await engine.summarize(source, options)).trim();
      if (!summary) {
        throw new AiProviderUnavailableError('engine returned no summary');
      }
      return {
        summary,
        pluginId: 'local-summarization',
        model: 'on-device',
        durationMs: performance.now() - started,
      };
    },
  };

  return {
    id: 'local-summarization',
    title: 'Local Summarization',
    version: '1.0.0',
    capabilities: { text },
  };
}
