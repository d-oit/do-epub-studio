import { HighlightToolbarLayer } from './HighlightToolbarLayer';
import type { SelectionData } from './AnnotationToolbar';
import { FeedbackComposerModal } from './FeedbackComposerModal';
import { CommentInputModal } from '../comment/CommentInputModal';
import type { SupportedLocale } from '../../../../stores/locale';
import type { UseFeedbackComposerResult } from '../../hooks/useFeedbackComposer';

interface SelectionOverlaysProps {
  selection: SelectionData | null;
  canHighlight: boolean;
  canComment: boolean;
  locale: SupportedLocale;
  showCommentInput: boolean;
  t: (key: string) => string;
  onHighlight: (color: string, selection: SelectionData) => Promise<void>;
  onCreateComment: (text: string, selection: SelectionData | null) => Promise<void>;
  feedback: UseFeedbackComposerResult;
  onStartComment: () => void;
  onCancel: () => void;
  onFeedbackCleared: () => void;
}

/**
 * Inline annotation tools driven by a text selection: the highlight toolbar,
 * the comment input modal, and the feedback composer. Extracted from ReaderPage
 * so the page stays focused on orchestration.
 */
export function SelectionOverlays({
  selection,
  canHighlight,
  canComment,
  locale,
  showCommentInput,
  t,
  feedback,
  onHighlight,
  onCreateComment,
  onStartComment,
  onCancel,
  onFeedbackCleared,
}: SelectionOverlaysProps) {
  return (
    <>
      {selection && canHighlight && (
        <HighlightToolbarLayer
          selection={selection}
          canHighlight={canHighlight}
          canComment={canComment}
          locale={locale}
          onHighlight={onHighlight}
          onComment={onStartComment}
          onFeedback={(kind) => feedback.openComposer(kind, selection)}
          onClose={onCancel}
        />
      )}
      <CommentInputModal
        isOpen={showCommentInput && !!selection}
        selection={selection}
        onSubmit={async (text) => {
          await onCreateComment(text, selection);
          onCancel();
        }}
        onCancel={onCancel}
        placeholder={t('comment.placeholder')}
        submitLabel={t('annotation.comment')}
      />
      <FeedbackComposerModal
        isOpen={feedback.composerOpen && !!feedback.composerSelection}
        kind={feedback.composerKind}
        selection={feedback.composerSelection}
        submitting={feedback.submitting}
        serverError={feedback.composerError}
        onKindChange={(kind) => {
          if (feedback.composerSelection) feedback.openComposer(kind, feedback.composerSelection);
        }}
        onSubmit={(input) => {
          if (!feedback.composerSelection) return;
          void feedback
            .submit({ ...input, selection: feedback.composerSelection })
            .then(() => {
              feedback.closeComposer();
              onFeedbackCleared();
            })
            .catch(() => undefined);
        }}
        onClose={() => {
          feedback.closeComposer();
        }}
      />
    </>
  );
}
