import { apiRequest } from '../api';
import type { Highlight, Comment } from '../../stores';

export async function fetchHighlights(bookId: string, token: string): Promise<Highlight[]> {
  return apiRequest<Highlight[]>(`/api/books/${bookId}/highlights`, {
    method: 'GET',
    token,
  });
}

export async function createHighlight(
  bookId: string,
  data: {
    chapterRef?: string;
    cfiRange?: string;
    selectedText: string;
    note?: string;
    color?: string;
  },
  token: string,
): Promise<Highlight> {
  return apiRequest<Highlight>(`/api/books/${bookId}/highlights`, {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export async function updateHighlight(
  bookId: string,
  highlightId: string,
  data: { note?: string; color?: string },
  token: string,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/api/books/${bookId}/highlights/${highlightId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  });
}

export async function deleteHighlight(
  bookId: string,
  highlightId: string,
  token: string,
): Promise<void> {
  await apiRequest<void>(`/api/books/${bookId}/highlights/${highlightId}`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchComments(bookId: string, token: string): Promise<Comment[]> {
  return apiRequest<Comment[]>(`/api/books/${bookId}/comments`, {
    method: 'GET',
    token,
  });
}

export async function createComment(
  bookId: string,
  data: {
    chapterRef?: string;
    cfiRange?: string;
    selectedText?: string;
    body: string;
    visibility?: string;
    parentCommentId?: string;
  },
  token: string,
): Promise<Comment> {
  return apiRequest<Comment>(`/api/books/${bookId}/comments`, {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export async function updateComment(
  commentId: string,
  data: { body?: string; status?: string; visibility?: string },
  token: string,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/api/comments/${commentId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(data),
  });
}
