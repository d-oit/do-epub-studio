import {
  configureAiConsentStorage,
  createLocalSummarizationPlugin,
  registerAiPlugin,
  setAiEnabled,
} from '@do-epub-studio/reader-core';
import { usePreferencesStore } from '../stores/preferences';

let initialized = false;

/**
 * Register the on-device AI plugin and sync the consent gate with the
 * persisted reader preferences (issue #318).
 *
 * Consent is single-sourced in the preferences store (`reader.aiEnabled`,
 * off by default); this module mirrors it into the reader-core consent
 * gate, which is the only unlock for inference. Idempotent.
 */
export function initAiPlugins(): void {
  if (initialized) return;
  initialized = true;

  if (typeof globalThis.localStorage !== 'undefined') {
    configureAiConsentStorage(globalThis.localStorage);
  }

  registerAiPlugin(createLocalSummarizationPlugin());

  const syncConsent = (): void => {
    setAiEnabled(usePreferencesStore.getState().reader.aiEnabled);
  };
  syncConsent();
  usePreferencesStore.subscribe((state, previous) => {
    if (state.reader.aiEnabled !== previous.reader.aiEnabled) {
      syncConsent();
    }
  });
}
