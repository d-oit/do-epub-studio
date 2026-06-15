import { apiRequest } from '../api';
import type { ReadingProgress } from '../../stores';

export async function fetchProgress(bookId: string, token: string): Promise<ReadingProgress> {
  const data = await apiRequest<{
    locator: { cfi?: string } | null;
    progressPercent: number;
    updatedAt?: string;
  }>(`/api/books/${bookId}/progress`, {
    method: 'GET',
    token,
  });

  return {
    locator: data.locator ? { cfi: data.locator.cfi || '' } : null,
    progressPercent: data.progressPercent,
    updatedAt: data.updatedAt || null,
  };
}
