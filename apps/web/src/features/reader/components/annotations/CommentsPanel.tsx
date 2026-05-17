import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useFocusTrap } from '@do-epub-studio/ui';
import type { Comment, Highlight } from '../../../../stores';
import { useTranslation } from '../../../../hooks/useTranslation';
import { CommentItem } from './CommentItem';
import { HighlightItem } from './HighlightItem';

type SupportedLocale = 'en' | 'de' | 'fr';

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

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

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

  if (!isOpen) return null;

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comments-title"
      className="fixed inset-y-0 right-0 w-80 bg-background border-l border-border z-40 flex flex-col shadow-xl"
    >
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h2 id="comments-title" className="font-semibold">{t('annotation.comment')}s</h2>
        <button type="button" onClick={onClose} className="p-1 hover:bg-background-secondary rounded" aria-label={t('reader.settings.close') as string}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'comments'
              ? 'border-b-2 border-accent text-accent'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          {t('annotation.comment')} ({openComments.length})
        </button>
        <button
          onClick={() => setActiveTab('highlights')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'highlights'
              ? 'border-b-2 border-accent text-accent'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          {t('annotation.highlight')} ({highlights.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'comments' && (
          <div className="space-y-4">
            {openComments.length === 0 && resolvedComments.length === 0 && (
              <p className="text-sm text-foreground-muted text-center py-8">
                {t('comment.noComments')}
              </p>
            )}
            {openComments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-foreground-muted uppercase">Open</h3>
                {openComments.map((comment) => (
                  <CommentItem
                    key={comment.id}
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
                    onNavigate={() =>
                      onNavigateToAnnotation(
                        comment.chapterRef || '',
                        comment.cfiRange || undefined,
                      )
                    }
                    t={t}
                  />
                ))}
              </div>
            )}
            {resolvedComments.length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="text-xs font-semibold text-foreground-muted uppercase">Resolved</h3>
                {resolvedComments.map((comment) => (
                  <CommentItem
                    key={comment.id}
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
                    onNavigate={() =>
                      onNavigateToAnnotation(
                        comment.chapterRef || '',
                        comment.cfiRange || undefined,
                      )
                    }
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'highlights' && (
          <div className="space-y-3">
            {highlights.length === 0 && (
              <p className="text-sm text-foreground-muted text-center py-8">
                {t('highlight.noHighlights')}
              </p>
            )}
            {highlights.map((highlight) => (
              <HighlightItem
                key={highlight.id}
                highlight={highlight}
                isCurrentChapter={currentChapter === highlight.chapterRef}
                editingHighlight={editingHighlight}
                highlightNote={highlightNote}
                setEditingHighlight={setEditingHighlight}
                setHighlightNote={setHighlightNote}
                onEdit={handleEditHighlight}
                onDelete={onDeleteHighlight}
                onNavigate={() =>
                  onNavigateToAnnotation(
                    highlight.chapterRef || '',
                    highlight.cfiRange || undefined,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
