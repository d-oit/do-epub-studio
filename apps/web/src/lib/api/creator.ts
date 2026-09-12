import { apiRequest } from './core';
import type {
  FeedbackCategory,
  FeedbackItem,
  FeedbackStatus,
} from './feedback';

export interface CreatorBook {
  id: string;
  slug: string;
  title: string;
}

export type Disposition = 'accepted' | 'declined' | 'resolved' | 'open';

export async function fetchCreatorBooks(token: string): Promise<CreatorBook[]> {
  return apiRequest<CreatorBook[]>(`/api/creator/books`, {
    method: 'GET',
    token,
  });
}

export async function fetchCreatorFeedback(
  bookId: string,
  token: string,
  query: { status?: FeedbackStatus; category?: FeedbackCategory } = {},
): Promise<FeedbackItem[]> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.category) params.set('category', query.category);
  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest<FeedbackItem[]>(
    `/api/creator/books/${bookId}/feedback${suffix}`,
    { method: 'GET', token },
  );
}

export async function fetchCreatorFeedbackDetail(
  bookId: string,
  id: string,
  token: string,
): Promise<FeedbackItem> {
  return apiRequest<FeedbackItem>(
    `/api/creator/books/${bookId}/feedback/${id}`,
    { method: 'GET', token },
  );
}

export async function replyAsCreator(
  bookId: string,
  id: string,
  body: string,
  token: string,
): Promise<FeedbackItem> {
  return apiRequest<FeedbackItem>(
    `/api/creator/books/${bookId}/feedback/${id}/replies`,
    { method: 'POST', token, body: JSON.stringify({ body }) },
  );
}

export async function setDisposition(
  bookId: string,
  id: string,
  disposition: Disposition,
  token: string,
): Promise<FeedbackItem> {
  return apiRequest<FeedbackItem>(
    `/api/creator/books/${bookId}/feedback/${id}/disposition`,
    { method: 'POST', token, body: JSON.stringify({ disposition }) },
  );
}

export async function exportFeedback(
  bookId: string,
  ids: string[],
  token: string,
): Promise<{ items: FeedbackItem[] }> {
  return apiRequest<{ items: FeedbackItem[] }>(
    `/api/creator/books/${bookId}/export`,
    { method: 'POST', token, body: JSON.stringify({ ids }) },
  );
}

// ── Wave 3 (COL-03): references & style profile ─────────────────────────

export type ReferenceKind =
  | 'style_excerpt'
  | 'glossary_term'
  | 'character_note'
  | 'fact_note'
  | 'chronology_note'
  | 'external_citation';
export type ReferenceOrigin = 'book' | 'creator' | 'external';

export interface BookReference {
  id: string;
  kind: ReferenceKind;
  title: string | null;
  content: string;
  attribution: string | null;
  sourceUrl: string | null;
  origin: ReferenceOrigin;
  verified: boolean;
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceCreateInput {
  kind: ReferenceKind;
  title?: string;
  content: string;
  sourceUrl?: string;
  origin: ReferenceOrigin;
}

export interface StyleProfileData {
  language: string | null;
  narrativePerson: string | null;
  tense: string | null;
  dialogueConventions: string | null;
  dialectNotes: string | null;
  terminology: string | null;
  intentionalExceptions: string | null;
  status: 'draft' | 'approved';
  approvedBy: string | null;
  approvedAt: string | null;
  revision: number;
}

export async function fetchReferences(
  bookId: string,
  token: string,
  kind?: ReferenceKind,
): Promise<BookReference[]> {
  const suffix = kind ? `?kind=${kind}` : '';
  return apiRequest<BookReference[]>(
    `/api/creator/books/${bookId}/references${suffix}`,
    { method: 'GET', token },
  );
}

export async function createReference(
  bookId: string,
  data: ReferenceCreateInput,
  token: string,
): Promise<BookReference> {
  return apiRequest<BookReference>(`/api/creator/books/${bookId}/references`, {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  });
}

export async function updateReference(
  bookId: string,
  id: string,
  data: { title?: string; content?: string },
  token: string,
): Promise<BookReference> {
  return apiRequest<BookReference>(
    `/api/creator/books/${bookId}/references/${id}`,
    { method: 'PATCH', token, body: JSON.stringify(data) },
  );
}

export async function deleteReference(
  bookId: string,
  id: string,
  token: string,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(
    `/api/creator/books/${bookId}/references/${id}`,
    { method: 'DELETE', token },
  );
}

export async function verifyReference(
  bookId: string,
  id: string,
  verified: boolean,
  evidenceNote: string,
  token: string,
): Promise<BookReference> {
  return apiRequest<BookReference>(
    `/api/creator/books/${bookId}/references/${id}/verify`,
    { method: 'POST', token, body: JSON.stringify({ verified, evidenceNote }) },
  );
}

export async function fetchStyleProfile(
  bookId: string,
  token: string,
): Promise<StyleProfileData | null> {
  return apiRequest<StyleProfileData | null>(`/api/creator/books/${bookId}/style`, {
    method: 'GET',
    token,
  });
}

export async function saveStyleProfile(
  bookId: string,
  data: Omit<StyleProfileData, 'approvedBy' | 'approvedAt' | 'revision'>,
  token: string,
): Promise<{ bookId: string; status: string; approvedBy: string | null; approvedAt: string | null; revision: number }> {
  return apiRequest(`/api/creator/books/${bookId}/style`, {
    method: 'PUT',
    token,
    body: JSON.stringify(data),
  });
}

export function downloadExport(bookSlug: string, items: FeedbackItem[]): void {
  const lines: string[] = [
    `# Editorial feedback export — ${bookSlug}`,
    `# Exported ${new Date().toISOString()}`,
    '',
  ];
  for (const item of items) {
    lines.push(`## [${item.kind}/${item.category}] ${item.status}`);
    const anchor = item.anchor;
    if (anchor.chapterRef) lines.push(`Chapter: ${anchor.chapterRef}`);
    if (anchor.cfi) lines.push(`CFI: ${anchor.cfi}`);
    if (anchor.selectedText) lines.push(`> ${anchor.selectedText}`);
    lines.push('');
    lines.push(item.body);
    if (item.proposedText) {
      lines.push('');
      lines.push(`Proposed: ${item.proposedText}`);
    }
    for (const reply of item.replies ?? []) {
      lines.push('');
      lines.push(`Reply (${reply.authorRole}): ${reply.body}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `feedback-${bookSlug}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


export interface CreatorAssignment {
  email: string;
  assignedAt: string;
}

export async function fetchCreatorAssignments(
  bookId: string,
  token: string,
): Promise<CreatorAssignment[]> {
  return apiRequest<CreatorAssignment[]>(`/api/admin/books/${bookId}/creators`, {
    method: 'GET',
    token,
  });
}

export async function assignCreator(
  bookId: string,
  email: string,
  token: string,
): Promise<{ bookId: string; email: string; alreadyAssigned: boolean }> {
  return apiRequest(`/api/admin/books/${bookId}/creators`, {
    method: 'POST',
    token,
    body: JSON.stringify({ email }),
  });
}

export async function revokeCreator(
  bookId: string,
  email: string,
  token: string,
): Promise<{ bookId: string; email: string }> {
  return apiRequest(`/api/admin/books/${bookId}/creators`, {
    method: 'DELETE',
    token,
    body: JSON.stringify({ email }),
  });
}
