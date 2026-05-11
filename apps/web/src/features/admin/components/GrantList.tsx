import { useState } from 'react';

import { Button, Modal } from '@do-epub-studio/ui';

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
        <p className="text-gray-500 dark:text-gray-400">
          {t('grants.selectBookPrompt')}
        </p>
      </div>
    );
  }

  // Loading spinner
  if (isLoadingGrants && selectedBookId) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Empty grant list
  if (selectedBookId && !isLoadingGrants && grants.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">{t('grants.noGrants')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('grants.table.email')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('grants.table.mode')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('grants.table.capabilities')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('grants.table.status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('grants.table.expiry')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('grants.table.created')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('grants.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {grants.map((grant) => (
                <tr
                  key={grant.id}
                  className={
                    isExpired(grant)
                      ? 'bg-red-50 dark:bg-red-900/10'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                >
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {grant.email}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                      {modeLabel(grant.mode)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {grant.commentsAllowed && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                          {t('grants.capabilities.comments')}
                        </span>
                      )}
                      {grant.offlineAllowed && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">
                          {t('grants.capabilities.offline')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {grant.revokedAt ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300">
                        {t('grants.status.revoked')}
                      </span>
                    ) : isExpired(grant) ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300">
                        {t('grants.status.expired')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                        {t('grants.status.active')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(grant.expiresAt, t('grants.never'))}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(grant.createdAt, t('grants.never'))}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex justify-end space-x-2">
                      {!grant.revokedAt && (
                        <>
                          <button
                            onClick={() => onEdit(grant)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {t('grants.actions.edit')}
                          </button>
                          <button
                            onClick={() => setRevokingGrant(grant)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('grants.revokeMessage').replace('{email}', revokingGrant?.email ?? '')}
        </p>
      </Modal>
    </>
  );
}
