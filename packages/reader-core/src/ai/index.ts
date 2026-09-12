/**
 * AI plugin architecture (issue #318, GOAP-318).
 *
 * Public surface: plugin types + errors, the plugin registry (reader
 * pipeline extension point), the opt-in consent gate, and the local
 * summarization proof-of-concept plugin.
 *
 * @see plans/archive/262-goap-issue-318.md (ADR)
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

// Wave 4 (GOAP-999, COL-03 → AI-01/02/03): grounded editorial assistance.
export { validateEditorialFindings } from './editorial-findings';
export type {
  CitedSpan,
  EditorialCategory,
  EditorialFinding,
  EditorialProvenance,
  EditorialReviewOutcome,
  EditorialSeverity,
  EditorialUncertainty,
  EditorialUnavailableReason,
  FindingRejectionReason,
  RejectedFinding,
  ValidationContext,
  ValidationResult,
} from './editorial-findings';
export {
  categoryAvailability,
  isCategoryAvailable,
  milestone,
  QUALIFICATION_MILESTONES,
} from './qualification';
export type {
  QualificationId,
  QualificationMilestone,
} from './qualification';
export {
  createLocalEditorialPlugin,
  EDITORIAL_PLUGIN_CATEGORIES,
  localEditorialProvenance,
} from './plugins/local-editorial';
export type { LocalEditorialPluginOptions } from './plugins/local-editorial';
export type {
  EditorialReviewCapability,
  EditorialReviewRequest,
} from './types';
