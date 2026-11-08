import { createElement, Fragment, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type {
  AuthorPublication,
  ChapterDraft,
  PublishManuscriptResponse,
} from '@do-epub-studio/shared';
import { parseAuthorContent } from '@do-epub-studio/reader-core/author-content';
import type {
  AuthorContentAttribute,
  AuthorContentNode,
} from '@do-epub-studio/reader-core/author-content';
import type { HTMLAttributes, ReactNode } from 'react';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Button } from '../../components/ui';
import { Spinner } from '@do-epub-studio/ui';
import { AuthorHeader, ChapterSidebar, PublishModal, MetadataModal } from './components';

type AuthorContentPreviewProps = HTMLAttributes<HTMLElement> & {
  alt?: string;
  colSpan?: number;
  headers?: string;
  href?: string;
  rowSpan?: number;
  scope?: string;
  src?: string;
};

function getPreviewProps(attributes: readonly AuthorContentAttribute[]): AuthorContentPreviewProps {
  const props: AuthorContentPreviewProps = {};

  for (const { name, value } of attributes) {
    switch (name) {
      case 'alt':
        props.alt = value;
        break;
      case 'class':
        props.className = value;
        break;
      case 'colspan': {
        const span = Number(value);
        if (Number.isSafeInteger(span) && span > 0) props.colSpan = span;
        break;
      }
      case 'dir':
        props.dir = value;
        break;
      case 'headers':
        props.headers = value;
        break;
      case 'href':
        props.href = value;
        break;
      case 'id':
        props.id = value;
        break;
      case 'lang':
        props.lang = value;
        break;
      case 'rowspan': {
        const span = Number(value);
        if (Number.isSafeInteger(span) && span > 0) props.rowSpan = span;
        break;
      }
      case 'scope':
        props.scope = value;
        break;
      case 'src':
        props.src = value;
        break;
      case 'title':
        props.title = value;
        break;
      default:
        break;
    }
  }

  return props;
}

function renderAuthorContent(
  nodes: readonly AuthorContentNode[],
  parentKey = 'chapter',
): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${parentKey}-${index}`;
    if (node.type === 'text') return createElement(Fragment, { key }, node.value);

    const children = renderAuthorContent(node.children, key);
    return createElement(node.tag, { ...getPreviewProps(node.attributes), key }, ...children);
  });
}

interface ManuscriptResponse {
  bookId: string;
  publication: AuthorPublication;
  draftVersion: number;
  updatedAt: string;
}

const AUTHOR_TEXT = {
  reloadDraft: 'Reload Latest Draft',
  chapterTitle: 'Chapter Title',
  contentLabel: 'Content (Semantic XHTML)',
  contentPlaceholder: 'Enter chapter text in paragraphs, lists, headings, and semantic tags...',
  previewBanner: 'Previewing with production reader typography and semantic styling.',
  errorTitle: 'Error Loading Manuscript',
  notFound: 'Publication not found',
  backToBooks: '← Back to Books',
  h2: 'H2',
  h3: 'H3',
  p: 'Paragraph',
  quote: 'Quote',
  list: 'List',
} as const;

const ADMIN_BOOKS_ROUTE = '/admin/books';

export function AuthorWorkspacePage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const sessionToken = useAuthStore((state) => state.sessionToken);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publication, setPublication] = useState<AuthorPublication | null>(null);
  const [draftVersion, setDraftVersion] = useState<number>(1);
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [saveStatus, setSaveStatus] = useState<
    'saved' | 'saving' | 'conflict' | 'error' | 'unsaved'
  >('saved');
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Publish state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishManuscriptResponse | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Metadata modal
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchManuscript = useCallback(async () => {
    if (!bookId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest<ManuscriptResponse>(`/api/author/books/${bookId}/manuscript`, {
        token: sessionToken ?? undefined,
      });
      setPublication(res.publication);
      setDraftVersion(res.draftVersion);
      if (res.publication.chapters.length > 0) {
        setSelectedChapterId(res.publication.chapters[0]?.id ?? '');
      }
      setSaveStatus('saved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [bookId, sessionToken]);

  useEffect(() => {
    void fetchManuscript();
  }, [fetchManuscript]);

  const saveDraft = useCallback(
    async (updatedPub: AuthorPublication) => {
      if (!bookId) return;
      setSaveStatus('saving');
      setConflictError(null);
      try {
        const res = await apiRequest<ManuscriptResponse>(`/api/author/books/${bookId}/manuscript`, {
          method: 'PUT',
          token: sessionToken ?? undefined,
          body: JSON.stringify({
            publication: updatedPub,
            expectedVersion: draftVersion,
          }),
        });
        setDraftVersion(res.draftVersion);
        setSaveStatus('saved');
      } catch (err: unknown) {
        const message = (err as Error).message || 'Failed to save draft';
        if (message.includes('CONCURRENCY_CONFLICT') || message.includes('another session')) {
          setSaveStatus('conflict');
          setConflictError(
            'The manuscript was updated in another session. Please reload to avoid overwriting.',
          );
        } else {
          setSaveStatus('error');
          setConflictError(message);
        }
      }
    },
    [bookId, draftVersion, sessionToken],
  );

  const scheduleAutosave = useCallback(
    (newPub: AuthorPublication) => {
      setPublication(newPub);
      setSaveStatus('unsaved');
      clearTimeout(saveTimeoutRef.current ?? undefined);
      saveTimeoutRef.current = setTimeout(() => {
        void saveDraft(newPub);
      }, 1500);
    },
    [saveDraft],
  );

  const activeChapter = publication?.chapters.find((ch) => ch.id === selectedChapterId);

  const previewContent = useMemo(
    () => parseAuthorContent(activeChapter?.contentHtml ?? ''),
    [activeChapter?.contentHtml],
  );
  const handleUpdateActiveChapter = (updates: Partial<ChapterDraft>) => {
    if (!publication || !activeChapter) return;
    const newChapters = publication.chapters.map((ch) =>
      ch.id === activeChapter.id ? { ...ch, ...updates } : ch,
    );
    scheduleAutosave({ ...publication, chapters: newChapters });
  };

  const handleAddChapter = () => {
    if (!publication) return;
    const newId = `chapter-${Date.now().toString(36)}`;
    const newChapter: ChapterDraft = {
      id: newId,
      title: `Chapter ${publication.chapters.length + 1}`,
      order: publication.chapters.length,
      contentHtml: '<p>Start writing this chapter here.</p>',
    };
    const newPub = {
      ...publication,
      chapters: [...publication.chapters, newChapter],
    };
    scheduleAutosave(newPub);
    setSelectedChapterId(newId);
  };

  const handleDeleteChapter = (id: string) => {
    if (!publication || publication.chapters.length <= 1) return;
    const filtered = publication.chapters
      .filter((ch) => ch.id !== id)
      .map((ch, idx) => ({ ...ch, order: idx }));
    const nextSelected = filtered[0]?.id ?? '';
    scheduleAutosave({ ...publication, chapters: filtered });
    setSelectedChapterId(nextSelected);
  };

  const handleMoveChapter = (index: number, direction: 'up' | 'down') => {
    if (!publication) return;
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= publication.chapters.length) return;

    const reordered = [...publication.chapters];
    const temp = reordered[index];
    const target = reordered[newIdx];
    if (!temp || !target) return;
    reordered[index] = target;
    reordered[newIdx] = temp;

    const normalized = reordered.map((ch, idx) => ({ ...ch, order: idx }));
    scheduleAutosave({ ...publication, chapters: normalized });
  };

  const handlePublish = async () => {
    if (!bookId) return;
    setIsPublishing(true);
    setPublishError(null);
    try {
      const res = await apiRequest<PublishManuscriptResponse>(
        `/api/author/books/${bookId}/publish`,
        {
          method: 'POST',
          token: sessionToken ?? undefined,
        },
      );
      setPublishResult(res);
    } catch (err) {
      setPublishError((err as Error).message || 'Publishing failed');
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (error || !publication) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h2 className="mb-2 text-xl font-bold text-foreground">{AUTHOR_TEXT.errorTitle}</h2>
        <p className="mb-6 text-foreground-muted">{error || AUTHOR_TEXT.notFound}</p>
        <Button
          onClick={() => {
            void navigate(ADMIN_BOOKS_ROUTE);
          }}
        >
          {AUTHOR_TEXT.backToBooks}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <AuthorHeader
        title={publication.title}
        saveStatus={saveStatus}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMetadata={() => setIsMetadataOpen(true)}
        onOpenPublish={() => setIsPublishModalOpen(true)}
        onBack={() => {
          void navigate(ADMIN_BOOKS_ROUTE);
        }}
      />

      {conflictError && (
        <div className="flex items-center justify-between border-b border-semantic-error/40 bg-semantic-error/10 px-4 py-2 text-sm text-semantic-error">
          <span>{conflictError}</span>
          <button
            type="button"
            onClick={() => void fetchManuscript()}
            className="font-semibold underline hover:no-underline"
          >
            {AUTHOR_TEXT.reloadDraft}
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <ChapterSidebar
          chapters={publication.chapters}
          selectedChapterId={selectedChapterId}
          onSelectChapter={setSelectedChapterId}
          onAddChapter={handleAddChapter}
          onMoveChapter={handleMoveChapter}
          onDeleteChapter={handleDeleteChapter}
        />

        <main className="flex-1 overflow-y-auto bg-background p-6">
          {activeTab === 'editor' && activeChapter ? (
            <div className="mx-auto max-w-3xl space-y-4">
              <div>
                <label
                  htmlFor="chapter-title-input"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground-muted"
                >
                  {AUTHOR_TEXT.chapterTitle}
                </label>
                <input
                  id="chapter-title-input"
                  type="text"
                  value={activeChapter.title}
                  onChange={(e) => handleUpdateActiveChapter({ title: e.target.value })}
                  className="w-full rounded-md border border-border bg-surface px-4 py-2 font-display text-xl font-semibold text-foreground focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface p-1 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateActiveChapter({
                      contentHtml: `${activeChapter.contentHtml}\n<h2>Subheading</h2>`,
                    })
                  }
                  className="rounded px-2 py-1 hover:bg-background-secondary font-semibold"
                >
                  {AUTHOR_TEXT.h2}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateActiveChapter({
                      contentHtml: `${activeChapter.contentHtml}\n<h3>Section Heading</h3>`,
                    })
                  }
                  className="rounded px-2 py-1 hover:bg-background-secondary font-semibold"
                >
                  {AUTHOR_TEXT.h3}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateActiveChapter({
                      contentHtml: `${activeChapter.contentHtml}\n<p>New paragraph text.</p>`,
                    })
                  }
                  className="rounded px-2 py-1 hover:bg-background-secondary"
                >
                  {AUTHOR_TEXT.p}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateActiveChapter({
                      contentHtml: `${activeChapter.contentHtml}\n<blockquote>A highlighted quotation.</blockquote>`,
                    })
                  }
                  className="rounded px-2 py-1 hover:bg-background-secondary italic"
                >
                  {AUTHOR_TEXT.quote}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateActiveChapter({
                      contentHtml: `${activeChapter.contentHtml}\n<ul>\n  <li>First list item</li>\n  <li>Second list item</li>\n</ul>`,
                    })
                  }
                  className="rounded px-2 py-1 hover:bg-background-secondary"
                >
                  {AUTHOR_TEXT.list}
                </button>
              </div>

              <div>
                <label
                  htmlFor="chapter-body-editor"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground-muted"
                >
                  {AUTHOR_TEXT.contentLabel}
                </label>
                <textarea
                  id="chapter-body-editor"
                  rows={18}
                  value={activeChapter.contentHtml}
                  onChange={(e) => handleUpdateActiveChapter({ contentHtml: e.target.value })}
                  placeholder={AUTHOR_TEXT.contentPlaceholder}
                  className="w-full rounded-md border border-border bg-surface p-4 font-mono text-sm leading-relaxed text-foreground focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          ) : activeTab === 'preview' && activeChapter ? (
            <div className="mx-auto max-w-3xl">
              <div className="mb-4 rounded border border-border bg-background-secondary p-3 text-xs text-foreground-muted">
                {AUTHOR_TEXT.previewBanner}
              </div>
              <article className="prose prose-neutral dark:prose-invert rounded-lg border border-border bg-surface p-8 shadow-sm">
                <h1>{activeChapter.title}</h1>
                {renderAuthorContent(previewContent)}
              </article>
            </div>
          ) : null}
        </main>
      </div>

      <MetadataModal
        isOpen={isMetadataOpen}
        onClose={() => setIsMetadataOpen(false)}
        publication={publication}
        onSave={(updates) => scheduleAutosave({ ...publication, ...updates })}
      />

      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => {
          setIsPublishModalOpen(false);
          setPublishResult(null);
          setPublishError(null);
        }}
        publication={publication}
        publishResult={publishResult}
        publishError={publishError}
        isPublishing={isPublishing}
        onPublish={handlePublish}
        onBackToBooks={() => {
          void navigate(ADMIN_BOOKS_ROUTE);
        }}
      />
    </div>
  );
}
