import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackComposerModal } from './FeedbackComposerModal';

vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const selection = { text: 'the first boat was late', cfiRange: 'epubcfi(/6/2!/4/8,/1:2,/1:53)', chapterRef: 'ch1.xhtml' };

const baseProps = {
  isOpen: true,
  kind: 'suggestion' as const,
  submitting: false,
  serverError: null,
  onKindChange: vi.fn(),
  onSubmit: vi.fn(),
  onClose: vi.fn(),
};

describe('FeedbackComposerModal', () => {
  it('keeps typed text when the parent passes an equivalent new selection object', () => {
    const { rerender } = render(<FeedbackComposerModal {...baseProps} selection={selection} />);
    const explanation = screen.getAllByRole('textbox')[0];
    fireEvent.change(explanation, { target: { value: 'Tense slips here.' } });
    expect(explanation).toHaveValue('Tense slips here.');

    // Opening/kind changes hand the modal a fresh selection object; an equal
    // object must not be treated as a different passage and wipe the draft.
    rerender(<FeedbackComposerModal {...baseProps} selection={{ ...selection }} />);

    expect(screen.getAllByRole('textbox')[0]).toHaveValue('Tense slips here.');
  });

  it('starts a fresh draft when the kind changes', () => {
    const { rerender } = render(<FeedbackComposerModal {...baseProps} selection={selection} />);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Tense slips here.' } });

    rerender(<FeedbackComposerModal {...baseProps} kind="comment" selection={selection} />);

    expect(screen.getAllByRole('textbox')[0]).toHaveValue('');
  });
});
