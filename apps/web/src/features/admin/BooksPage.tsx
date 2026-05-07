import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Button, Card, Badge, Modal, Input, Header, IconButton } from '../../components/ui';

interface Book {
  id: string;
  slug: string;
  title: string;
  authorName: string | null;
  visibility: string;
  coverImageUrl: string | null;
}

const containerVariants = {
  animate: {
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  },
};

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

  const navItems = [
    { label: 'Books', path: '/admin/books', active: true },
    { label: 'Access Grants', path: '/admin/grants', active: false },
    { label: 'Audit Log', path: '/admin/audit', active: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-foreground">{t('admin.dashboardTitle')}</h1>
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      ${
                        item.active
                          ? 'text-accent bg-accent/10'
                          : 'text-foreground-muted hover:text-foreground hover:bg-background-secondary'
                      }
                    `}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm text-foreground-muted">{email}</span>
              <LocaleSwitcher />
              <IconButton onClick={handleLogout} aria-label="Sign out">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </IconButton>
            </div>
          </div>
        </div>
      </Header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t('admin.yourBooks')}</h2>
            <p className="mt-1 text-foreground-muted">
              Manage your EPUB collection and access permissions
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t('admin.createBook')}
          </Button>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-accent-error/10 border border-accent-error/20 rounded-lg text-accent-error"
          >
            {error}
          </motion.div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-96 animate-pulse" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 glass-card"
          >
            <div className="mx-auto w-16 h-16 bg-background-tertiary rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-foreground-muted"
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
            <p className="text-foreground-muted">{t('admin.noBooks')}</p>
            <Button variant="secondary" className="mt-4" onClick={() => setShowCreateModal(true)}>
              Add your first book
            </Button>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {books.map((book) => (
              <motion.div key={book.id} variants={itemVariants}>
                <Card variant="glass" className="h-full flex flex-col group">
                  <div className="aspect-[3/4] bg-background-secondary overflow-hidden rounded-t-xl">
                    {book.coverImageUrl ? (
                      <img
                        src={book.coverImageUrl}
                        alt={book.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-foreground-muted">
                        <svg
                          className="w-16 h-16 opacity-50"
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
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-foreground truncate flex-1">
                        {book.title}
                      </h3>
                      <Badge variant={book.visibility === 'public' ? 'success' : 'default'}>
                        {book.visibility}
                      </Badge>
                    </div>
                    {book.authorName && (
                      <p className="text-sm text-foreground-muted mb-4">{book.authorName}</p>
                    )}
                    <div className="mt-auto pt-4 flex items-center gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/admin/books/${book.id}/grants`)}
                        className="flex-1"
                      >
                        {t('admin.manageGrants')}
                      </Button>
                      <Button size="sm" onClick={() => handleReadBook(book)} className="flex-1">
                        {t('admin.read')}
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      <CreateBookModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        sessionToken={sessionToken || ''}
        onCreated={() => {
          setShowCreateModal(false);
          void fetchBooks();
        }}
      />
    </div>
  );
}

interface CreateBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToken: string;
  onCreated: () => void;
}

function CreateBookModal({ isOpen, onClose, sessionToken, onCreated }: CreateBookModalProps) {
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
      const bookData = await apiRequest<{ id: string; slug: string; uploadUrl: string }>(
        '/api/admin/books',
        {
          method: 'POST',
          token: sessionToken,
          body: JSON.stringify({ title, authorName: authorName || null, visibility }),
        },
      );

      const uploadResponse = await fetch(bookData.uploadUrl, {
        method: 'PUT',
        body: epubFile,
        headers: {
          'Content-Type': 'application/epub+zip',
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (!uploadResponse.ok) {
        const errorBody = (await uploadResponse.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(
          errorBody?.error?.message ??
            `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
        );
      }
      const uploadResult = (await uploadResponse.json()) as { data: { storageKey: string } };

      await apiRequest(`/api/admin/books/${bookData.id}/upload-complete`, {
        method: 'POST',
        token: sessionToken,
        body: JSON.stringify({
          storageKey: uploadResult.data.storageKey,
          originalFilename: epubFile.name,
          fileSizeBytes: epubFile.size,
          mimeType: epubFile.type || 'application/epub+zip',
        }),
      });

      onCreated();
    } catch (err) {
      setError((err as Error).message || 'Failed to create book');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('admin.createBook')}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input label="Author" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Visibility</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">EPUB File *</label>
          <input
            type="file"
            accept=".epub,application/epub+zip"
            onChange={(e) => setEpubFile(e.target.files?.[0] || null)}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent file:text-white hover:file:bg-accent/90"
          />
        </div>

        {error && (
          <div className="p-3 bg-accent-error/10 border border-accent-error/20 rounded-lg text-sm text-accent-error">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" isLoading={isUploading} className="flex-1">
            {isUploading ? 'Uploading...' : 'Create Book'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
