export function registerSW(options?: {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: unknown) => void;
  onRegisterError?: (error: unknown) => void;
}): () => void {
  if (options?.onRegistered) {
    options.onRegistered(null);
  }
  return () => {};
}
