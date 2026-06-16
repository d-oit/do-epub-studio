import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  fetchHighlights,
  createHighlight,
  updateHighlight,
  deleteHighlight,
  fetchComments,
  createComment,
  updateComment,
} from '../lib/api/annotations';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '../lib/api';
const mockApiRequest = vi.mocked(apiRequest);

describe('annotations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchHighlights', () => {
    it('calls GET /api/books/:bookId/highlights', async () => {
      const mockHighlights = [{ id: '1', color: '#ff0000' }];
      mockApiRequest.mockResolvedValue(mockHighlights);

      const result = await fetchHighlights('book-1', 'token-123');

      expect(result).toEqual(mockHighlights);
      expect(mockApiRequest).toHaveBeenCalledWith('/api/books/book-1/highlights', {
        method: 'GET',
        token: 'token-123',
      });
    });
  });

  describe('createHighlight', () => {
    it('calls POST /api/books/:bookId/highlights with data', async () => {
      const mockHighlight = { id: '2', color: '#00ff00' };
      mockApiRequest.mockResolvedValue(mockHighlight);

      const data = {
        locator: { chapterRef: 'ch1', cfi: 'cfi-1', selectedText: 'hello' },
        note: 'My note',
        color: '#00ff00',
      };

      const result = await createHighlight('book-1', data, 'token-123');

      expect(result).toEqual(mockHighlight);
      expect(mockApiRequest).toHaveBeenCalledWith('/api/books/book-1/highlights', {
        method: 'POST',
        token: 'token-123',
        body: JSON.stringify(data),
      });
    });
  });

  describe('updateHighlight', () => {
    it('calls PATCH /api/books/:bookId/highlights/:highlightId', async () => {
      mockApiRequest.mockResolvedValue({ id: '2' });

      const result = await updateHighlight('book-1', '2', { note: 'Updated' }, 'token-123');

      expect(result).toEqual({ id: '2' });
      expect(mockApiRequest).toHaveBeenCalledWith('/api/books/book-1/highlights/2', {
        method: 'PATCH',
        token: 'token-123',
        body: JSON.stringify({ note: 'Updated' }),
      });
    });
  });

  describe('deleteHighlight', () => {
    it('calls DELETE /api/books/:bookId/highlights/:highlightId', async () => {
      mockApiRequest.mockResolvedValue(undefined);

      await deleteHighlight('book-1', '2', 'token-123');

      expect(mockApiRequest).toHaveBeenCalledWith('/api/books/book-1/highlights/2', {
        method: 'DELETE',
        token: 'token-123',
      });
    });
  });

  describe('fetchComments', () => {
    it('calls GET /api/books/:bookId/comments', async () => {
      const mockComments = [{ id: '1', body: 'Great!' }];
      mockApiRequest.mockResolvedValue(mockComments);

      const result = await fetchComments('book-1', 'token-123');

      expect(result).toEqual(mockComments);
      expect(mockApiRequest).toHaveBeenCalledWith('/api/books/book-1/comments', {
        method: 'GET',
        token: 'token-123',
      });
    });
  });

  describe('createComment', () => {
    it('calls POST /api/books/:bookId/comments with data', async () => {
      const mockComment = { id: '2', body: 'Nice!' };
      mockApiRequest.mockResolvedValue(mockComment);

      const data = { body: 'Nice!', visibility: 'public' };
      const result = await createComment('book-1', data, 'token-123');

      expect(result).toEqual(mockComment);
      expect(mockApiRequest).toHaveBeenCalledWith('/api/books/book-1/comments', {
        method: 'POST',
        token: 'token-123',
        body: JSON.stringify(data),
      });
    });
  });

  describe('updateComment', () => {
    it('calls PATCH /api/comments/:commentId', async () => {
      mockApiRequest.mockResolvedValue({ id: '2' });

      const result = await updateComment('2', { body: 'Updated' }, 'token-123');

      expect(result).toEqual({ id: '2' });
      expect(mockApiRequest).toHaveBeenCalledWith('/api/comments/2', {
        method: 'PATCH',
        token: 'token-123',
        body: JSON.stringify({ body: 'Updated' }),
      });
    });
  });
});
