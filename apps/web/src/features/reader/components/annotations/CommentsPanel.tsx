import { useState, useCallback, useMemo, useRef, Fragment } from 'react';
import { useKeyboardShortcut } from '../../../../hooks/useKeyboardShortcut';
import { Tabs, type TabItem, useFocusTrap } from '@do-epub-studio/ui';
import { IconButton } from '../../../../components/ui';
import type { Comment, Highlight } from '../../../../stores';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { SupportedLocale } from '../../../../stores/locale';
import { CommentItem } from './CommentItem';
import { HighlightItem } from './HighlightItem';
import { VirtualList } from '../../../../components/VirtualList';

interface CommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  comments: Comment[];
  highlights: Highlight[];
  onResolveComment: (commentId: string) => void;
  onReplyToComment: (commentId: string, text: string) => void;
  onEditComment: (commentId: string, text: string) => void;
  onDeleteComment: (commentId: string) => void;
  onEditHighlight: (highlightId: string, note: string) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onNavigateToAnnotation: (chapterRef: string, cfiRange?: string) => void;
  currentChapter: string | null;
  locale: SupportedLocale;
}

// Comments are variable-height cards (short one-liners to multi-paragraph
// replies), so we never virtualize them — non-virtual rendering avoids
// overlap and truncation issues. Highlights are more uniform and safe to
// virtualize above this threshold.
const HIGHLIGHT_VIRTUALIZE_THRESHOLD = 30;
const HIGHLIGHT_ITEM_HEIGHT = 96; // px-3 py-2 + multi-line note preview

export function CommentsPanel({
  isOpen,
  onClose,
  comments,
  highlights,
  onResolveComment,
  onReplyToComment,
  onEditComment,
  onDeleteComment,
  onEditHighlight,
  onDeleteHighlight,
  onNavigateToAnnotation,
  currentChapter,
}: CommentsPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(isOpen, panelRef);

  useKeyboardShortcut('Escape', onClose, { enabled: isOpen });

  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'comments' | 'highlights'>('comments');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editingHighlight, setEditingHighlight] = useState<string | null>(null);
  const [highlightNote, setHighlightNote] = useState('');

  const handleReply = useCallback(
    (commentId: string) => {
      if (replyText.trim()) {
        onReplyToComment(commentId, replyText);
        setReplyText('');
        setReplyingTo(null);
      }
    },
    [replyText, onReplyToComment],
  );

  const handleEdit = useCallback(
    (commentId: string) => {
      if (editText.trim()) {
        onEditComment(commentId, editText);
        setEditText('');
        setEditingComment(null);
      }
    },
    [editText, onEditComment],
  );

  const handleEditHighlight = useCallback(
    (highlightId: string) => {
      onEditHighlight(highlightId, highlightNote);
      setHighlightNote('');
      setEditingHighlight(null);
    },
    [highlightNote, onEditHighlight],
  );

  const openComments = useMemo(() => comments.filter((c) => c.status === 'open'), [comments]);
  const resolvedComments = useMemo(
    () => comments.filter((c) => c.status === 'resolved'),
    [comments],
  );

  const renderComment = useCallback(
    (comment: Comment) => (
      <CommentItem
        comment={comment}
        isCurrentChapter={currentChapter === comment.chapterRef}
        replyingTo={replyingTo}
        replyText={replyText}
        setReplyingTo={setReplyingTo}
        setReplyText={setReplyText}
        handleReply={handleReply}
        editingComment={editingComment}
        editText={editText}
        setEditingComment={setEditingComment}
        setEditText={setEditText}
        handleEdit={handleEdit}
        onResolve={onResolveComment}
        onDelete={onDeleteComment}
        onNavigate={() => {
          onNavigateToAnnotation(comment.chapterRef || '', comment.cfiRange || undefined);
        }}
        t={t}
      />
    ),
    [
      currentChapter,
      replyingTo,
      replyText,
      editingComment,
      editText,
      handleReply,
      handleEdit,
      onResolveComment,
      onDeleteComment,
      onNavigateToAnnotation,
      t,
    ],
  );

  const renderHighlight = useCallback(
    (highlight: Highlight) => (
      <HighlightItem
        highlight={highlight}
        isCurrentChapter={currentChapter === highlight.chapterRef}
        editingHighlight={editingHighlight}
        highlightNote={highlightNote}
        setEditingHighlight={setEditingHighlight}
        setHighlightNote={setHighlightNote}
        onEdit={handleEditHighlight}
        onDelete={onDeleteHighlight}
        onNavigate={() => {
          onNavigateToAnnotation(highlight.chapterRef || '', highlight.cfiRange || undefined);
        }}
      />
    ),
    [
      currentChapter,
      editingHighlight,
      highlightNote,
      handleEditHighlight,
      onDeleteHighlight,
      onNavigateToAnnotation,
    ],
  );

  const tabItems: TabItem[] = useMemo(
    () => [
      {
        id: 'comments',
        label: `${t('annotation.comment')} (${openComments.length})`,
        content: (
          <div className="space-y-4">
            {openComments.length === 0 && resolvedComments.length === 0 && (
              <p className="text-sm text-foreground-muted text-center py-8">
                {t('comment.noComments')}
              </p>
            )}
            {openComments.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-foreground-muted uppercase mb-3">{t('comment.status.open')}</h3>
                <div className="space-y-3">
                  {openComments.map((comment) => (
                    <Fragment key={comment.id}>{renderComment(comment)}</Fragment>
                  ))}
                </div>
              </div>
            )}
            {resolvedComments.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold text-foreground-muted uppercase mb-3">{t('comment.status.resolved')}</h3>
                <div className="space-y-3">
                  {resolvedComments.map((comment) => (
                    <Fragment key={comment.id}>{renderComment(comment)}</Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'highlights',
        label: `${t('annotation.highlight')} (${highlights.length})`,
        content: (
          <div className="space-y-3">
            {highlights.length === 0 && (
              <p className="text-sm text-foreground-muted text-center py-8">
                {t('highlight.noHighlights')}
              </p>
            )}
            {highlights.length > 0 &&
              (highlights.length > HIGHLIGHT_VIRTUALIZE_THRESHOLD ? (
                <VirtualList
                  items={highlights}
                  itemHeight={HIGHLIGHT_ITEM_HEIGHT}
                  className="h-full"
                  renderItem={renderHighlight}
                  // codacy-suppress-next-line ESLint8_eslint_i18next/no-literal-string -- rule exists in project ESLint; Codacy lacks i18next plugin
                  // eslint-disable-next-line i18next/no-literal-string -- React camelCase aria attribute; ignoreAttribute config doesn't cover kebab-case
                  ariaLabel="Highlights"
                />
              ) : (
                highlights.map((highlight) => (
                  <Fragment key={highlight.id}>{renderHighlight(highlight)}</Fragment>
                ))
              ))}
          </div>
        ),
      },
    ],
    [openComments, resolvedComments, highlights, t, renderComment, renderHighlight],
  );

  if (!isOpen) return null;

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comments-title"
      className="fixed inset-y-0 right-0 w-80 bg-background border-l border-border z-40 flex flex-col shadow-xl"
    >
      <div className="p-4 border-b border-border flex justify-between items-center shrink-0">
        <h2 id="comments-title" className="font-semibold">{t('comment.plural')}</h2>
        <IconButton
          onClick={onClose}
          variant="ghost"
          aria-label={t('a11y.close')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </IconButton>
      </div>

      <Tabs
        items={tabItems}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as 'comments' | 'highlights')}
        ariaLabel={t('comment.plural')}
        className="flex-1 flex flex-col min-h-0"
        tabpanelClassName="flex-1 overflow-y-auto p-4 pt-4" /* eslint-disable-line i18next/no-literal-string -- Tailwind CSS class string */
      />
    </aside>
  );
}
