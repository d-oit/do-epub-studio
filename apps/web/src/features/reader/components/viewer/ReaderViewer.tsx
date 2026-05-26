interface ReaderViewerProps {
  isLoading: boolean;
  epubUrl: string | null;
  error: string | null;
  pageWidthClass: string;
  viewerRef: React.RefObject<HTMLDivElement>;
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
  return (
    <main className="pt-14 pb-20">
      {error && (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <div className="p-3 bg-accent-error/10 border border-accent-error rounded text-sm text-accent-error">
            {error}
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : epubUrl ? (
        <div className={`mx-auto px-4 py-8 ${pageWidthClass}`}>
          <div
            ref={viewerRef}
            className="h-[calc(100vh-8rem)] bg-background-secondary rounded-lg overflow-hidden"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-96">
          <p className="text-foreground-muted">{notAvailableText}</p>
        </div>
      )}
    </main>
  );
}
