import { Button } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';

interface AuthorHeaderProps {
  title: string;
  saveStatus: 'saved' | 'saving' | 'conflict' | 'error' | 'unsaved';
  activeTab: 'editor' | 'preview';
  setActiveTab: (tab: 'editor' | 'preview') => void;
  onOpenMetadata: () => void;
  onOpenPublish: () => void;
  onBack: () => void;
  backLabel?: string;
}

export function AuthorHeader({
  title,
  saveStatus,
  activeTab,
  setActiveTab,
  onOpenMetadata,
  onOpenPublish,
  onBack,
  backLabel,
}: AuthorHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="flex min-h-14 shrink-0 flex-col gap-2 border-b border-border bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onBack}
          className="touch-target inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-foreground-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {backLabel ?? t('author.backToBooks')}
        </button>
        <h1 className="min-w-0 max-w-full truncate font-display text-base font-semibold leading-tight sm:max-w-sm">
          {title}
        </h1>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onOpenMetadata}
          className="min-h-11"
        >
          {t('author.metadata')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span
          role="status"
          aria-live="polite"
          className={`rounded-sm px-2 py-1 text-xs font-medium ${
            saveStatus === 'saved'
              ? 'bg-background-tertiary text-foreground-muted'
              : saveStatus === 'saving'
                ? 'bg-accent/20 text-accent'
                : saveStatus === 'conflict' || saveStatus === 'error'
                  ? 'bg-semantic-error/20 text-semantic-error'
                  : 'bg-background-secondary text-foreground'
          }`}
        >
          {t(`author.status.${saveStatus}`)}
        </span>

        <div
          role="group"
          aria-label={t('author.tabs.label')}
          className="flex rounded-sm border border-border bg-background p-0.5"
        >
          <button
            type="button"
            aria-pressed={activeTab === 'editor'}
            onClick={() => setActiveTab('editor')}
            className="touch-target min-h-11 rounded-sm px-3 text-sm font-medium aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-sm"
          >
            {t('author.tabs.editor')}
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'preview'}
            onClick={() => setActiveTab('preview')}
            className="touch-target min-h-11 rounded-sm px-3 text-sm font-medium aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-sm"
          >
            {t('author.tabs.preview')}
          </button>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onOpenPublish}
          className="min-h-11"
        >
          {t('author.publish')}
        </Button>
      </div>
    </header>
  );
}
