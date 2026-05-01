import { Button } from '@do-epub-studio/ui';

import { useTranslation } from '../../../hooks/useTranslation';
import type { Book } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BookSelectorProps {
  books: Book[];
  selectedBookId: string;
  isLoadingBooks: boolean;
  onSelectBook: (bookId: string) => void;
  onCreateGrant: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BookSelector({
  books,
  selectedBookId,
  isLoadingBooks,
  onSelectBook,
  onCreateGrant,
}: BookSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
      <div className="flex items-center space-x-3">
        <label
          htmlFor="book-selector"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {t('grants.selectBook')}
        </label>
        <select
          id="book-selector"
          value={selectedBookId}
          onChange={(e) => onSelectBook(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoadingBooks}
        >
          <option value="">{t('grants.allBooks')}</option>
          {books.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title}
            </option>
          ))}
        </select>
      </div>

      {selectedBookId && (
        <Button onClick={onCreateGrant} size="sm">
          {t('grants.createGrant')}
        </Button>
      )}
    </div>
  );
}
