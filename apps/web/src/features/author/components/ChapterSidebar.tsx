import type { ChapterDraft } from '@do-epub-studio/shared';
import { useTranslation } from '../../../hooks/useTranslation';

interface ChapterSidebarProps {
  chapters: ChapterDraft[];
  selectedChapterId: string;
  onSelectChapter: (id: string) => void;
  onAddChapter: () => void;
  onMoveChapter: (index: number, direction: 'up' | 'down') => void;
  onDeleteChapter: (id: string) => void;
}

export function ChapterSidebar({
  chapters,
  selectedChapterId,
  onSelectChapter,
  onAddChapter,
  onMoveChapter,
  onDeleteChapter,
}: ChapterSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="flex max-h-60 w-full shrink-0 flex-col border-b border-border bg-surface md:max-h-none md:w-64 md:border-b-0 md:border-e">
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t('author.chapter.navLabel')} ({chapters.length})
          </h2>
          <button
            type="button"
            onClick={onAddChapter}
            className="touch-target inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t('author.chapter.add')}
          </button>
        </div>

        <nav aria-label={t('author.chapter.navLabel')} className="space-y-1">
          {chapters.map((chapter, index) => {
            const title = chapter.title || t('author.chapter.untitled');
            const selected = chapter.id === selectedChapterId;
            return (
              <div
                key={chapter.id}
                className={`flex items-center gap-1 rounded-sm px-1 ${
                  selected ? 'bg-background-secondary text-foreground' : 'text-foreground-muted'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectChapter(chapter.id)}
                  aria-current={selected ? 'page' : undefined}
                  className="touch-target min-h-11 min-w-0 flex-1 truncate px-2 text-start text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {title}
                </button>
                <div className="flex shrink-0 items-center">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => onMoveChapter(index, 'up')}
                      aria-label={t('author.chapter.moveUp', { title })}
                      className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm hover:bg-background-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 15 6-6 6 6" />
                      </svg>
                    </button>
                  )}
                  {index < chapters.length - 1 && (
                    <button
                      type="button"
                      onClick={() => onMoveChapter(index, 'down')}
                      aria-label={t('author.chapter.moveDown', { title })}
                      className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm hover:bg-background-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  )}
                  {chapters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteChapter(chapter.id)}
                      aria-label={t('author.chapter.delete', { title })}
                      className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-semantic-error hover:bg-semantic-error/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="m6 6 12 12M18 6 6 18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
