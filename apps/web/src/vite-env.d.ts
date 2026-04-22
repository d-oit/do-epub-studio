/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_DESCRIPTION: string;
  readonly VITE_APP_THEME_COLOR: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ServiceWorkerRegistration {
  readonly sync?: SyncManager;
}

interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}
