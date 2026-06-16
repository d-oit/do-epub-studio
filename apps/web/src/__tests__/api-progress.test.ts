import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchProgress } from '../lib/api/progress';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '../lib/api';
const mockApiRequest = vi.mocked(apiRequest);

describe('progress API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchProgress', () => {
    it('calls GET /api/books/:bookId/progress', async () => {
      const mockResponse = {
        locator: { cfi: 'cfi-123' },
        progressPercent: 45.5,
        updatedAt: '2024-01-15T10:00:00Z',
      };
      mockApiRequest.mockResolvedValue(mockResponse);

      const result = await fetchProgress('book-1', 'token-123');

      expect(result).toEqual({
        locator: { cfi: 'cfi-123' },
        progressPercent: 45.5,
        updatedAt: '2024-01-15T10:00:00Z',
      });
      expect(mockApiRequest).toHaveBeenCalledWith('/api/books/book-1/progress', {
        method: 'GET',
        token: 'token-123',
      });
    });

    it('handles null locator', async () => {
      const mockResponse = {
        locator: null,
        progressPercent: 0,
        updatedAt: undefined,
      };
      mockApiRequest.mockResolvedValue(mockResponse);

      const result = await fetchProgress('book-1', 'token-123');

      expect(result).toEqual({
        locator: null,
        progressPercent: 0,
        updatedAt: null,
      });
    });

    it('handles locator with empty cfi', async () => {
      const mockResponse = {
        locator: { cfi: '' },
        progressPercent: 10,
        updatedAt: '2024-01-15T10:00:00Z',
      };
      mockApiRequest.mockResolvedValue(mockResponse);

      const result = await fetchProgress('book-1', 'token-123');

      expect(result.locator).toEqual({ cfi: '' });
    });
  });
});
