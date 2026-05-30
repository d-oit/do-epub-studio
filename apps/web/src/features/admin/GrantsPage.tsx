import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import type { GrantResponse } from '@do-epub-studio/shared';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Modal, Button } from '../../components/ui';

interface LocationState {
  bookTitle?: string;
}

export function AdminGrantResponsesPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const sessionToken = useAuthStore((state) => state.sessionToken);

  const [grants, setGrantResponses] = useState<GrantResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMode, setInviteMode] = useState('reader_only');
  const [commentsAllowed, setCommentsAllowed] = useState(true);
  const [offlineAllowed, setOfflineAllowed] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchGrantResponses = useCallback(async () => {
    if (!bookId) return;
    setIsLoading(true);
    try {
      const data = await apiRequest<GrantResponse[]>(`/api/admin/books/${bookId}/grants`, { token: sessionToken ?? undefined });
      setGrantResponses(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [bookId, sessionToken]);

  useEffect(() => {
    void fetchGrantResponses();
  }, [bookId, fetchGrantResponses]);

  const resetCreateForm = () => {
    setInviteEmail('');
    setInviteMode('reader_only');
    setCommentsAllowed(true);
    setOfflineAllowed(false);
    setExpiresAt('');
    setCreateError(null);
  };

  const handleCreateGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!inviteEmail.trim()) {
      setCreateError(t('admin.grants.error.emailRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/admin/books/${bookId}/grants`, {
        method: 'POST',
        token: sessionToken ?? undefined,
        body: JSON.stringify({
          bookId,
          email: inviteEmail.trim(),
          mode: inviteMode,
          commentsAllowed,
          offlineAllowed,
          expiresAt: expiresAt || null,
        }),
      });
      setIsCreateModalOpen(false);
      resetCreateForm();
      void fetchGrantResponses();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (grantId: string) => {
    if (!confirm(t('admin.grants.confirmRevoke'))) return;
    try {
      await apiRequest(`/api/admin/grants/${grantId}/revoke`, { method: 'POST', token: sessionToken ?? undefined });
      void fetchGrantResponses();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (!bookId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('admin.grants.title')}
        </h1>
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          {t('admin.grants.selectBook')}
        </p>
        <button onClick={() => void navigate('/admin/books')} className="mt-4 text-primary-600 hover:text-primary-700">
          &larr; {t('admin.grants.backToBooks')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin.grants.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {locationState?.bookTitle ?? `${t('admin.books.title')} ID: ${bookId}`}
          </p>
          <button
            onClick={() => void navigate('/admin/books')}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 mt-1"
          >
            &larr; {t('admin.grants.backToBooks')}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={() => setIsCreateModalOpen(true)}>
            {t('admin.grants.createGrant')}
          </Button>
          <LocaleSwitcher />
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.grants.email')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.grants.mode')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin.grants.expires')}
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {grants.map((grant) => (
                <tr key={grant.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {grant.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {grant.mode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {grant.expiresAt ? new Date(grant.expiresAt).toLocaleDateString() : t('admin.grants.never')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => void handleRevoke(grant.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      {t('admin.grants.revoke')}
                    </button>
                  </td>
                </tr>
              ))}
              {grants.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    {t('admin.grants.noGrantResponses')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetCreateForm();
        }}
        title={t('admin.grants.createGrantModal.title')}
      >
        <form onSubmit={(e) => { void handleCreateGrant(e); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.grants.createGrantModal.emailLabel')}
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t('admin.grants.createGrantModal.emailPlaceholder')}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.grants.createGrantModal.modeLabel')}
            </label>
            <select
              value={inviteMode}
              onChange={(e) => setInviteMode(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
            >
              <option value="reader_only">Read</option>
              <option value="editorial_review">Comment</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="commentsAllowed"
              checked={commentsAllowed}
              onChange={(e) => setCommentsAllowed(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="commentsAllowed" className="text-sm text-gray-700 dark:text-gray-300">
              {t('admin.grants.createGrantModal.commentsAllowed')}
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="offlineAllowed"
              checked={offlineAllowed}
              onChange={(e) => setOfflineAllowed(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="offlineAllowed" className="text-sm text-gray-700 dark:text-gray-300">
              {t('admin.grants.createGrantModal.offlineAllowed')}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.grants.createGrantModal.expiresLabel')}
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
            />
          </div>

          {createError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {createError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                resetCreateForm();
              }}
            >
              {t('admin.grants.createGrantModal.close')}
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
            >
              {isSubmitting ? t('admin.grants.createGrantModal.submitting') : t('admin.grants.createGrantModal.submit')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
