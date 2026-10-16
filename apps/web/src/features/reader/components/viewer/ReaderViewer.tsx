import { useEffect } from 'react';
import { Spinner } from '@do-epub-studio/ui';
import { SyncRecoveryPanel } from '../../../../components/SyncRecoveryPanel';
import { useReaderStore } from '../../../../stores/reader';
import { useAuthStore } from '../../../../stores/auth';
import { useTranslation } from '../../../../hooks/useTranslation';

interface ReaderViewerProps {
  isLoading: boolean;
  epubUrl: string | null;
  error: string | null;
  pageWidthClass: string;
  viewerRef: React.RefObject<HTMLDivElement | null>;
  notAvailableText: string;
}
export function ReaderViewer({
  isLoading,
  epubUrl,
  error,
  pageWidthClass,
  viewerRef,
  notAvailableText,
}: ReaderViewerProps) {
  const pendingSyncCount = useReaderStore((state) => state.pendingSyncCount);
  const bookTitle = useAuthStore((state) => state.bookTitle);
  const { t } = useTranslation();
  // Accessible name for the generated book iframes: epub.js never names them,
  // which axe reports as a serious `frame-title` violation, and the book title
  // is that frame document's name.
  const contentFrameTitle = bookTitle ?? t('reader.untitledBook');

  // epub.js creates a sandboxed <iframe> per rendered view as it renders
  // neighbours, so the frames are named as they appear. The frame contents
  // stay out of axe's scope (the sandbox is script-disabled — see
  // docs/accessibility.md), but the <iframe> element in this document is
  // auditable and must carry an accessible name. The render target only exists
  // once `isLoading` is false and a URL resolved, so those are dependencies:
  // the ref is still null when this effect first runs.
  useEffect(() => {
    const host = viewerRef.current;
    if (!host) return;
    const nameFrames = (): void => {
      for (const frame of host.querySelectorAll('iframe')) {
        if (frame.getAttribute('title') !== contentFrameTitle) {
          frame.setAttribute('title', contentFrameTitle);
        }
      }
    };
    nameFrames();
    const observer = new MutationObserver(nameFrames);
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [viewerRef, contentFrameTitle, isLoading, epubUrl]);

  return (
    <main id="main-content" className="pt-14 pb-20">
      {error && (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <div className="p-3 bg-accent-error/10 border border-accent-error rounded text-sm text-accent-error">
            {error}
          </div>
        </div>
      )}
      {pendingSyncCount > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SyncRecoveryPanel pendingCount={pendingSyncCount} />
        </div>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Spinner />
        </div>
      ) : epubUrl ? (
        <div className={`mx-auto px-4 py-8 ${pageWidthClass}`}>
          {/* epub.js takes ownership of the render target: Viewport.updateFlow
              assigns `target.className = flow` and sizing reads the target's
              clientWidth/clientHeight. Classes are therefore unusable for
              layout here — the surface lives on this wrapper and the host is
              sized with inline style, which epub.js does not overwrite.
              `data-epub-content-host` is the stable hook that marks the
              sandboxed book-content subtree (axe scans must exclude it: the
              frame is script-disabled, so @axe-core/playwright's runPartial
              never resolves inside it). */}
          <div
            data-epub-content-host="true"
            className="h-[calc(100dvh-8rem)] bg-background-secondary rounded-lg overflow-hidden"
          >
            <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-96">
          <p className="text-foreground-muted">{notAvailableText}</p>
        </div>
      )}
    </main>
  );
}
