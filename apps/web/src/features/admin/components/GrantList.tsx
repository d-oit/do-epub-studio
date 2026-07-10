import { useState } from 'react';

import { Button, Modal, Spinner } from '@do-epub-studio/ui';

import { useTranslation } from '../../../hooks/useTranslation';
import { GRANT_MODES } from './types';
import type { Grant } from './types';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function modeLabel(mode: string): string {
  const found = GRANT_MODES.find((m) => m.value === mode);
  return found ? found.label : mode;
}

function formatDate(dateStr: string | null, neverLabel: string): string {
  if (!dateStr) return neverLabel;
  return new Date(dateStr).toLocaleDateString();
}

function isExpired(grant: Grant): boolean {
  if (grant.revokedAt) return true;
  if (grant.expiresAt) return new Date(grant.expiresAt) < new Date();
  return false;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GrantListProps {
  grants: Grant[];
  isLoadingGrants: boolean;
  selectedBookId: string;
  onEdit: (grant: Grant) => void;
  onRevoke: (grant: Grant) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GrantList({
  grants,
  isLoadingGrants,
  selectedBookId,
  onEdit,
  onRevoke,
}: GrantListProps) {
  const { t } = useTranslation();
  const [revokingGrant, setRevokingGrant] = useState<Grant | null>(null);

  const handleConfirmRevoke = () => {
    if (revokingGrant) {
      onRevoke(revokingGrant);
      setRevokingGrant(null);
    }
  };

  // Empty prompt when no book is selected
  if (!selectedBookId && !isLoadingGrants) {
    return (
      <div className="text-center py-12">
        <p className="text-foreground-muted">
          {t('grants.selectBookPrompt')}
        </p>
      </div>
    );
  }

  // Loading spinner
  if (isLoadingGrants && selectedBookId) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  // Empty grant list
  if (selectedBookId && !isLoadingGrants && grants.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-foreground-muted">{t('grants.noGrants')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-background rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-background-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  {t('grants.table.email')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  {t('grants.table.mode')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  {t('grants.table.capabilities')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  {t('grants.table.status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  {t('grants.table.expiry')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  {t('grants.table.created')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-foreground-muted uppercase tracking-wider">
                  {t('grants.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {grants.map((grant) => (
                <tr
                  key={grant.id}
                  className={
                    isExpired(grant)
                      ? 'bg-semantic-error/10'
                      : 'hover:bg-background-secondary'
                  }
                >
                  <td className="px-4 py-3 text-sm text-foreground">
                    {grant.email}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-semantic-info/20 text-semantic-info">
                      {modeLabel(grant.mode)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {grant.commentsAllowed && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-semantic-success/20 text-semantic-success">
                          {t('grants.capabilities.comments')}
                        </span>
                      )}
                      {grant.offlineAllowed && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-secondary/20 text-accent-secondary">
                          {t('grants.capabilities.offline')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {grant.revokedAt ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-semantic-error/20 text-semantic-error">
                        {t('grants.status.revoked')}
                      </span>
                    ) : isExpired(grant) ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-semantic-warning/20 text-semantic-warning">
                        {t('grants.status.expired')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-semantic-success/20 text-semantic-success">
                        {t('grants.status.active')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground-muted">
                    {formatDate(grant.expiresAt, t('grants.never'))}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground-muted">
                    {formatDate(grant.createdAt, t('grants.never'))}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex justify-end space-x-2">
                      {!grant.revokedAt && (
                        <>
                          <button
                            onClick={() => onEdit(grant)}
                            className="text-semantic-info hover:opacity-80"
                          >
                            {t('grants.actions.edit')}
                          </button>
                          <button
                            onClick={() => setRevokingGrant(grant)}
                            className="text-semantic-error hover:opacity-80"
                          >
                            {t('grants.actions.revoke')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revoke confirmation modal */}
      <Modal
        isOpen={revokingGrant !== null}
        onClose={() => setRevokingGrant(null)}
        title={t('grants.revokeTitle')}
        footer={
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => setRevokingGrant(null)}>
              {t('annotation.cancel')}
            </Button>
            <Button variant="danger" onClick={handleConfirmRevoke}>
              {t('grants.actions.revoke')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-foreground-muted">
          {/* eslint-disable-next-line i18next/no-literal-string -- template placeholder in .replace() */}
          {t('grants.revokeMessage').replace('{email}', revokingGrant?.email ?? '')}
        </p>
      </Modal>
    </>
  );
}
