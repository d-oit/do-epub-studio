/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
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
