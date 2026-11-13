import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  AuthorAssetMetadata,
  AuthorPublication,
  ChapterDraft,
  PublishManuscriptResponse,
} from '@do-epub-studio/shared';
import { apiRequest } from '../../lib/api';
import { listAuthorAssets } from '../../lib/api/author-assets';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../../components/ui';
import { Spinner } from '@do-epub-studio/ui';
import { useAuthStore } from '../../stores/auth';
import { AuthorHeader, MetadataModal, PublishModal } from './components';
import { AuthorWorkspaceContent } from './AuthorWorkspaceContent';
import { escapeHtml } from './author-html';

interface ManuscriptResponse {
  bookId: string;
  bookSlug: string;
  publication: AuthorPublication;
  draftVersion: number;
  updatedAt: string;
}

const ADMIN_BOOKS_ROUTE = '/admin/books';

export function AuthorWorkspacePage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const bookSlug = useAuthStore((state) => state.bookSlug);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publication, setPublication] = useState<AuthorPublication | null>(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [saveStatus, setSaveStatus] = useState<
    'saved' | 'saving' | 'conflict' | 'error' | 'unsaved'
  >('saved');
  const [conflictError, setConflictError] = useState<string | null>(null);

  const [assets, setAssets] = useState<AuthorAssetMetadata[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState(false);

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishManuscriptResponse | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftVersionRef = useRef(1);
  const savedPublicationRef = useRef('');
  const latestPublicationRef = useRef<AuthorPublication | null>(null);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveBlockedRef = useRef(false);
  const fetchRequestRef = useRef<{ bookId: string } | null>(null);
  const fetchedBookIdRef = useRef<string | null>(null);

  const fetchManuscript = useCallback(
    async (force = false) => {
      if (!bookId) return;
      if (fetchRequestRef.current?.bookId === bookId) return;
      if (!force && fetchedBookIdRef.current === bookId) return;

      const request = { bookId };
      fetchRequestRef.current = request;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveBlockedRef.current = true;
      await saveQueueRef.current;
      if (fetchRequestRef.current !== request) return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiRequest<ManuscriptResponse>(
          `/api/author/books/${request.bookId}/manuscript`,
          { token: sessionToken ?? undefined },
        );
        if (fetchRequestRef.current !== request) return;
        const snapshot = JSON.stringify(response.publication);
        draftVersionRef.current = response.draftVersion;
        savedPublicationRef.current = snapshot;
        latestPublicationRef.current = response.publication;
        fetchedBookIdRef.current = request.bookId;
        setPublication(response.publication);
        setUpdatedAt(response.updatedAt);
        setSelectedChapterId(response.publication.chapters[0]?.id ?? '');
        setSaveStatus('saved');
        setConflictError(null);
        saveBlockedRef.current = false;
      } catch (fetchError) {
        if (fetchRequestRef.current === request) {
          setError(fetchError instanceof Error ? fetchError.message : t('author.errorTitle'));
        }
      } finally {
        if (fetchRequestRef.current === request) {
          fetchRequestRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [bookId, sessionToken, t],
  );

  const loadAssets = useCallback(async () => {
    if (!bookId) return;
    setAssetsLoading(true);
    setAssetsError(false);
    try {
      setAssets(await listAuthorAssets(bookId, sessionToken));
    } catch {
      setAssetsError(true);
    } finally {
      setAssetsLoading(false);
    }
  }, [bookId, sessionToken]);

  useEffect(() => {
    void fetchManuscript();
  }, [fetchManuscript]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const saveDraft = useCallback(
    (updatedPublication: AuthorPublication): Promise<boolean> => {
      const snapshot = JSON.stringify(updatedPublication);
      const queuedSave = saveQueueRef.current.then(async () => {
        if (!bookId || saveBlockedRef.current) return false;
        if (savedPublicationRef.current === snapshot) {
          setSaveStatus('saved');
          return true;
        }
        setSaveStatus('saving');
        setConflictError(null);
        try {
          const response = await apiRequest<ManuscriptResponse>(
            `/api/author/books/${bookId}/manuscript`,
            {
              method: 'PUT',
              token: sessionToken ?? undefined,
              body: JSON.stringify({
                publication: updatedPublication,
                expectedVersion: draftVersionRef.current,
              }),
            },
          );
          draftVersionRef.current = response.draftVersion;
          savedPublicationRef.current = snapshot;
          setUpdatedAt(response.updatedAt);
          const currentSnapshot = latestPublicationRef.current
            ? JSON.stringify(latestPublicationRef.current)
            : snapshot;
          setSaveStatus(currentSnapshot === snapshot ? 'saved' : 'unsaved');
          return true;
        } catch (saveError) {
          const message = saveError instanceof Error ? saveError.message : t('author.status.error');
          const isConflict =
            message.includes('CONCURRENCY_CONFLICT') || message.includes('another session');
          saveBlockedRef.current = isConflict;
          setSaveStatus(isConflict ? 'conflict' : 'error');
          setConflictError(isConflict ? t('author.conflict.message') : message);
          return false;
        }
      });
      saveQueueRef.current = queuedSave;
      return queuedSave;
    },
    [bookId, sessionToken, t],
  );

  const scheduleAutosave = useCallback(
    (nextPublication: AuthorPublication) => {
      latestPublicationRef.current = nextPublication;
      setPublication(nextPublication);
      setSaveStatus(saveBlockedRef.current ? 'conflict' : 'unsaved');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (saveBlockedRef.current) return;
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        void saveDraft(nextPublication);
      }, 900);
    },
    [saveDraft],
  );
  const flushDraft = useCallback(async (): Promise<boolean> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await saveQueueRef.current;
    for (;;) {
      const currentPublication = latestPublicationRef.current;
      if (!currentPublication || saveBlockedRef.current) return false;
      if (savedPublicationRef.current === JSON.stringify(currentPublication)) {
        setSaveStatus('saved');
        return true;
      }
      if (!(await saveDraft(currentPublication))) return false;
    }
  }, [saveDraft]);

  const handleSetActiveTab = useCallback(
    (tab: 'editor' | 'preview') => {
      if (tab === 'editor') {
        setActiveTab('editor');
        return;
      }
      void flushDraft()
        .then((saved) => {
          if (saved) setActiveTab('preview');
        })
        .catch(() => {
          setSaveStatus('error');
          setConflictError(t('author.status.error'));
        });
    },
    [flushDraft, t],
  );

  const activeChapter = publication?.chapters.find((chapter) => chapter.id === selectedChapterId);

  const handleUpdateActiveChapter = (updates: Partial<ChapterDraft>) => {
    if (!publication || !activeChapter) return;
    const chapters = publication.chapters.map((chapter) =>
      chapter.id === activeChapter.id ? { ...chapter, ...updates } : chapter,
    );
    scheduleAutosave({ ...publication, chapters });
  };

  const appendToActiveChapter = (markup: string) => {
    if (!activeChapter) return;
    handleUpdateActiveChapter({ contentHtml: `${activeChapter.contentHtml}\n${markup}` });
  };

  const handleAddChapter = () => {
    if (!publication) return;
    const id = `chapter-${crypto.randomUUID()}`;
    const chapter: ChapterDraft = {
      id,
      title: t('author.chapter.numberedTitle', { number: publication.chapters.length + 1 }),
      order: publication.chapters.length,
      contentHtml: `<p>${escapeHtml(t('author.chapter.defaultText'))}</p>`,
    };
    scheduleAutosave({ ...publication, chapters: [...publication.chapters, chapter] });
    setSelectedChapterId(id);
  };

  const handleDeleteChapter = (id: string) => {
    if (!publication || publication.chapters.length <= 1) return;
    const chapters = publication.chapters
      .filter((chapter) => chapter.id !== id)
      .map((chapter, index) => ({ ...chapter, order: index }));
    scheduleAutosave({ ...publication, chapters });
    if (selectedChapterId === id) setSelectedChapterId(chapters[0]?.id ?? '');
  };

  const handleMoveChapter = (index: number, direction: 'up' | 'down') => {
    if (!publication) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= publication.chapters.length) return;
    const chapters = [...publication.chapters];
    const current = chapters[index];
    const target = chapters[nextIndex];
    if (!current || !target) return;
    chapters[index] = target;
    chapters[nextIndex] = current;
    scheduleAutosave({
      ...publication,
      chapters: chapters.map((chapter, order) => ({ ...chapter, order })),
    });
  };

  const handlePublish = async () => {
    if (!bookId) return;
    setIsPublishing(true);
    setPublishError(null);
    try {
      if (!(await flushDraft())) throw new Error(t('author.publishSaveError'));
      const response = await apiRequest<PublishManuscriptResponse>(
        `/api/author/books/${bookId}/publish`,
        { method: 'POST', token: sessionToken ?? undefined },
      );
      setPublishResult(response);
    } catch (publishFailure) {
      setPublishError(
        publishFailure instanceof Error ? publishFailure.message : t('author.publishSaveError'),
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const backRoute = isAdmin ? ADMIN_BOOKS_ROUTE : bookSlug ? `/read/${bookSlug}` : '/library';

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background" role="status">
        <Spinner />
      </div>
    );
  }

  if (error || !publication) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="mb-2 font-display text-xl font-semibold text-foreground">
          {t('author.errorTitle')}
        </h1>
        <p className="mb-6 text-foreground-muted">{error || t('author.notFound')}</p>
        <Button type="button" onClick={() => void navigate(backRoute)}>
          {isAdmin ? t('author.backToBooks') : t('author.backToLibrary')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AuthorHeader
        title={publication.title}
        saveStatus={saveStatus}
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        backLabel={isAdmin ? t('author.backToBooks') : t('author.backToLibrary')}
        onOpenMetadata={() => setIsMetadataOpen(true)}
        onOpenPublish={() => setIsPublishModalOpen(true)}
        onBack={() => void navigate(backRoute)}
      />

      {conflictError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b border-semantic-error/40 bg-semantic-error/10 px-4 py-2 text-sm text-semantic-error"
          role="alert"
        >
          <span>{conflictError}</span>
          {saveStatus === 'conflict' ? (
            <button
              type="button"
              onClick={() => void fetchManuscript(true)}
              className="touch-target min-h-11 font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {t('author.reloadDraft')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const current = latestPublicationRef.current;
                if (current) void saveDraft(current);
              }}
              className="touch-target min-h-11 font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {t('author.retrySave')}
            </button>
          )}
        </div>
      )}

      <AuthorWorkspaceContent
        bookId={bookId}
        publication={publication}
        activeChapter={activeChapter}
        activeTab={activeTab}
        selectedChapterId={selectedChapterId}
        assets={assets}
        assetsLoading={assetsLoading}
        assetsError={assetsError}
        updatedAt={updatedAt}
        sessionToken={sessionToken}
        setAssets={setAssets}
        onSelectChapter={setSelectedChapterId}
        onAddChapter={handleAddChapter}
        onMoveChapter={handleMoveChapter}
        onDeleteChapter={handleDeleteChapter}
        onUpdateChapter={handleUpdateActiveChapter}
        onAppendMarkup={appendToActiveChapter}
        onRetryAssets={loadAssets}
        onScheduleAutosave={scheduleAutosave}
      />

      <MetadataModal
        isOpen={isMetadataOpen}
        onClose={() => setIsMetadataOpen(false)}
        publication={publication}
        assets={assets}
        onSave={(updates) =>
          scheduleAutosave({ ...(latestPublicationRef.current ?? publication), ...updates })
        }
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
        onBackToBooks={() => void navigate(backRoute)}
      />
    </div>
  );
}
