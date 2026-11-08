import { Button } from '../../../components/ui';

interface AuthorHeaderProps {
  title: string;
  saveStatus: 'saved' | 'saving' | 'conflict' | 'error' | 'unsaved';
  activeTab: 'editor' | 'preview';
  setActiveTab: (tab: 'editor' | 'preview') => void;
  onOpenMetadata: () => void;
  onOpenPublish: () => void;
  onBack: () => void;
}

const HEADER_TEXT = {
  backToBooks: '← Back to Books',
  metadata: 'Metadata',
  statusSaved: 'Saved',
  statusSaving: 'Saving...',
  statusConflict: 'Conflict!',
  statusUnsaved: 'Unsaved',
  statusError: 'Save Error',
  editor: 'Editor',
  preview: 'Preview',
  publishButton: 'Publish as EPUB 3',
} as const;

export function AuthorHeader({
  title,
  saveStatus,
  activeTab,
  setActiveTab,
  onOpenMetadata,
  onOpenPublish,
  onBack,
}: AuthorHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-foreground-muted hover:text-foreground"
        >
          {HEADER_TEXT.backToBooks}
        </button>
        <span className="text-border">|</span>
        <h1 className="font-display text-base font-semibold leading-none truncate max-w-sm">
          {title}
        </h1>
        <button
          type="button"
          onClick={onOpenMetadata}
          className="rounded border border-border px-2 py-1 text-xs text-foreground-muted hover:text-foreground"
        >
          {HEADER_TEXT.metadata}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            saveStatus === 'saved'
              ? 'bg-background-tertiary text-foreground-muted'
              : saveStatus === 'saving'
                ? 'bg-accent/20 text-accent animate-pulse'
                : saveStatus === 'conflict'
                  ? 'bg-semantic-error/20 text-semantic-error'
                  : 'bg-background-secondary text-foreground'
          }`}
        >
          {saveStatus === 'saved' && HEADER_TEXT.statusSaved}
          {saveStatus === 'saving' && HEADER_TEXT.statusSaving}
          {saveStatus === 'conflict' && HEADER_TEXT.statusConflict}
          {saveStatus === 'unsaved' && HEADER_TEXT.statusUnsaved}
          {saveStatus === 'error' && HEADER_TEXT.statusError}
        </span>

        <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`rounded px-3 py-1 font-medium ${
              activeTab === 'editor'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            {HEADER_TEXT.editor}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`rounded px-3 py-1 font-medium ${
              activeTab === 'preview'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            {HEADER_TEXT.preview}
          </button>
        </div>

        <Button variant="primary" size="sm" onClick={onOpenPublish}>
          {HEADER_TEXT.publishButton}
        </Button>
      </div>
    </header>
  );
}
