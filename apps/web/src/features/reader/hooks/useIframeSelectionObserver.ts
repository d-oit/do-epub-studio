import { useEffect } from 'react';
import type { Rendition } from '@intity/epub-js';
import { extractSelectionData, type SelectionData } from '../components/annotations';

export interface UseIframeSelectionObserverOptions {
  viewerRef: React.RefObject<HTMLDivElement | null>;
  rootRef: React.RefObject<HTMLDivElement | null>;
  renditionRef: React.MutableRefObject<Rendition | null>;
  currentChapterRef: React.MutableRefObject<string | null>;
  bookFileIdRef: React.MutableRefObject<string | null>;
  isCommentMode: boolean;
  setSelection: (sel: SelectionData | null) => void;
}

export function useIframeSelectionObserver({
  viewerRef,
  rootRef,
  renditionRef,
  currentChapterRef,
  bookFileIdRef,
  isCommentMode,
  setSelection,
}: UseIframeSelectionObserverOptions): void {
  useEffect(() => {
    const viewer = viewerRef;
    const bindingRoot = rootRef.current ?? document.body;
    if (!bindingRoot) return;

    const attached = new WeakSet<Document>();
    let settleTimer: number | undefined;

    const readSelection = () => {
      if (isCommentMode) return;
      const container = viewer.current;
      if (!container) return;
      let frame: HTMLIFrameElement | null = null;
      for (const candidate of container.querySelectorAll('iframe')) {
        const live = candidate.contentWindow?.getSelection();
        if (live && !live.isCollapsed && live.rangeCount > 0) {
          frame = candidate;
          break;
        }
      }
      const sel = frame ? extractSelectionData(frame) : null;
      if (sel && frame) {
        sel.bookFileId = bookFileIdRef.current ?? undefined;
        sel.chapterRef = currentChapterRef.current || sel.chapterRef;
        const contents = renditionRef.current
          ?.getContents()
          .find((entry) => entry.document === frame?.contentDocument);
        const range = frame.contentWindow?.getSelection()?.getRangeAt(0);
        if (contents && range) {
          try {
            sel.cfiRange = contents.cfiFromRange(range);
          } catch {
            // Range outside rendition mapping
          }
        }
      }
      setSelection(sel && sel.text.length >= 3 ? sel : null);
    };

    const onSelectionChange = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(readSelection, 150);
    };
    const onMouseUp = () => {
      window.clearTimeout(settleTimer);
      readSelection();
    };

    const attachToFrames = () => {
      const container = viewer.current;
      if (!container) return;
      for (const frame of container.querySelectorAll('iframe')) {
        const doc = frame.contentDocument;
        if (!doc || attached.has(doc)) continue;
        attached.add(doc);
        doc.addEventListener('selectionchange', onSelectionChange);
        doc.addEventListener('mouseup', onMouseUp);
      }
    };

    attachToFrames();
    const observer = new MutationObserver(attachToFrames);
    observer.observe(bindingRoot, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(settleTimer);
      observer.disconnect();
      for (const frame of viewer.current?.querySelectorAll('iframe') ?? []) {
        frame.contentDocument?.removeEventListener('selectionchange', onSelectionChange);
        frame.contentDocument?.removeEventListener('mouseup', onMouseUp);
      }
    };
  }, [
    viewerRef,
    rootRef,
    renditionRef,
    currentChapterRef,
    bookFileIdRef,
    isCommentMode,
    setSelection,
  ]);
}
