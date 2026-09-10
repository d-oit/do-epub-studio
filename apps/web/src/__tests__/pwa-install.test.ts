import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  isStandalone,
  promptInstall,
  setupInstallListeners,
  type BeforeInstallPromptEvent,
} from '../lib/pwa-install';
import { usePwaInstallStore } from '../stores/pwa-install';

type Outcome = 'accepted' | 'dismissed';

/** jsdom's `matchMedia` is stubbed false globally (test-setup.ts); rebuild it
 *  per test so display-mode detection can be exercised. */
function stubMatchMedia(isMatch: (query: string) => boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMatch(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

/** Build a cancelable event carrying the Chromium install-prompt members. */
function installEvent(outcome: Outcome = 'accepted'): {
  event: BeforeInstallPromptEvent;
  prompt: Mock;
} {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  }) as BeforeInstallPromptEvent;
  return { event, prompt };
}

let cleanup: (() => void) | null = null;

describe('pwa-install', () => {
  beforeEach(() => {
    usePwaInstallStore.setState({ canPrompt: false, installed: false, dismissed: false });
    stubMatchMedia(() => false);
    delete (navigator as Navigator & { standalone?: boolean }).standalone;
    // Guarantees the module-level retained event is dropped after every test.
    cleanup = setupInstallListeners();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    delete (navigator as Navigator & { standalone?: boolean }).standalone;
  });

  it('retains beforeinstallprompt, prevents the mini-infobar, and exposes canPrompt', () => {
    const { event } = installEvent();
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(usePwaInstallStore.getState().canPrompt).toBe(true);
  });

  it("returns 'unavailable' when no install event was offered", async () => {
    await expect(promptInstall()).resolves.toBe('unavailable');
  });

  it('consumes the retained event exactly once', async () => {
    const { event, prompt } = installEvent('accepted');
    window.dispatchEvent(event);
    expect(usePwaInstallStore.getState().canPrompt).toBe(true);

    await expect(promptInstall()).resolves.toBe('accepted');
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(usePwaInstallStore.getState().canPrompt).toBe(false);
    await expect(promptInstall()).resolves.toBe('unavailable');
  });

  it('reports a dismissed outcome and leaves canPrompt cleared', async () => {
    window.dispatchEvent(installEvent('dismissed').event);
    await expect(promptInstall()).resolves.toBe('dismissed');
    expect(usePwaInstallStore.getState().canPrompt).toBe(false);
  });

  it('clears the pending event and marks installed on appinstalled', async () => {
    window.dispatchEvent(installEvent().event);
    window.dispatchEvent(new Event('appinstalled'));

    const state = usePwaInstallStore.getState();
    expect(state.canPrompt).toBe(false);
    expect(state.installed).toBe(true);
    await expect(promptInstall()).resolves.toBe('unavailable');
  });

  it('detects standalone display modes and iOS navigator.standalone', () => {
    stubMatchMedia((query) => query === '(display-mode: standalone)');
    expect(isStandalone()).toBe(true);

    stubMatchMedia((query) => query === '(display-mode: window-controls-overlay)');
    expect(isStandalone()).toBe(true);

    stubMatchMedia(() => false);
    expect(isStandalone()).toBe(false);

    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    expect(isStandalone()).toBe(true);
  });

  it('marks installed at setup when already running standalone', () => {
    cleanup?.();
    stubMatchMedia((query) => query === '(display-mode: minimal-ui)');
    cleanup = setupInstallListeners();
    expect(usePwaInstallStore.getState().installed).toBe(true);
  });

  it('cleanup removes listeners and drops the retained event', async () => {
    window.dispatchEvent(installEvent().event);
    expect(usePwaInstallStore.getState().canPrompt).toBe(true);

    cleanup?.();
    cleanup = null;
    usePwaInstallStore.getState().setCanPrompt(false);

    // Listener gone: a fresh event is inert.
    window.dispatchEvent(installEvent().event);
    expect(usePwaInstallStore.getState().canPrompt).toBe(false);
    await expect(promptInstall()).resolves.toBe('unavailable');
  });
});
