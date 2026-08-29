/**
 * AI plugin architecture (issue #318, GOAP-318).
 *
 * Public surface: plugin types + errors, the plugin registry (reader
 * pipeline extension point), the opt-in consent gate, and the local
 * summarization proof-of-concept plugin.
 *
 * @see plans/262-goap-issue-318.md (ADR)
 */

export {
  AiNotEnabledError,
  AiPluginError,
  AiPluginNotFoundError,
  AiPluginRegistrationError,
  AiProviderUnavailableError,
} from './types';
export type {
  AiPlugin,
  AiPluginCapabilities,
  AiSummarizationResult,
  AiSummarizeOptions,
  AudioProcessingCapability,
  ImageProcessingCapability,
  TextProcessingCapability,
} from './types';

export {
  getAiPlugin,
  listAiPlugins,
  registerAiPlugin,
  resetAiPluginRegistry,
  unregisterAiPlugin,
} from './registry';

export { configureAiConsentStorage, isAiEnabled, setAiEnabled } from './consent';
export type { AiConsentStorage } from './consent';

export { createLocalSummarizationPlugin } from './plugins/local-summarization';
export type { LocalSummarizationPluginOptions } from './plugins/local-summarization';
