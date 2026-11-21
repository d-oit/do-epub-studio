import { useCallback, useRef, useState } from 'react';
import { useAuthStore, useReaderStore } from '../stores';
import { usePreferencesStore } from '../stores/preferences';
import {
  exportPortabilityArchive,
  fetchBookState,
  fetchLibraryBooks,
  parsePortabilityFile,
  type BookStateData,
} from '../lib/portability/service';
import { analyzeImport, planImport, type PortabilityPreview } from '../lib/portability/import';
import { applyImportPlan } from '../lib/portability/apply';
import type { ReadinessBookState } from '../lib/portability/import';
import { useTranslation } from './useTranslation';

export interface PortabilityDialogState {
  isOpen: boolean;
  scope: 'book' | 'account';
  bookId: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  preview: PortabilityPreview | null;
  isAnalyzing: boolean;
  isApplying: boolean;
  error: string | null;
  includeBookFiles: boolean;
  lastResult: string | null;
}

const initialState: PortabilityDialogState = {
  isOpen: false,
  scope: 'book',
  bookId: null,
  bookTitle: null,
  bookSlug: null,
  preview: null,
  isAnalyzing: false,
  isApplying: false,
  error: null,
  includeBookFiles: false,
  lastResult: null,
};

function downloadBlob(bytes: Uint8Array, filename: string, mimeType: string) {
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  const blob = new Blob([view.buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function usePortability() {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.sessionToken);
  const [state, setState] = useState<PortabilityDialogState>(initialState);
  const controllerRef = useRef<AbortController | null>(null);

  const open = useCallback((scope: 'book' | 'account', book?: { id: string; title: string | null; slug: string }) => {
    controllerRef.current?.abort();
    setState(() => ({
      ...initialState,
      isOpen: true,
      scope,
      bookId: book?.id ?? null,
      bookTitle: book?.title ?? null,
      bookSlug: book?.slug ?? null,
      includeBookFiles: scope === 'book',
    }));
  }, []);

  const close = useCallback(() => {
    controllerRef.current?.abort();
    setState((prev) => ({ ...prev, isOpen: false, preview: null, error: null, lastResult: null }));
  }, []);

  const setIncludeBookFiles = useCallback((includeBookFiles: boolean) => {
    setState((prev) => ({ ...prev, includeBookFiles }));
  }, []);

  const exportArchive = useCallback(
    async () => {
      if (!token) {
        setState((prev) => ({ ...prev, error: t('portability.signInRequired') }));
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      setState((prev) => ({ ...prev, error: null, lastResult: null }));
      try {
        const books = await fetchLibraryBooks(token, controller.signal);
        const scope = state.scope;
        const targets = scope === 'account' ? books : books.filter((b) => b.id === state.bookId);
        if (targets.length === 0 && scope === 'book') {
          setState((prev) => ({ ...prev, error: t('portability.bookNotFound') }));
          return;
        }
        const states: Record<string, BookStateData> = {};
        for (const book of targets) {
          states[book.id] = await fetchBookState(book.id, token, controller.signal);
        }
        const archive = await exportPortabilityArchive({
          token,
          scope,
          books: targets,
          states,
          includeBookFiles: state.includeBookFiles,
          signal: controller.signal,
        });
        downloadBlob(archive.bytes, archive.filename, archive.mimeType);
        setState((prev) => ({ ...prev, lastResult: t('portability.exportDone') }));
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setState((prev) => ({ ...prev, error: t('portability.exportFailed') }));
      }
    },
    [token, state.scope, state.bookId, state.includeBookFiles, t],
  );

  const importFile = useCallback(
    async (file: File) => {
      if (!token) {
        setState((prev) => ({ ...prev, error: t('portability.signInRequired') }));
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      setState((prev) => ({ ...prev, isAnalyzing: true, error: null, preview: null }));
      try {
        const { json } = await parsePortabilityFile(file);

        // Determine "current" state to diff against. Book scope uses the
        // reader store (fresh, offline-aware). Account scope fetches the
        // library and each book's state.
        // library and each book's state.
        const currentByBook: Record<string, ReadinessBookState | null> = {};
        if (state.scope === 'book' && state.bookId) {
          const reader = useReaderStore.getState();
          currentByBook[state.bookId] = {
            highlights: reader.highlights,
            comments: reader.comments,
            bookmarks: reader.bookmarks,
            progress: reader.progress,
          };
        } else {
          const books = await fetchLibraryBooks(token, controller.signal);
          for (const book of books) {
            const data = await fetchBookState(book.id, token, controller.signal);
            currentByBook[book.id] = {
              highlights: data.highlights,
              comments: data.comments,
              bookmarks: data.bookmarks,
              progress: data.progress,
            };
          }
        }

        const preview = analyzeImport(json, currentByBook);
        // Account imports may contain books the current library lacks; they
        // are shown as skipped and are not applied.
        setState((prev) => ({ ...prev, preview, isAnalyzing: false }));
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setState((prev) => ({
          ...prev,
          isAnalyzing: false,
          error: err instanceof Error ? err.message : t('portability.importInvalid'),
        }));
      }
    },
    [token, state.scope, state.bookId, t],
  );

  const confirmImport = useCallback(
    async () => {
      if (!token || !state.preview) return;
      const controller = new AbortController();
      controllerRef.current = controller;
      setState((prev) => ({ ...prev, isApplying: true, error: null }));
      try {
        const plan = await planImport(state.preview);
        const result = await applyImportPlan({
          token,
          preview: state.preview,
          plan,
          signal: controller.signal,
        });

        // Restore account-level preferences (user metadata) when present.
        if (state.scope === 'account') {
          const prefsItem = state.preview.envelope.items.find((i) => i.type === 'preferences');
          if (prefsItem && prefsItem.type === 'preferences') {
            const p = prefsItem.preferences;
            usePreferencesStore.getState().setTheme(p.theme);
            usePreferencesStore.getState().setFontFamily(p.fontFamily);
            usePreferencesStore.getState().setFontSize(p.fontSize);
            usePreferencesStore.getState().setPageWidth(p.pageWidth);
            usePreferencesStore.getState().setDirection(p.direction);
            usePreferencesStore.getState().setWritingMode(p.writingMode);
            usePreferencesStore.getState().setAiEnabled(p.aiEnabled);
          }
        }

        setState((prev) => ({
          ...prev,
          isApplying: false,
          preview: null,
          lastResult: t('portability.importDone', {
            applied: result.applied,
            progress: result.progressApplied,
          }),
        }));
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setState((prev) => ({ ...prev, isApplying: false, error: t('portability.applyFailed') }));
      }
    },
    [token, state.preview, state.scope, t],
  );

  return {
    state,
    open,
    close,
    setIncludeBookFiles,
    exportArchive,
    importFile,
    confirmImport,
  };
}
