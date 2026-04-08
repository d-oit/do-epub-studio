import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

interface LoginResponse {
  ok: boolean;
  data?: {
    sessionToken: string;
    book: {
      id: string;
      slug: string;
      title: string;
      authorName: string | null;
    };
    capabilities: {
      canRead: boolean;
      canComment: boolean;
      canHighlight: boolean;
      canBookmark: boolean;
      canDownloadOffline: boolean;
      canExportNotes: boolean;
      canManageAccess: boolean;
    };
  };
  error?: { code: string; message: string };
}

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [bookSlug, setBookSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/access/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookSlug: bookSlug.trim(),
          email: email.trim().toLowerCase(),
          password: password || undefined,
        }),
      });

      const data: LoginResponse = await response.json();

      if (!data.ok || !data.data) {
        setError(data.error?.message || 'Access denied');
        return;
      }

      setAuth({
        sessionToken: data.data.sessionToken,
        bookId: data.data.book.id,
        bookSlug: data.data.book.slug,
        bookTitle: data.data.book.title,
        email: email.trim().toLowerCase(),
        capabilities: data.data.capabilities,
      });

      navigate(`/read/${data.data.book.slug}`);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            do EPUB Studio
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Sign in to access your books
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4"
        >
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="bookSlug"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Book URL Slug
            </label>
            <input
              id="bookSlug"
              type="text"
              value={bookSlug}
              onChange={(e) => setBookSlug(e.target.value)}
              placeholder="my-book-slug"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reader@example.com"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Password (if required)
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
