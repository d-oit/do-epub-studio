import { apiRequest } from './core';

export type FeedbackKind = 'comment' | 'suggestion';
export type FeedbackCategory =
  | 'general'
  | 'grammar'
  | 'spelling'
  | 'story'
  | 'logic'
  | 'style';
export type FeedbackStatus =
  | 'open'
  | 'accepted'
  | 'declined'
  | 'resolved'
  | 'withdrawn';
export type FeedbackDelivery = 'draft' | 'pending' | 'sent' | 'failed' | 'blocked';

export interface FeedbackAnchor {
  bookFileId?: string;
  chapterRef?: string;
  cfi?: string;
  selectedText: string;
  prefix?: string;
  suffix?: string;
}

export interface FeedbackReply {
  id: string;
  body: string;
  authorRole: 'reader' | 'creator';
  authorEmail?: string;
  isOwn?: boolean;
  createdAt: string;
}

export interface FeedbackEvent {
  actorEmail: string;
  event: string;
  createdAt: string;
}

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  category: FeedbackCategory;
  body: string;
  proposedText: string | null;
  anchor: FeedbackAnchor;
  status: FeedbackStatus;
  submitterEmail?: string;
  displayName?: string;
  isOwn?: boolean;
  replyCount: number;
  replies: FeedbackReply[];
  events?: FeedbackEvent[];
  createdAt: string;
  updatedAt: string;
  /** Local-only delivery state; never sent to the server. */
  delivery?: FeedbackDelivery;
}

export interface FeedbackCreateInput {
  kind: FeedbackKind;
  category: FeedbackCategory;
  body: string;
  proposedText?: string;
  anchor: FeedbackAnchor;
  mutationId: string;
}

export async function createFeedback(
  bookId: string,
  data: FeedbackCreateInput,
  token: string,
): Promise<FeedbackItem> {
  return apiRequest<FeedbackItem>(`/api/books/${bookId}/feedback`, {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export async function fetchOwnFeedback(
  bookId: string,
  token: string,
  query: { status?: FeedbackStatus; category?: FeedbackCategory } = {},
): Promise<FeedbackItem[]> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.category) params.set('category', query.category);
  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest<FeedbackItem[]>(`/api/books/${bookId}/feedback${suffix}`, {
    method: 'GET',
    token,
  });
}

export async function fetchFeedbackDetail(
  bookId: string,
  id: string,
  token: string,
): Promise<FeedbackItem> {
  return apiRequest<FeedbackItem>(`/api/books/${bookId}/feedback/${id}`, {
    method: 'GET',
    token,
  });
}

export async function withdrawFeedback(
  bookId: string,
  id: string,
  token: string,
): Promise<FeedbackItem> {
  return apiRequest<FeedbackItem>(`/api/books/${bookId}/feedback/${id}/withdraw`, {
    method: 'POST',
    token,
  });
}

export async function replyToFeedback(
  bookId: string,
  id: string,
  body: string,
  token: string,
): Promise<FeedbackItem> {
  return apiRequest<FeedbackItem>(`/api/books/${bookId}/feedback/${id}/replies`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  });
}
