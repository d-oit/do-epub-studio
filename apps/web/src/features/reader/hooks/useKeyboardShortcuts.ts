import { useEffect } from 'react';
import type { Rendition } from '@intity/epub-js';

interface KeyboardShortcutsProps {
  rendition: Rendition | null;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddBookmark: () => void;
  onHighlight: () => void;
  onComment: () => void;
  onToggleToc: () => void;
  onToggleBookmarks: () => void;
  onToggleComments: () => void;
  onToggleSettings: () => void;
  onShowHelp: () => void;
}

export function useKeyboardShortcuts({
  rendition,
  onPrevPage,
  onNextPage,
  onAddBookmark,
  onHighlight,
  onComment,
  onToggleToc,
  onToggleBookmarks,
  onToggleComments,
  onToggleSettings,
  onShowHelp,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;

      // Navigation
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrevPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNextPage();
      }

      // Bookmark: Ctrl/Cmd + D
      else if (isMod && !isAlt && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onAddBookmark();
      }

      // Highlight: H
      else if (e.key.toLowerCase() === 'h' && !isMod && !isAlt) {
        onHighlight();
      }

      // Comment: C
      else if (e.key.toLowerCase() === 'c' && !isMod && !isAlt) {
        onComment();
      }

      // Toggle Panels: Ctrl + Alt + Key
      else if (isMod && isAlt) {
        const key = e.key.toLowerCase();
        if (key === 't') {
          e.preventDefault();
          onToggleToc();
        } else if (key === 'b') {
          e.preventDefault();
          onToggleBookmarks();
        } else if (key === 'm') {
          e.preventDefault();
          onToggleComments();
        } else if (key === 's') {
          e.preventDefault();
          onToggleSettings();
        }
      }

      // Help: ?
      else if (e.key === '?' && !isMod && !isAlt) {
        onShowHelp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (rendition) {
      // @ts-expect-error - epubjs events are slightly different in types sometimes but follow DOM
      rendition.on('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (rendition) {
        // @ts-expect-error - epubjs event types mismatch with DOM
        rendition.off('keydown', handleKeyDown);
      }
    };
  }, [
    rendition,
    onPrevPage,
    onNextPage,
    onAddBookmark,
    onHighlight,
    onComment,
    onToggleToc,
    onToggleBookmarks,
    onToggleComments,
    onToggleSettings,
    onShowHelp,
  ]);
}
