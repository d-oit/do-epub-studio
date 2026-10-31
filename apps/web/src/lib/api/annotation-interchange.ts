import { apiRequest } from './core';
import type { AnnotationInterchangeDocument } from '@do-epub-studio/schema';

export function fetchAnnotationInterchange(
  bookId: string,
  token: string,
): Promise<AnnotationInterchangeDocument | null> {
  return apiRequest<AnnotationInterchangeDocument | null>(
    `/api/books/${bookId}/annotation-interchange`,
    { method: 'GET', token },
  );
}

export async function saveAnnotationInterchange(
  bookId: string,
  document: AnnotationInterchangeDocument,
  token: string,
): Promise<void> {
  await apiRequest<{ saved: boolean }>(`/api/books/${bookId}/annotation-interchange`, {
    method: 'PUT',
    token,
    body: JSON.stringify(document),
  });
}
