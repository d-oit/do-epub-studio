/**
 * AI plugin architecture — type definitions (issue #318, GOAP-318).
 *
 * AI-assisted features are client-side plugins registered against the
 * reader pipeline. Every capability invocation is gated by explicit user
 * consent (see `consent.ts`) and all processing is local-first: inference
 * runs on-device and book text never leaves the device (the only network
 * traffic is a one-time model download, browser-cached).
 *
 * @see plans/archive/262-goap-issue-318.md (ADR)
 */

import type { EditorialCategory, EditorialReviewOutcome } from './editorial-findings';

export type { EditorialCategory, EditorialReviewOutcome };

/** Base error for all AI plugin failures. */
export class AiPluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiPluginError';
  }
}

/** Requested plugin id is not registered. */
export class AiPluginNotFoundError extends AiPluginError {
  constructor(id: string) {
    super(`AI plugin "${id}" is not registered`);
    this.name = 'AiPluginNotFoundError';
  }
}

/** A plugin with the same id is already registered. */
export class AiPluginRegistrationError extends AiPluginError {
  constructor(id: string) {
    super(`AI plugin "${id}" is already registered`);
    this.name = 'AiPluginRegistrationError';
  }
}

/** AI features are not enabled (user has not opted in). */
export class AiNotEnabledError extends AiPluginError {
  constructor() {
    super('AI features are not enabled. The user must opt in in reader settings.');
    this.name = 'AiNotEnabledError';
  }
}

/** The on-device inference provider could not be loaded (e.g. offline on first use). */
export class AiProviderUnavailableError extends AiPluginError {
  constructor(reason: string) {
    super(`On-device AI provider unavailable: ${reason}`);
    this.name = 'AiProviderUnavailableError';
  }
}

/** Options accepted by text summarization. */
export interface AiSummarizeOptions {
  /** Target summary length in words (provider-dependent granularity). */
  maxWordCount?: number;
}

/** Result of a text summarization. */
export interface AiSummarizationResult {
  summary: string;
  pluginId: string;
  model: string;
  durationMs: number;
}

/**
 * Text-processing capability (summarization; translation will extend this
 * interface as the architecture matures — see GOAP-318 ADR).
 */
export interface TextProcessingCapability {
  readonly kind: 'text';
  summarize(text: string, options?: AiSummarizeOptions): Promise<AiSummarizationResult>;
}

/** Image-processing capability (OCR). Defined for the architecture; no PoC yet. */
export interface ImageProcessingCapability {
  readonly kind: 'image';
  /** Extract text from an image (on-device). */
  extractText(image: Uint8Array): Promise<string>;
}

/** Audio-processing capability (TTS). Defined for the architecture; no PoC yet. */
export interface AudioProcessingCapability {
  readonly kind: 'audio';
  /** Synthesize speech for text (on-device). */
  synthesize(text: string): Promise<ArrayBuffer>;
}

/**
 * Grounded editorial review (GOAP-999 Wave 4).
 *
 * Implementations return an `EditorialReviewOutcome`; findings are validated
 * against source material before a reviewer ever sees them, and an unavailable
 * engine must say so rather than emit schema-shaped guesses.
 */
export interface EditorialReviewCapability {
  readonly kind: 'editorial';
  review(request: EditorialReviewRequest): Promise<EditorialReviewOutcome>;
}

/** What a caller asks for. `categories` are checked against the qualification gate. */
export interface EditorialReviewRequest {
  categories: readonly EditorialCategory[];
  /** Chapter text keyed by `chapterRef`; the only text an engine may read. */
  chapterText: Record<string, string>;
  /** Current source identity per chapter, for staleness checks. */
  chapterSha256: Record<string, string | null>;
  /** Retained references the review may rely on: id → { revision, content }. */
  references: Record<string, { revision: number; content: string }>;
  styleRevision: number | null;
  /** BCP-47 language of the book, when known. */
  language: string | null;
}

/** The set of capabilities a plugin provides (all optional — a plugin may offer any subset). */
export interface AiPluginCapabilities {
  readonly text?: TextProcessingCapability;
  readonly image?: ImageProcessingCapability;
  readonly audio?: AudioProcessingCapability;
  /** Grounded editorial review (GOAP-999 Wave 4) — see `editorial-findings.ts`. */
  readonly editorial?: EditorialReviewCapability;
}

/**
 * An AI feature plugin. Registered via `registerAiPlugin`; invoked through
 * the registry only after the user has opted in (consent gate).
 */
export interface AiPlugin {
  /** Stable unique identifier (e.g. `local-summarization`). */
  readonly id: string;
  /** Human-readable name for UI. */
  readonly title: string;
  /** Semver of the plugin. */
  readonly version: string;
  readonly capabilities: AiPluginCapabilities;
}
