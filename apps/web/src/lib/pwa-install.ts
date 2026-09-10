import { usePwaInstallStore } from '../stores/pwa-install';

/**
 * Chromium's non-standard install-prompt event. It is not in lib.dom.d.ts
 * (and was removed from TypeScript's DOM lib), so the shape is declared here;
 * every use is feature-detected by the listener, never by user agent.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Retained install event; only the latest one is kept. */
let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * True when the app is already running as an installed app/window.
 * `display-mode` media queries cover desktop (window-controls-overlay) and
 * Android/mobile (standalone, minimal-ui); `navigator.standalone` is the iOS
 * Safari signal. No user-agent sniffing.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const matches = (query: string): boolean =>
    typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  return (
    matches('(display-mode: standalone)') ||
    matches('(display-mode: minimal-ui)') ||
    matches('(display-mode: window-controls-overlay)') ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Show the retained native install prompt exactly once.
 *
 * Returns `'unavailable'` when the browser never offered a prompt (unsupported
 * browser) or the retained event was already consumed/dropped. The event is
 * discarded before prompting: `prompt()` is once-per-event, so re-entrant or
 * duplicate calls must not open a second dialog. A later
 * `beforeinstallprompt` re-arms `canPrompt`.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferredPrompt;
  if (!event) return 'unavailable';

  deferredPrompt = null;
  usePwaInstallStore.getState().setCanPrompt(false);

  try {
    void event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return 'unavailable';
  }
}

/**
 * Register the install lifecycle listeners.
 *
 * - `beforeinstallprompt`: always `preventDefault()` (suppresses the browser
 *   mini-infobar so the app decides when to prompt), retains only the latest
 *   event, and exposes `canPrompt` unless already standalone.
 * - `appinstalled`: drops the retained event, clears `canPrompt`, sets
 *   `installed`.
 *
 * Returns a cleanup that removes both listeners and drops the retained event
 * (used for HMR and tests; production keeps the listeners for app lifetime).
 */
export function setupInstallListeners(): () => void {
  if (isStandalone()) usePwaInstallStore.getState().setInstalled(true);

  const onBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    if (!isStandalone()) usePwaInstallStore.getState().setCanPrompt(true);
  };

  const onInstalled = () => {
    deferredPrompt = null;
    usePwaInstallStore.getState().setCanPrompt(false);
    usePwaInstallStore.getState().setInstalled(true);
  };

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onInstalled);

  return () => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onInstalled);
    deferredPrompt = null;
  };
}
