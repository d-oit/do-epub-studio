import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Button, Input } from '../../components/ui';
import { Breadcrumb } from '../../components/navigation';
import { MfaSection } from './MfaSection';

interface AdminSession {
  id: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  assurance_level: string;
  device_label_hash: string;
  current: boolean;
}

interface SessionsResponse {
  sessions: AdminSession[];
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/** Admin route paths (constants avoid i18next/no-literal-string in JSX). */
const ADMIN_ROUTES = { admin: '/admin' } as const;

export function AccountSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sessionToken = useAuthStore((state) => state.sessionToken);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordInfo, setPasswordInfo] = useState<string | null>(null);

  const [sessions, setSessions] = useState<AdminSession[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [logoutAllError, setLogoutAllError] = useState<string | null>(null);
  const [logoutAllInfo, setLogoutAllInfo] = useState<string | null>(null);

  const token = sessionToken ?? undefined;

  const loadSessions = useCallback(async () => {
    setSessionsError(null);
    try {
      const data = await apiRequest<SessionsResponse>('/api/admin/account/sessions', { token });
      setSessions(data.sessions);
    } catch (err) {
      setSessionsError((err as Error).message || t('admin.sessions.loadFailed'));
    }
  }, [token, t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordInfo(null);

    try {
      await apiRequest('/api/admin/account/password-change', {
        method: 'POST',
        token,
        body: JSON.stringify({ currentPassword, newPassword, newPasswordConfirm }),
      });
      setPasswordInfo(t('admin.account.passwordChangeSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch {
      setPasswordError(t('admin.account.passwordChangeFailed'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogoutAll = async () => {
    setIsLoggingOutAll(true);
    setLogoutAllError(null);
    setLogoutAllInfo(null);

    try {
      await apiRequest('/api/admin/account/logout-all', {
        method: 'POST',
        token,
      });
      setLogoutAllInfo(t('admin.sessions.logoutAllSuccess'));
      await loadSessions();
    } catch {
      setLogoutAllError(t('admin.sessions.logoutAllFailed'));
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  return (
    <main id="main-content" className="min-h-dvh bg-background p-4 sm:p-6 lg:p-8">
      <Breadcrumb
        items={[
          { labelKey: 'admin.breadcrumb.home', href: ADMIN_ROUTES.admin },
          { labelKey: 'admin.account.title' },
        ]}
      />
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t('admin.account.title')}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Change password */}
        <section className="rounded-xl border border-border bg-background-secondary p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">{t('admin.account.changePassword')}</h2>

          {passwordInfo && (
            <p role="status" className="mb-4 rounded bg-accent/10 border border-accent/20 p-3 text-sm text-accent">
              {passwordInfo}
            </p>
          )}
          {passwordError && (
            <p role="alert" className="mb-4 rounded bg-accent-error/10 border border-accent-error/20 p-3 text-sm text-accent-error">
              {passwordError}
            </p>
          )}

          <form onSubmit={(e) => { void handlePasswordChange(e); }} className="space-y-4">
            <Input
              id="current-password"
              type="password"
              label={t('admin.account.currentPassword')}
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); }}
              required
              autoComplete="current-password"
            />
            <Input
              id="new-password"
              type="password"
              label={t('admin.account.newPassword')}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); }}
              required
              autoComplete="new-password"
              minLength={8}
            />
            <Input
              id="new-password-confirm"
              type="password"
              label={t('admin.account.newPasswordConfirm')}
              value={newPasswordConfirm}
              onChange={(e) => { setNewPasswordConfirm(e.target.value); }}
              required
              autoComplete="new-password"
              minLength={8}
            />
            <Button type="submit" isLoading={isChangingPassword} loadingLabel={t('admin.account.changingPassword')}>
              {t('admin.account.changePassword')}
            </Button>
          </form>
        </section>

        {/* Active sessions */}
        <section className="rounded-xl border border-border bg-background-secondary p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">{t('admin.sessions.title')}</h2>
            <Button
              variant="danger"
              size="sm"
              isLoading={isLoggingOutAll}
              loadingLabel={t('admin.sessions.loggingOutAll')}
              onClick={() => { void handleLogoutAll(); }}
            >
              {t('admin.sessions.logoutAll')}
            </Button>
          </div>

          {logoutAllInfo && (
            <p role="status" className="mb-4 rounded bg-accent/10 border border-accent/20 p-3 text-sm text-accent">
              {logoutAllInfo}
            </p>
          )}
          {logoutAllError && (
            <p role="alert" className="mb-4 rounded bg-accent-error/10 border border-accent-error/20 p-3 text-sm text-accent-error">
              {logoutAllError}
            </p>
          )}

          {sessionsError && (
            <p role="alert" className="mb-4 rounded bg-accent-error/10 border border-accent-error/20 p-3 text-sm text-accent-error">
              {sessionsError}
            </p>
          )}

          {sessions && sessions.length === 0 && !sessionsError && (
            <p className="text-sm text-foreground-muted">{t('admin.sessions.empty')}</p>
          )}

          <ul className="space-y-3">
            {sessions?.map((session) => (
              <li key={session.id} className="rounded-lg border border-border bg-surface p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {session.current
                      ? t('admin.sessions.current')
                      : session.device_label_hash || t('admin.sessions.unknownDevice')}
                  </span>
                  {session.current && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                      {t('admin.sessions.current')}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-foreground-muted">
                  {/* eslint-disable-next-line i18next/no-literal-string -- technical metadata labels */}
                  <p>ID: {session.id.slice(0, 8)}</p>
                  {/* eslint-disable-next-line i18next/no-literal-string -- technical metadata labels */}
                  <p>Created: {formatDateTime(session.created_at)}</p>
                  {/* eslint-disable-next-line i18next/no-literal-string -- technical metadata labels */}
                  <p>Last used: {formatDateTime(session.last_used_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Security / MFA (ADR-234 items 5+6) */}
        <MfaSection />
      </div>

      <div className="mt-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void navigate(ADMIN_ROUTES.admin);
          }}
        >
          {t('admin.account.backToDashboard')}
        </Button>
      </div>
    </main>
  );
}
