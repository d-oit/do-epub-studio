import { Suspense, use, useActionState, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import {
  fetchAdminBooks,
  fetchGrantsForBook,
  invalidateGrantsCache,
  type BookOption,
} from '../../lib/data-cache';
import { useAuthStore } from '../../stores/auth';
import type { GrantResponse } from '@do-epub-studio/shared';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { PageContainer } from '../../components/ui';
import {
  BookSelector,
  GrantForm,
  GrantList,
  emptyFormData,
} from './components';
import type { Grant, GrantFormData } from './components';

interface LocationState {
  bookTitle?: string;
}

interface GrantsBodyProps {
  bookId: string | undefined;
  token: string;
}

interface GrantsBodyData {
  books: BookOption[];
  grants: GrantResponse[];
}

function GrantsBody({ bookId, token }: GrantsBodyProps) {
  const books = use(fetchAdminBooks(token));
  const grants = use(bookId ? fetchGrantsForBook(bookId, token) : Promise.resolve([]));
  const data: GrantsBodyData = { books, grants };
  return <GrantsView data={data} bookId={bookId} token={token} />;
}

function GrantsView({ data, bookId, token }: { data: GrantsBodyData; bookId: string | undefined; token: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  const { books, grants } = data;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const [formData, setFormData] = useState<GrantFormData>(emptyFormData());

  const [formErrors, formAction, isPending] = useActionState<Record<string, string>, FormData>(
    async (_prevState, fd) => {
      const errors: Record<string, string> = {};
      const getString = (name: string, fallback = ''): string => {
        const v = fd.get(name);
        return typeof v === 'string' ? v : fallback;
      };
      const email = getString('email');
      const mode = getString('mode', 'private');
      const commentsAllowed = fd.get('commentsAllowed') === 'on';
      const offlineAllowed = fd.get('offlineAllowed') === 'on';
      const expiresAt = getString('expiresAt');

      if (!email) errors.email = t('grants.form.error.emailRequired');

      if (!editingGrant) {
        const password = getString('password');
        const passwordConfirm = getString('passwordConfirm');
        if (!password) errors.password = t('grants.form.error.passwordRequired');
        else if (password.length < 8) errors.password = t('grants.form.error.passwordMinLength');
        if (password !== passwordConfirm) errors.passwordConfirm = t('grants.form.error.passwordMismatch');
      }

      if (Object.keys(errors).length > 0) {
        return errors;
      }

      try {
        if (editingGrant) {
          await apiRequest(`/api/admin/grants/${editingGrant.id}`, {
            method: 'PATCH',
            token: token || undefined,
            body: JSON.stringify({
              mode,
              commentsAllowed,
              offlineAllowed,
              expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
            }),
          });
        } else {
          const password = getString('password');
          await apiRequest(`/api/admin/books/${bookId}/grants`, {
            method: 'POST',
            token: token || undefined,
            body: JSON.stringify({
              bookId,
              email,
              password,
              mode,
              commentsAllowed,
              offlineAllowed,
              expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
            }),
          });
        }
        if (bookId) invalidateGrantsCache(bookId);
        setIsModalOpen(false);
        return {};
      } catch (err) {
        return { submit: (err as Error).message };
      }
    },
    {},
  );

  const handleSelectBook = (selectedId: string) => {
    if (selectedId) {
      void navigate(`/admin/books/${selectedId}/grants`);
    } else {
      void navigate('/admin/grants');
    }
  };

  const handleCreateGrant = () => {
    setEditingGrant(null);
    setFormData(emptyFormData());
    setIsModalOpen(true);
  };

  const handleEditGrant = (grant: Grant) => {
    setEditingGrant(grant);
    setFormData({
      email: grant.email,
      password: '',
      passwordConfirm: '',
      mode: grant.mode,
      commentsAllowed: grant.commentsAllowed,
      offlineAllowed: grant.offlineAllowed,
      expiresAt: grant.expiresAt ? grant.expiresAt.split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const handleRevokeGrant = useCallback(
    async (grant: Grant) => {
      try {
        await apiRequest(`/api/admin/grants/${grant.id}/revoke`, {
          method: 'POST',
          token: token || undefined,
        });
        if (bookId) invalidateGrantsCache(bookId);
      } catch (err) {
        alert((err as Error).message);
      }
    },
    [token, bookId],
  );

  const currentBookTitle = locationState?.bookTitle ?? (bookId ? books.find((b) => b.id === bookId)?.title : undefined);

  return (
    <PageContainer className="p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('admin.grants.title')}
          </h1>
          <p className="text-sm text-foreground-muted mt-1">
            {currentBookTitle ?? (bookId ? `${t('admin.books.title')} ID: ${bookId}` : t('admin.grants.selectBook'))}
          </p>
          <button
            onClick={() => void navigate('/admin/books')}
            className="text-sm text-accent hover:opacity-80 mt-1"
          >
            &larr; {t('admin.grants.backToBooks')}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
        </div>
      </header>

      <div className="mt-8">
        <BookSelector
          books={books}
          selectedBookId={bookId ?? ''}
          isLoadingBooks={false}
          onSelectBook={handleSelectBook}
          onCreateGrant={handleCreateGrant}
        />

        <GrantList
          grants={grants}
          isLoadingGrants={false}
          selectedBookId={bookId ?? ''}
          onEdit={handleEditGrant}
          onRevoke={(grant) => { void handleRevokeGrant(grant); }}
        />
      </div>

      <GrantForm
        isOpen={isModalOpen}
        editingGrant={editingGrant}
        formData={formData}
        formErrors={formErrors}
        isSubmitting={isPending}
        onChange={setFormData}
        onSubmit={formAction}
        onClose={() => setIsModalOpen(false)}
      />
    </PageContainer>
  );
}

function GrantsSkeleton() {
  return (
    <div
      className="p-12 flex justify-center"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
    </div>
  );
}

export function AdminGrantResponsesPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const sessionToken = useAuthStore((state) => state.sessionToken);

  return (
    <Suspense
      key={bookId ?? 'all'}
      fallback={<GrantsSkeleton />}
    >
      <GrantsBody bookId={bookId} token={sessionToken ?? ''} />
    </Suspense>
  );
}
