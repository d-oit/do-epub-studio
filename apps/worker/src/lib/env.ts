export interface Env {
  BOOKS_BUCKET: R2Bucket;
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  SESSION_SIGNING_SECRET: string;
  INVITE_TOKEN_SECRET: string;
  APP_BASE_URL: string;
}

export type JsonRow = Record<string, string | number | null | undefined>;

export interface R2Bucket {
  get(key: string, options?: { range?: { offset?: number; length?: number } }): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: R2PutOptions): Promise<R2Object>;
  delete(key: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

export interface R2Object {
  key: string;
  custom?: Record<string, string>;
  httpEtag: string;
  range?: { offset: number; length: number; total: number };
  writeHttpMetadata(headers: Headers): void;
  body: ReadableStream | null;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
}

export interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
  };
  customMetadata?: Record<string, string>;
  md5?: ArrayBuffer;
  sha256?: string;
}

export interface R2ListOptions {
  prefix?: string;
  cursor?: string;
  delimiter?: string;
  limit?: number;
  include?: ('httpMetadata' | 'customMetadata')[];
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}
