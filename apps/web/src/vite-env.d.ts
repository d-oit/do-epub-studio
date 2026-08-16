/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_LOG_LEVEL?: string;
  readonly VITE_TELEMETRY_ENDPOINT?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_DEMO_LOGIN_ENABLED?: string;
  readonly VITE_DEMO_BOOK_SLUG?: string;
  readonly VITE_HELP_URL?: string;
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
