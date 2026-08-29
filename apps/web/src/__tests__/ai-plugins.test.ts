import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setAiEnabled: vi.fn(),
  registerAiPlugin: vi.fn(),
  configureAiConsentStorage: vi.fn(),
}));

vi.mock('@do-epub-studio/reader-core', () => ({
  setAiEnabled: (...args: unknown[]) => mocks.setAiEnabled(...args),
  registerAiPlugin: (...args: unknown[]) => mocks.registerAiPlugin(...args),
  configureAiConsentStorage: (...args: unknown[]) => mocks.configureAiConsentStorage(...args),
  createLocalSummarizationPlugin: () => ({
    id: 'local-summarization',
    title: 'Local Summarization',
    version: '1.0.0',
    capabilities: {},
  }),
}));

import { initAiPlugins } from '../lib/ai-plugins';
import { usePreferencesStore } from '../stores/preferences';

// Note: `initAiPlugins` is idempotent for the life of the module (it guards
// on a module-level flag), so the FIRST test in this file owns the
// initialization side effects; later tests exercise the consent sync, which
// stays live after init.
describe('initAiPlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePreferencesStore.getState().setAiEnabled(false);
  });

  it('registers the local summarization plugin once and wires browser consent storage', () => {
    initAiPlugins();
    initAiPlugins(); // idempotent: second call is a no-op
    expect(mocks.registerAiPlugin).toHaveBeenCalledTimes(1);
    expect(mocks.registerAiPlugin.mock.calls[0][0]).toMatchObject({
      id: 'local-summarization',
    });
    expect(mocks.configureAiConsentStorage).toHaveBeenCalledTimes(1);
    expect(mocks.configureAiConsentStorage).toHaveBeenCalledWith(globalThis.localStorage);
  });

  it('syncs the consent gate when the user opts in via preferences', () => {
    usePreferencesStore.getState().setAiEnabled(true);
    expect(mocks.setAiEnabled).toHaveBeenLastCalledWith(true);
  });

  it('syncs the consent gate back to disabled on opt-out', () => {
    usePreferencesStore.getState().setAiEnabled(true);
    usePreferencesStore.getState().setAiEnabled(false);
    expect(mocks.setAiEnabled).toHaveBeenLastCalledWith(false);
  });

  it('does not resync on unrelated preference changes', () => {
    usePreferencesStore.getState().setAiEnabled(true); // establish a sync call
    const calls = mocks.setAiEnabled.mock.calls.length;
    usePreferencesStore.getState().setTheme('dark');
    expect(mocks.setAiEnabled.mock.calls.length).toBe(calls);
  });
});
