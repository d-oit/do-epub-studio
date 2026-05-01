import type { Bookmark } from '../../../../stores';

interface BookmarksPanelProps {
  isOpen: boolean;
  bookmarks: Bookmark[];
  onClose: () => void;
  onAddBookmark: () => void;
  onDeleteBookmark: (id: string) => void;
  onNavigate: (bookmark: Bookmark) => void;
}

export function BookmarksPanel({
  isOpen,
  bookmarks,
  onClose,
  onAddBookmark,
  onDeleteBookmark,
  onNavigate,
}: BookmarksPanelProps) {
  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 z-40 flex flex-col shadow-xl">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="font-semibold">Bookmarks</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddBookmark}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Add bookmark at current position"
            aria-label="Add bookmark"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {bookmarks.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No bookmarks yet. Click the bookmark icon to save your place.
          </p>
        ) : (
          <div className="space-y-3">
            {bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <button onClick={() => onNavigate(bookmark)} className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {bookmark.label || 'Untitled'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(bookmark.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    onClick={() => onDeleteBookmark(bookmark.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    aria-label="Delete bookmark"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
