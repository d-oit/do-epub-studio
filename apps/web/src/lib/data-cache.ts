import { apiRequest } from './api';
import type { AuditLogResponse, BookResponse, GrantResponse } from '@do-epub-studio/shared';

export interface CatalogBook {
  id: string;
  slug: string;
  title: string;
  authorName: string | null;
  description: string | null;
  language: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

export interface AuditLogPageResponse {
  entries: AuditLogResponse[];
  total: number;
}

export interface BookOption {
  id: string;
  title: string;
  slug: string;
}

const catalogCache = new Map<string, Promise<CatalogBook[]>>();

export function fetchCatalogBooks(): Promise<CatalogBook[]> {
  const cached = catalogCache.get('default');
  if (cached) return cached;
  const promise = apiRequest<CatalogBook[]>('/api/catalog');
  catalogCache.set('default', promise);
  return promise;
}

export function invalidateCatalogCache(): void {
  catalogCache.clear();
}

const auditLogCache = new Map<string, Promise<AuditLogPageResponse>>();

export interface AuditLogFilters {
  page: number;
  entityType: string;
  entityId: string;
  dateFrom: string;
  dateTo: string;
  pageSize: number;
}

export function fetchAuditLogs(
  filters: AuditLogFilters,
  token: string | null,
): Promise<AuditLogPageResponse> {
  const key = JSON.stringify({ ...filters, token: token ?? '' });
  const cached = auditLogCache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams();
  params.set('limit', String(filters.pageSize));
  params.set('offset', String((filters.page - 1) * filters.pageSize));
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.entityId) params.set('entityId', filters.entityId);
  if (filters.dateFrom) params.set('from', filters.dateFrom);
  if (filters.dateTo) params.set('to', filters.dateTo);

  const promise = apiRequest<AuditLogPageResponse>(
    `/api/admin/audit-logs?${params.toString()}`,
    { token: token ?? undefined },
  );
  auditLogCache.set(key, promise);
  return promise;
}

export function invalidateAuditLogCache(): void {
  auditLogCache.clear();
}

const booksCache = new Map<string, Promise<BookOption[]>>();

export function fetchAdminBooks(token: string | null): Promise<BookOption[]> {
  const key = token ?? 'anon';
  const cached = booksCache.get(key);
  if (cached) return cached;
  const promise = apiRequest<BookResponse[]>('/api/admin/books', {
    token: token ?? undefined,
  }).then((data: BookResponse[]) => data.map((b: BookResponse) => ({ id: b.id, title: b.title, slug: b.slug })));
  booksCache.set(key, promise);
  return promise;
}

const grantsCache = new Map<string, Promise<GrantResponse[]>>();

export function fetchGrantsForBook(
  bookId: string,
  token: string | null,
): Promise<GrantResponse[]> {
  const key = `${bookId}:${token ?? ''}`;
  const cached = grantsCache.get(key);
  if (cached) return cached;
  const promise = apiRequest<GrantResponse[]>(`/api/admin/books/${bookId}/grants`, {
    token: token ?? undefined,
  });
  grantsCache.set(key, promise);
  return promise;
}

export function invalidateGrantsCache(bookId?: string): void {
  if (bookId) {
    for (const key of grantsCache.keys()) {
      if (key.startsWith(`${bookId}:`)) grantsCache.delete(key);
    }
  } else {
    grantsCache.clear();
  }
}
