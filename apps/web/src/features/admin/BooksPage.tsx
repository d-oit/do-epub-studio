import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';

interface Book {
  id: string;
  slug: string;
  title: string;
  authorName: string | null;
  visibility: string;
  coverImageUrl: string | null;
}

export function AdminBooksPage() {
  const navigate = useNavigate();
  const { sessionToken, logout, email } = useAuthStore();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!sessionToken) {
      navigate('/login');
      return;
    }
  }, [sessionToken, navigate]);

  const fetchBooks = useCallback(async () => {
    if (!sessionToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Book[]>('/api/books', {
        token: sessionToken,
      });
      setBooks(data || []);
    } catch (err) {
      setError((err as Error).message || t('admin.error.loadBooks'));
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, t]);

  useEffect(() => {
    void fetchBooks();
  }, [fetchBooks]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleReadBook = (book: Book) => {
    navigate(`/read/${book.slug}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('admin.dashboardTitle')}
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">{email}</span>
              <LocaleSwitcher />
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                {t('admin.userMenu.signOut')}
              </button>
            </div>
          </div>
          <nav className="flex gap-4 text-sm">
            <button
              onClick={() => navigate('/admin/books')}
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
            >
              Books
            </button>
            <button
              onClick={() => navigate('/admin/grants')}
              className="text-gray-600 hover:text-gray-700 dark:text-gray-400"
            >
              Access Grants
            </button>
            <button
              onClick={() => navigate('/admin/audit')}
              className="text-gray-600 hover:text-gray-700 dark:text-gray-400"
            >
              Audit Log
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('admin.yourBooks')}
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md"
          >
            {t('admin.createBook')}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">{t('admin.noBooks')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => (
              <div
                key={book.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-[3/4] bg-gray-200 dark:bg-gray-700">
                  {book.coverImageUrl ? (
                    <img
                      src={book.coverImageUrl}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg
                        className="w-12 h-12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {book.title}
                  </h3>
                  {book.authorName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{book.authorName}</p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                      {book.visibility}
                    </span>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => navigate(`/admin/books/${book.id}/grants`)}
                        className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                      >
                        {t('admin.manageGrants')}
                      </button>
                      <button
                        onClick={() => handleReadBook(book)}
                        className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                      >
                        {t('admin.read')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreateModal && sessionToken && (
        <CreateBookModal
          sessionToken={sessionToken}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            void fetchBooks();
          }}
        />
      )}
    </div>
  );
}

interface CreateBookModalProps {
  sessionToken: string;
  onClose: () => void;
  onCreated: () => void;
}

function CreateBookModal({ sessionToken, onClose, onCreated }: CreateBookModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [epubFile, setEpubFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!epubFile) {
      setError('Please select an EPUB file');
      return;
    }
    setIsUploading(true);
    setError(null);

    try {
      // Step 1: Create book record
      const bookData = await apiRequest<{ id: string; slug: string; uploadUrl: string }>(
        '/api/admin/books',
        {
          method: 'POST',
          token: sessionToken,
          body: JSON.stringify({ title, authorName: authorName || null, visibility }),
        },
      );

      // Step 2: Upload EPUB file to presigned URL
      const uploadResponse = await fetch(bookData.uploadUrl, {
        method: 'PUT',
        body: epubFile,
        headers: { 'Content-Type': 'application/epub+zip' },
      });
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      // Step 3: Mark upload complete
      await apiRequest(`/api/admin/books/${bookData.id}/upload-complete`, {
        method: 'POST',
        token: sessionToken,
        body: JSON.stringify({}),
      });

      onCreated();
    } catch (err) {
      setError((err as Error).message || 'Failed to create book');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('admin.createBook')}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Author
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              EPUB File *
            </label>
            <input
              type="file"
              accept=".epub,application/epub+zip"
              onChange={(e) => setEpubFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Create Book'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
