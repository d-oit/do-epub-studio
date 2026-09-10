import { create } from 'zustand';

interface PwaInstallState {
  /** A retained `beforeinstallprompt` event exists and may be used to prompt. */
  canPrompt: boolean;
  /** Already installed: `appinstalled` fired, or the app runs standalone. */
  installed: boolean;
  /** The user dismissed the native prompt this session; stop offering it. */
  dismissed: boolean;
  setCanPrompt: (canPrompt: boolean) => void;
  setInstalled: (installed: boolean) => void;
  setDismissed: () => void;
}

export const usePwaInstallStore = create<PwaInstallState>()((set) => ({
  canPrompt: false,
  installed: false,
  dismissed: false,
  setCanPrompt: (canPrompt) => set({ canPrompt }),
  setInstalled: (installed) => set({ installed }),
  setDismissed: () => set({ dismissed: true }),
}));
