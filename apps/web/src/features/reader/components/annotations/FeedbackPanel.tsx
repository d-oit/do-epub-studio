import { useState } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { TranslationKeys } from '../../../../i18n/en';
import type { FeedbackItem, FeedbackStatus } from '../../../../lib/api/feedback';

const STATUS_LABEL: Record<FeedbackStatus, TranslationKeys> = {
  open: 'feedback.statusOpen',
  accepted: 'feedback.statusAccepted',
  declined: 'feedback.statusDeclined',
  resolved: 'feedback.statusResolved',
  withdrawn: 'feedback.withdrawn',
};

interface FeedbackPanelProps {
  items: FeedbackItem[];
  loadError: boolean;
  onWithdraw: (id: string) => void;
  onRetry: (draftItemId: string) => void;
  onReply: (id: string, text: string) => void;
  onNavigateToAnchor?: (chapterRef: string, cfi?: string) => void;
}

export function FeedbackPanel({ items, loadError, onWithdraw, onRetry, onReply, onNavigateToAnchor }: FeedbackPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  if (loadError && items.length === 0) {
    return <p role="alert" className="p-4 text-sm text-foreground-muted">{t('feedback.loadError')}</p>;
  }

  if (items.length === 0) {
    return <p className="p-4 text-sm text-foreground-muted">{t('feedback.noFeedback')}</p>;
  }

  return (
    <ul className="space-y-3 p-4">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <span className="font-medium">
              {t(item.kind === 'comment' ? 'feedback.kindComment' : 'feedback.kindSuggestion')}
            </span>
            <span aria-label={t(STATUS_LABEL[item.status])} className="rounded-full bg-background-secondary px-2 py-0.5">
              {t(STATUS_LABEL[item.status])}
            </span>
            {item.delivery && item.delivery !== 'sent' && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                {item.delivery === 'pending' ? t('feedback.pendingBadge') : item.delivery}
              </span>
            )}
          </div>

          {item.anchor.selectedText && (
            <blockquote className="mt-2 border-l-2 border-accent pl-2 text-sm text-foreground-muted line-clamp-3">
              {item.anchor.selectedText}
            </blockquote>
          )}
          <p className="mt-2 text-sm text-foreground">{item.body}</p>
          {item.proposedText && (
            <p className="mt-1 text-sm text-foreground">
              <span className="font-medium">{t('creator.proposedLabel')}: </span>
              {item.proposedText}
            </p>
          )}

          {item.replies.length > 0 && (
            <ul className="mt-2 space-y-1 border-l-2 border-border pl-3">
              {item.replies.map((reply) => (
                <li key={reply.id} className="text-sm">
                  <span className="text-xs text-foreground-muted">
                    {reply.authorRole === 'creator' ? t('creator.title') : t('feedback.kindComment')} ·{' '}
                  </span>
                  {reply.body}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            {item.anchor.chapterRef && onNavigateToAnchor && (
              <button
                type="button"
                onClick={() => onNavigateToAnchor(item.anchor.chapterRef as string, item.anchor.cfi ?? undefined)}
                className="text-xs text-accent underline underline-offset-2"
              >
                {item.anchor.chapterRef}
              </button>
            )}
            {item.delivery === 'failed' || item.delivery === 'blocked' ? (
              <button
                type="button"
                onClick={() => void onRetry(item.id)}
                className="text-xs font-medium text-accent underline underline-offset-2"
              >
                {t('feedback.retry')}
              </button>
            ) : null}
            {item.status !== 'withdrawn' && !item.id.startsWith('draft:') && (
              <button
                type="button"
                onClick={() => void onWithdraw(item.id)}
                className="text-xs text-foreground-muted underline underline-offset-2"
              >
                {t('feedback.withdraw')}
              </button>
            )}
            {!item.id.startsWith('draft:') && item.status !== 'withdrawn' && (
              replyingTo === item.id ? (
                <span className="flex w-full gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t('creator.replyPlaceholder')}
                    aria-label={t('creator.replyPlaceholder')}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (replyText.trim()) {
                        void onReply(item.id, replyText.trim());
                        setReplyText('');
                        setReplyingTo(null);
                      }
                    }}
                    className="text-xs font-medium text-accent"
                  >
                    {t('feedback.submit')}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setReplyingTo(item.id)}
                  className="text-xs text-foreground-muted underline underline-offset-2"
                >
                  {t('comment.reply')}
                </button>
              )
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
