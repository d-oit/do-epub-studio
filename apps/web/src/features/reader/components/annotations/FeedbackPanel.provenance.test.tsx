import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeedbackPanel } from './FeedbackPanel';
import type { FeedbackItem } from '../../../../lib/api/feedback';

vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en' }),
}));

function item(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: 'f1',
    kind: 'suggestion',
    category: 'grammar',
    body: 'The passage drops the subject.',
    proposedText: 'The lamplighter walked the harbour wall.',
    anchor: { chapterRef: 'ch1.xhtml', cfi: 'epubcfi(/6/2)', selectedText: 'The lamplighter w' },
    status: 'open',
    replyCount: 0,
    replies: [],
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

function renderPanel(items: FeedbackItem[]): void {
  render(
    <FeedbackPanel
      items={items}
      loadError={false}
      onWithdraw={() => {}}
      onRetry={() => {}}
      onReply={() => {}}
    />,
  );
}

describe('FeedbackPanel provenance', () => {
  it('warns when the passage source moved and when pinned references were edited', () => {
    renderPanel([item({ anchorState: 'source_changed', referencesDrifted: true })]);

    expect(screen.getByText('ref.anchorSourceChanged')).toBeInTheDocument();
    expect(screen.getByText('ref.revisionDrifted')).toBeInTheDocument();
    expect(screen.queryByText('ref.anchorResolved')).not.toBeInTheDocument();
  });

  it('marks an item with no source identity instead of implying one', () => {
    renderPanel([item({ anchorState: 'unresolved' })]);

    expect(screen.getByText('ref.anchorUnresolved')).toBeInTheDocument();
    expect(screen.queryByText('ref.revisionDrifted')).not.toBeInTheDocument();
  });

  it('stays quiet on a healthy item', () => {
    renderPanel([item({ anchorState: 'resolved', referencesDrifted: false })]);

    expect(screen.queryByText('ref.anchorSourceChanged')).not.toBeInTheDocument();
    expect(screen.queryByText('ref.anchorUnresolved')).not.toBeInTheDocument();
    expect(screen.queryByText('ref.revisionDrifted')).not.toBeInTheDocument();
  });
});
