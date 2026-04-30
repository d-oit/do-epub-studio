interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

interface TableOfContentsProps {
  isOpen: boolean;
  toc: TocItem[];
  onClose: () => void;
  onNavigate: (href: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string) => any;
}

export function TableOfContents({ isOpen, toc, onClose, onNavigate, t }: TableOfContentsProps) {
  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="font-semibold">{t('reader.tableOfContents')}</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
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
      <nav className="p-2">
        {toc.length > 0 ? (
          toc.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                onNavigate(item.href);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {item.label}
            </button>
          ))
        ) : (
          <p className="px-3 py-2 text-sm text-gray-500">{t('reader.noChapters')}</p>
        )}
      </nav>
    </aside>
  );
}
