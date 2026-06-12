import { useState, memo } from 'react';
import type { Comment } from '../../../../stores';
import type { TranslationKeys } from '../../../../i18n';
import { formatDate } from './formatDate';

export interface CommentItemProps {
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

export const CommentItem = memo(function CommentItem({
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
      className={`p-3 rounded-lg border transition-colors ${
        isCurrentChapter
          ? 'border-accent/30 bg-accent/5'
          : 'border-border'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onFocus={() => setShowActions(true)}
      onBlur={() => setShowActions(false)}
      tabIndex={0}
    >
      {comment.selectedText && (
        <div
          className="text-xs text-foreground-muted italic mb-2 cursor-pointer hover:text-accent"
          onClick={onNavigate}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(); } }}
          tabIndex={0}
          role="button"
        >
          &ldquo;{comment.selectedText.slice(0, 100)}
          {comment.selectedText.length > 100 ? '...' : ''}&rdquo;
        </div>
      )}

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full p-2 text-sm border border-border rounded bg-background"
            rows={2}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: textarea appears conditionally on user action, auto-focusing improves editing workflow
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(comment.id)}
              className="px-2 py-1 text-xs bg-accent text-white rounded hover:opacity-90"
            >
              Save
            </button>
            <button
              onClick={() => setEditingComment(null)}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-background-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-foreground">{comment.body}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-foreground-muted">
              {comment.userEmail} · {formatDate(comment.createdAt)}
            </span>
            {comment.status === 'resolved' && (
              <span className="text-xs text-accent-success">{t('comment.resolved')}</span>
            )}
          </div>
        </>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 pl-3 border-l-2 border-border space-y-2">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="text-sm">
              <p className="text-foreground">{reply.body}</p>
              <span className="text-xs text-foreground-muted">
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
            className="w-full p-2 text-sm border border-border rounded bg-background"
            rows={2}
            placeholder={t('comment.reply')}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: textarea appears conditionally on user action, auto-focusing improves reply workflow
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleReply(comment.id)}
              className="px-2 py-1 text-xs bg-accent text-white rounded hover:opacity-90"
            >
              {t('comment.reply')}
            </button>
            <button
              onClick={() => setReplyingTo(null)}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-background-secondary"
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
            className="text-xs text-accent hover:opacity-80"
          >
            {t('comment.reply')}
          </button>
          <button
            onClick={() => {
              setEditingComment(comment.id);
              setEditText(comment.body);
            }}
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            {t('comment.edit')}
          </button>
          <button
            onClick={() => onResolve(comment.id)}
            className="text-xs text-accent-success hover:opacity-80"
          >
            {comment.status === 'resolved' ? t('comment.unresolve') : t('comment.resolve')}
          </button>
          <button
            onClick={() => onDelete(comment.id)}
            className="text-xs text-accent-error hover:opacity-80"
          >
            {t('comment.delete')}
          </button>
        </div>
      )}
    </div>
  );
});
