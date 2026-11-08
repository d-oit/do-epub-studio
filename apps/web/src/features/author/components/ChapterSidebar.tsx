import type { ChapterDraft } from '@do-epub-studio/shared';

interface ChapterSidebarProps {
  chapters: ChapterDraft[];
  selectedChapterId: string;
  onSelectChapter: (id: string) => void;
  onAddChapter: () => void;
  onMoveChapter: (index: number, direction: 'up' | 'down') => void;
  onDeleteChapter: (id: string) => void;
}

const SIDEBAR_TEXT = {
  chapters: 'Chapters',
  add: '+ Add',
  untitled: 'Untitled',
  moveUp: 'Move Up',
  moveDown: 'Move Down',
  delete: 'Delete Chapter',
  navLabel: 'Manuscript Chapters',
} as const;

export function ChapterSidebar({
  chapters,
  selectedChapterId,
  onSelectChapter,
  onAddChapter,
  onMoveChapter,
  onDeleteChapter,
}: ChapterSidebarProps) {
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-surface flex flex-col justify-between">
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            {SIDEBAR_TEXT.chapters} ({chapters.length})
          </span>
          <button
            type="button"
            onClick={onAddChapter}
            className="text-xs font-medium text-accent hover:underline"
          >
            {SIDEBAR_TEXT.add}
          </button>
        </div>

        <nav aria-label={SIDEBAR_TEXT.navLabel} className="space-y-1">
          {chapters.map((ch, index) => (
            <div
              key={ch.id}
              className={`group flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                ch.id === selectedChapterId
                  ? 'bg-background-secondary text-foreground font-medium shadow-sm'
                  : 'text-foreground-muted hover:bg-background-tertiary hover:text-foreground'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectChapter(ch.id)}
                className="flex-1 truncate text-left"
              >
                {ch.title || SIDEBAR_TEXT.untitled}
              </button>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => onMoveChapter(index, 'up')}
                    title={SIDEBAR_TEXT.moveUp}
                    className="p-1 hover:text-foreground"
                  >
                    &uarr;
                  </button>
                )}
                {index < chapters.length - 1 && (
                  <button
                    type="button"
                    onClick={() => onMoveChapter(index, 'down')}
                    title={SIDEBAR_TEXT.moveDown}
                    className="p-1 hover:text-foreground"
                  >
                    &darr;
                  </button>
                )}
                {chapters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteChapter(ch.id)}
                    title={SIDEBAR_TEXT.delete}
                    className="p-1 text-semantic-error hover:opacity-80"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
