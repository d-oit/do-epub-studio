import { useState, useCallback } from 'react';
import type { Comment, Highlight } from '../../../../stores';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { TranslationKeys } from '../../../../i18n';

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

  const openComments = comments.filter((c) => c.status === 'open');
  const resolvedComments = comments.filter((c) => c.status === 'resolved');

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 z-40 flex flex-col shadow-xl">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="font-semibold">{t('annotation.comment')}s</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
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

      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'comments'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          {t('annotation.comment')} ({openComments.length})
        </button>
        <button
          onClick={() => setActiveTab('highlights')}
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'highlights'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          {t('annotation.highlight')} ({highlights.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'comments' && (
          <div className="space-y-4">
            {openComments.length === 0 && resolvedComments.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                {t('comment.noComments')}
              </p>
            )}
            {openComments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase">Open</h3>
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
                <h3 className="text-xs font-semibold text-gray-500 uppercase">Resolved</h3>
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
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
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

interface CommentItemProps {
  comment: Comment;
  isCurrentChapter: boolean;
  replyingTo: string | null;
  replyText: string;
  setReplyingTo: (id: string | null) => void;
  setReplyText: (text: string) => void;
  handleReply: (id: string) => void;
  editingComment: string | null;
  editText: string;
  setEditingComment: (id: string | null) => void;
  setEditText: (text: string) => void;
  handleEdit: (id: string) => void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: () => void;
  t: (key: TranslationKeys) => string;
}

function CommentItem({
  comment,
  isCurrentChapter,
  replyingTo,
  replyText,
  setReplyingTo,
  setReplyText,
  handleReply,
  editingComment,
  editText,
  setEditingComment,
  setEditText,
  handleEdit,
  onResolve,
  onDelete,
  onNavigate,
  t,
}: CommentItemProps) {
  const [showActions, setShowActions] = useState(false);

  const isEditing = editingComment === comment.id;
  const isReplying = replyingTo === comment.id;

  return (
    <div
      className={`p-3 rounded-lg border ${
        isCurrentChapter
          ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {comment.selectedText && (
        <blockquote
          className="text-xs text-gray-600 dark:text-gray-400 italic mb-2 cursor-pointer hover:text-primary-600"
          onClick={onNavigate}
        >
          "{comment.selectedText.slice(0, 100)}
          {comment.selectedText.length > 100 ? '...' : ''}"
        </blockquote>
      )}

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            rows={2}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: textarea appears conditionally on user action, auto-focusing improves editing workflow
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(comment.id)}
              className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Save
            </button>
            <button
              onClick={() => setEditingComment(null)}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-900 dark:text-gray-100">{comment.body}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {comment.userEmail} · {formatDate(comment.createdAt)}
            </span>
            {comment.status === 'resolved' && (
              <span className="text-xs text-green-600 dark:text-green-400">{t('comment.resolved')}</span>
            )}
          </div>
        </>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 pl-3 border-l-2 border-gray-200 dark:border-gray-700 space-y-2">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="text-sm">
              <p className="text-gray-900 dark:text-gray-100">{reply.body}</p>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {reply.userEmail} · {formatDate(reply.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {isReplying ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            rows={2}
            placeholder={t('comment.reply')}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: textarea appears conditionally on user action, auto-focusing improves reply workflow
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleReply(comment.id)}
              className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              {t('comment.reply')}
            </button>
            <button
              onClick={() => setReplyingTo(null)}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {t('annotation.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {showActions && !isEditing && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              setReplyingTo(comment.id);
              setReplyText('');
            }}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            {t('comment.reply')}
          </button>
          <button
            onClick={() => {
              setEditingComment(comment.id);
              setEditText(comment.body);
            }}
            className="text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400"
          >
            {t('comment.edit')}
          </button>
          <button
            onClick={() => onResolve(comment.id)}
            className="text-xs text-green-600 hover:text-green-700"
          >
            {comment.status === 'resolved' ? t('comment.unresolve') : t('comment.resolve')}
          </button>
          <button
            onClick={() => onDelete(comment.id)}
            className="text-xs text-red-600 hover:text-red-700"
          >
            {t('comment.delete')}
          </button>
        </div>
      )}
    </div>
  );
}

interface HighlightItemProps {
  highlight: Highlight;
  isCurrentChapter: boolean;
  editingHighlight: string | null;
  highlightNote: string;
  setEditingHighlight: (id: string | null) => void;
  setHighlightNote: (text: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: () => void;
}

function HighlightItem({
  highlight,
  isCurrentChapter,
  editingHighlight,
  highlightNote,
  setEditingHighlight,
  setHighlightNote,
  onEdit,
  onDelete,
  onNavigate,
}: HighlightItemProps) {
  const [showActions, setShowActions] = useState(false);
  const isEditing = editingHighlight === highlight.id;

  return (
    <div
      className={`p-3 rounded-lg border ${
        isCurrentChapter
          ? 'border-primary-300 dark:border-primary-700'
          : 'border-gray-200 dark:border-gray-700'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className="text-sm text-gray-900 dark:text-gray-100 cursor-pointer hover:text-primary-600"
        onClick={onNavigate}
        style={{ backgroundColor: highlight.color + '60', padding: '2px 4px', borderRadius: '2px' }}
      >
        {highlight.selectedText.slice(0, 150)}
        {highlight.selectedText.length > 150 ? '...' : ''}
      </div>

      {highlight.note && !isEditing && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{highlight.note}</p>
      )}

      {isEditing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={highlightNote}
            onChange={(e) => setHighlightNote(e.target.value)}
            className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            rows={2}
            placeholder="Add a note..."
            // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: textarea appears conditionally on user action, auto-focusing improves note-adding workflow
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(highlight.id)}
              className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Save
            </button>
            <button
              onClick={() => setEditingHighlight(null)}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(highlight.createdAt)}
            </span>
          </div>
          {showActions && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  setEditingHighlight(highlight.id);
                  setHighlightNote(highlight.note || '');
                }}
                className="text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400"
              >
                Edit Note
              </button>
              <button
                onClick={() => onDelete(highlight.id)}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
