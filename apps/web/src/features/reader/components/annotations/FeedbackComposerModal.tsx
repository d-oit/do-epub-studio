import { useEffect, useState } from 'react';
import { Modal } from '@do-epub-studio/ui';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { TranslationKeys } from '../../../../i18n/en';
import type {
  FeedbackCategory,
  FeedbackKind,
} from '../../../../lib/api/feedback';
import type { ComposerSelection } from '../../hooks/useFeedbackComposer';

const CATEGORIES: Array<{ id: FeedbackCategory; label: TranslationKeys }> = [
  { id: 'general', label: 'feedback.catGeneral' },
  { id: 'grammar', label: 'feedback.catGrammar' },
  { id: 'spelling', label: 'feedback.catSpelling' },
  { id: 'story', label: 'feedback.catStory' },
  { id: 'logic', label: 'feedback.catLogic' },
  { id: 'style', label: 'feedback.catStyle' },
];

const COMPOSER_KINDS = ['comment', 'suggestion'] as const;

interface FeedbackComposerModalProps {
  isOpen: boolean;
  kind: FeedbackKind;
  selection: ComposerSelection | null;
  submitting: boolean;
  serverError: string | null;
  onKindChange: (kind: FeedbackKind) => void;
  onSubmit: (input: {
    kind: FeedbackKind;
    category: FeedbackCategory;
    body: string;
    proposedText?: string;
  }) => void;
  onClose: () => void;
}

export function FeedbackComposerModal({
  isOpen,
  kind,
  selection,
  submitting,
  serverError,
  onKindChange,
  onSubmit,
  onClose,
}: FeedbackComposerModalProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [body, setBody] = useState('');
  const [proposedText, setProposedText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCategory('general');
      setBody('');
      setProposedText('');
    }
  }, [isOpen, kind, selection]);

  if (!selection) return null;

  const canSubmit =
    body.trim().length > 0 && (kind === 'comment' || proposedText.trim().length > 0) && !submitting;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('feedback.composerTitle')}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-background-secondary transition-colors"
          >
            {t('annotation.cancel')}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                kind,
                category,
                body: body.trim(),
                proposedText: kind === 'suggestion' ? proposedText.trim() : undefined,
              })
            }
            className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? t('annotation.save') : t('feedback.submit')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div role="tablist" aria-label={t('feedback.composerTitle')} className="flex gap-2">
          {COMPOSER_KINDS.map((option) => (
            <button
              key={option}
              role="tab"
              aria-selected={kind === option}
              type="button"
              onClick={() => onKindChange(option)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                kind === option
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border text-foreground-muted hover:bg-background-secondary'
              }`}
            >
              {t(option === 'comment' ? 'feedback.kindComment' : 'feedback.kindSuggestion')}
            </button>
          ))}
        </div>

        <figure className="rounded-lg border border-border bg-background-secondary p-3">
          <figcaption className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
            {t('feedback.quoteLabel')}
          </figcaption>
          <blockquote className="mt-1 text-sm text-foreground line-clamp-4">{selection.text}</blockquote>
        </figure>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t('feedback.categoryLabel')}</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.label)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t('feedback.explanationLabel')}</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={5000}
            className="w-full rounded-lg border border-border bg-background p-3 text-sm resize-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </label>

        {kind === 'suggestion' && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t('feedback.proposedLabel')}</span>
            <textarea
              value={proposedText}
              onChange={(e) => setProposedText(e.target.value)}
              rows={2}
              maxLength={5000}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm resize-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </label>
        )}

        {serverError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  );
}
