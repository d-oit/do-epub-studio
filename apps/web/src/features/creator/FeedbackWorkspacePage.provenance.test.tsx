import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FeedbackWorkspacePage } from './FeedbackWorkspacePage';
import { useCreatorStore } from '../../stores/creator-feedback';
import type { FeedbackItem } from '../../lib/api/feedback';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector: (s: { sessionToken: string }) => unknown) =>
    selector({ sessionToken: 'token' }),
}));

vi.mock('../../lib/api/creator', async () => {
  const actual = await import('../../lib/api/creator');
  return {
    ...actual,
    fetchCreatorFeedback: vi.fn(),
    fetchCreatorFeedbackDetail: vi.fn(),
    replyAsCreator: vi.fn(),
    setDisposition: vi.fn(),
    exportFeedback: vi.fn(),
    fetchReferences: vi.fn().mockResolvedValue([]),
    fetchStyleProfile: vi.fn().mockResolvedValue(null),
    fetchAssistanceConsent: vi.fn().mockResolvedValue({ allowed: false, cloudQualified: false }),
    setAssistanceConsent: vi.fn(),
  };
});

import { fetchCreatorFeedback, fetchCreatorFeedbackDetail } from '../../lib/api/creator';

function item(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: 'f1',
    kind: 'suggestion',
    category: 'grammar',
    body: 'The passage drops the subject.',
    proposedText: null,
    anchor: { chapterRef: 'ch1.xhtml', cfi: 'epubcfi(/6/2)', selectedText: 'The lamplighter w' },
    status: 'open',
    replyCount: 0,
    replies: [],
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

async function renderWorkspace(): Promise<void> {
  render(
    <MemoryRouter initialEntries={['/creator/books/b1/feedback']}>
      <Routes>
        <Route path="/creator/books/:bookId/feedback" element={<FeedbackWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(useCreatorStore.getState().items.length).toBe(1));
}

describe('FeedbackWorkspacePage provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreatorStore.setState({
      books: [{ id: 'b1', slug: 'demo', title: 'Demo Book' }],
      items: [],
      selectedId: null,
      isLoading: false,
      error: null,
    });
  });

  it('labels the anchor state and the reference drift for the reviewer', async () => {
    vi.mocked(fetchCreatorFeedback).mockResolvedValue([
      item({ anchorState: 'source_changed', referencesDrifted: true }),
    ]);
    vi.mocked(fetchCreatorFeedbackDetail).mockResolvedValue(
      item({ anchorState: 'source_changed', referencesDrifted: true }),
    );

    await renderWorkspace();
    fireEvent.click(screen.getByText('The passage drops the subject.'));

    await waitFor(() => {
      expect(screen.getByText('ref.anchorSourceChanged')).toBeInTheDocument();
    });
    expect(screen.getByText('ref.revisionDrifted')).toBeInTheDocument();
    expect(screen.queryByText('ref.anchorResolved')).not.toBeInTheDocument();
  });

  it('shows a resolved anchor without a drift marker when nothing moved', async () => {
    vi.mocked(fetchCreatorFeedback).mockResolvedValue([
      item({ anchorState: 'resolved', referencesDrifted: false }),
    ]);
    vi.mocked(fetchCreatorFeedbackDetail).mockResolvedValue(
      item({ anchorState: 'resolved', referencesDrifted: false }),
    );

    await renderWorkspace();
    fireEvent.click(screen.getByText('The passage drops the subject.'));

    await waitFor(() => {
      expect(screen.getByText('ref.anchorResolved')).toBeInTheDocument();
    });
    expect(screen.queryByText('ref.revisionDrifted')).not.toBeInTheDocument();
    expect(screen.queryByText('ref.anchorSourceChanged')).not.toBeInTheDocument();
  });
});
