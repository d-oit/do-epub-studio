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
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : epubUrl ? (
        <div className={`mx-auto px-4 py-8 ${pageWidthClass}`}>
          <div
            ref={viewerRef}
            className="h-[calc(100vh-8rem)] bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500 dark:text-gray-400">{notAvailableText}</p>
        </div>
      )}
    </main>
  );
}
