// useEditorialReview.ts — grounded review state for the creator assistance panel.
//
// F1 (GOAP-290) / GOAP-293: the panel needs manuscript text on the creator's
// device before any engine may run. This hook owns that state machine:
//   idle → loading → ready (chapters selectable) | no_read_access | error
// plus the run path: extract the selected chapters, attach the retained
// references and style revision, and dispatch through the category-owning
// engines. Nothing is extracted or sent before an explicit user action.
//
// The optional LanguageTool adapter (ADR-274: deployment-local) is registered
// only when VITE_LANGUAGETOOL_URL is configured, so a deployment without a
// local service keeps reporting spelling/grammar as unavailable instead of
// probing a dead origin.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createLanguageToolEditorialPlugin,
  type EditorialCategory,
  type EditorialReviewOutcome,
  type LanguageToolEditorialPlugin,
} from '@do-epub-studio/reader-core';
import { fetchReferences, fetchStyleProfile } from '../../../lib/api/creator';
import {
  fetchBookFileUrl,
  loadCreatorBook,
  type BookChapter,
  type CreatorBook,
} from '../lib/book-chapters';
import { dispatchEditorialReview, type EditorialEngine } from '../lib/editorial-dispatch';

export type BookLoadState = 'idle' | 'loading' | 'ready' | 'no_read_access' | 'error';

export interface UseEditorialReviewResult {
  bookState: BookLoadState;
  chapters: BookChapter[];
  selected: readonly string[];
  toggleChapter: (ref: string) => void;
  /** Load the book's chapters through the creator's read access. */
  loadBook: () => Promise<void>;
  languageToolPlugin: LanguageToolEditorialPlugin | null;
  languageToolAvailable: boolean;
  running: boolean;
  outcome: EditorialReviewOutcome | null;
  /** True when an engine is present but no chapter text has been loaded. */
  textRequired: boolean;
  error: string | null;
  run: (
    engines: readonly EditorialEngine[],
    categories: readonly EditorialCategory[],
  ) => Promise<void>;
}

function splitTerms(value: string | null): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  for (const part of value.split(/[\n,;]+/)) {
    const term = part.trim();
    if (term.length > 0) seen.add(term);
  }
  return [...seen];
}

function accessErrorState(error: unknown): BookLoadState {
  const status = (error as { status?: number } | null)?.status;
  return status === 403 || status === 404 ? 'no_read_access' : 'error';
}

export function useEditorialReview(bookId: string, token: string): UseEditorialReviewResult {
  const bookRef = useRef<CreatorBook | null>(null);
  const [bookState, setBookState] = useState<BookLoadState>('idle');
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<EditorialReviewOutcome | null>(null);
  const [textRequired, setTextRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const languageToolPlugin = useMemo(() => {
    const url = import.meta.env.VITE_LANGUAGETOOL_URL?.trim();
    return url ? createLanguageToolEditorialPlugin({ baseUrl: url }) : null;
  }, []);
  const [languageToolAvailable, setLanguageToolAvailable] = useState(false);

  useEffect(() => {
    if (!languageToolPlugin) return;
    let cancelled = false;
    void languageToolPlugin.capabilities.editorial
      ?.probe()
      .then((ok) => {
        if (!cancelled) setLanguageToolAvailable(ok);
      })
      .catch(() => {
        if (!cancelled) setLanguageToolAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [languageToolPlugin]);

  useEffect(
    () => () => {
      bookRef.current?.destroy();
      bookRef.current = null;
    },
    [],
  );

  const loadBook = useCallback(async () => {
    if (!bookId || !token) return;
    setBookState('loading');
    setError(null);
    setTextRequired(false);
    try {
      const { url } = await fetchBookFileUrl(bookId, token);
      const book = await loadCreatorBook(url);
      bookRef.current?.destroy();
      bookRef.current = book;
      setChapters(book.chapters);
      const [firstChapter] = book.chapters;
      setSelected(firstChapter ? [firstChapter.ref] : []);
      setBookState('ready');
    } catch (err) {
      setBookState(accessErrorState(err));
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [bookId, token]);

  const toggleChapter = useCallback((ref: string) => {
    setSelected((previous) =>
      previous.includes(ref) ? previous.filter((entry) => entry !== ref) : [...previous, ref],
    );
  }, []);

  const run = useCallback(
    async (engines: readonly EditorialEngine[], categories: readonly EditorialCategory[]) => {
      setRunning(true);
      setError(null);
      setTextRequired(false);
      try {
        const hasEngine = engines.some(
          (engine) =>
            engine.categories.some((category) => categories.includes(category)) &&
            (engine.plugin.capabilities.editorial?.hasEngine() ?? false),
        );
        if (!hasEngine) {
          setOutcome({ status: 'unavailable', reason: 'engine_missing' });
          return;
        }
        const book = bookRef.current;
        if (!book || selected.length === 0) {
          // An engine exists but there is nothing authorized to review yet.
          setTextRequired(true);
          return;
        }
        const [{ chapterText, chapterSha256 }, references, style] = await Promise.all([
          book.extract(selected),
          fetchReferences(bookId, token),
          fetchStyleProfile(bookId, token),
        ]);
        const referenceMap = Object.fromEntries(
          references.map((reference) => [
            reference.id,
            { revision: reference.revision, content: reference.content },
          ]),
        );
        const approvedTerms = [
          ...splitTerms(style?.terminology ?? null),
          ...splitTerms(style?.intentionalExceptions ?? null),
        ];
        const result = await dispatchEditorialReview(engines, {
          categories,
          chapterText,
          chapterSha256,
          references: referenceMap,
          styleRevision: style?.revision ?? null,
          language: book.language,
          ...(approvedTerms.length > 0 ? { approvedTerms } : {}),
        });
        setOutcome(result.outcome);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setRunning(false);
      }
    },
    [bookId, token, selected],
  );

  return {
    bookState,
    chapters,
    selected,
    toggleChapter,
    loadBook,
    languageToolPlugin,
    languageToolAvailable,
    running,
    outcome,
    textRequired,
    error,
    run,
  };
}
