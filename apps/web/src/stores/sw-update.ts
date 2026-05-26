import { create } from 'zustand';

interface SwUpdateState {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: (() => void) | null;
  setNeedRefresh: (fn: (() => void) | null) => void;
  setOfflineReady: (ready: boolean) => void;
  dismiss: () => void;
}

export const useSwUpdateStore = create<SwUpdateState>()((set) => ({
  needRefresh: false,
  offlineReady: false,
  updateServiceWorker: null,
  setNeedRefresh: (fn) => set({ needRefresh: fn !== null, updateServiceWorker: fn }),
  setOfflineReady: (ready) => set({ offlineReady: ready }),
  dismiss: () => set({ needRefresh: false, offlineReady: false, updateServiceWorker: null }),
}));
