import { lazy, Suspense } from 'react';
import { Button } from '../../../../components/ui';
import { LocaleSwitcher } from '../../../../components/LocaleSwitcher';
import type { ReaderPanel } from '../../hooks/useReaderUi';
import type { RenditionItem } from '@do-epub-studio/reader-core';
import { NotificationBadge } from '../notifications/NotificationBadge';
import type { TFn } from './toolbar-types';
import {
  ToolbarIconButton,
  PATH_SEARCH,
  PATH_COMMENT,
  PATH_BOOKMARK,
  PATH_INFO,
  PATH_FIXED_LAYOUT,
  PATH_EXPORT,
  PATH_SETTINGS_GEAR,
  PATH_SETTINGS_DOT,
  PATH_SPEAKER,
} from './ToolbarIconButton';

const RenditionSelector = lazy(() =>
  import('./RenditionSelector').then((m) => ({ default: m.RenditionSelector })),
);

// ─── Desktop action buttons (right section) ──────────────────────────────────

interface ToolbarActionsProps {
  capabilities: { canComment?: boolean } | null;
  activePanel: ReaderPanel;
  isFixedLayout: boolean;
  openCommentsCount: number;
  bookmarkCount: number;
  onToggleSearch: () => void;
  onToggleComments: () => void;
  onToggleBookmarks: () => void;
  onToggleInfo: () => void;
  onToggleFixedLayoutControls?: () => void;
  onExportNotes: () => void;
  onToggleSettings: () => void;
  onLogout: () => void;
  onToggleNotifications?: () => void;
  hasMediaOverlays?: boolean;
  isMediaOverlayActive?: boolean;
  onToggleMediaOverlay?: () => void;
  renditions?: RenditionItem[];
  activeRendition?: RenditionItem | null;
  onSelectRendition?: (fullPath: string) => void;
  t: TFn;
}

export function ToolbarActions({
  capabilities,
  activePanel,
  isFixedLayout,
  openCommentsCount,
  bookmarkCount,
  onToggleSearch,
  onToggleComments,
  onToggleBookmarks,
  onToggleInfo,
  onToggleFixedLayoutControls,
  onExportNotes,
  onToggleSettings,
  onLogout,
  onToggleNotifications,
  hasMediaOverlays,
  isMediaOverlayActive,
  onToggleMediaOverlay,
  renditions,
  activeRendition,
  onSelectRendition,
  t,
}: ToolbarActionsProps) {
  return (
    <div className="cq-reader-toolbar-actions items-center gap-1">
      <ToolbarIconButton
        label={t('reader.search')}
        onClick={onToggleSearch}
        isExpanded={activePanel === 'search'}
        svgPath={PATH_SEARCH}
      />
      {capabilities?.canComment && (
        <ToolbarIconButton
          label={t('annotation.comment')}
          onClick={onToggleComments}
          isExpanded={activePanel === 'comments'}
          svgPath={PATH_COMMENT}
          badge={openCommentsCount}
          badgeLabel={t('annotation.comment_with_count', { count: openCommentsCount })}
        />
      )}
      <NotificationBadge
        t={t as (key: string) => string}
        onClick={onToggleNotifications ?? (() => {})}
      />
      <ToolbarIconButton
        label={t('reader.bookmarks')}
        onClick={onToggleBookmarks}
        isExpanded={activePanel === 'bookmarks'}
        svgPath={PATH_BOOKMARK}
        badge={bookmarkCount}
        badgeLabel={t('reader.bookmarks_with_count', { count: bookmarkCount })}
      />
      <ToolbarIconButton
        label={t('reader.aboutBook')}
        onClick={onToggleInfo}
        isExpanded={activePanel === 'info'}
        svgPath={PATH_INFO}
      />
      {isFixedLayout && onToggleFixedLayoutControls && (
        <ToolbarIconButton
          label={t('reader.fixedLayout.title')}
          onClick={onToggleFixedLayoutControls}
          isExpanded={activePanel === 'fl-controls'}
          svgPath={PATH_FIXED_LAYOUT}
        />
      )}
      <ToolbarIconButton
        label={t('reader.exportNotes')}
        onClick={onExportNotes}
        svgPath={PATH_EXPORT}
      />
      <ToolbarIconButton
        label={t('reader.settings')}
        onClick={onToggleSettings}
        isExpanded={activePanel === 'settings'}
        svgPath={[PATH_SETTINGS_GEAR, PATH_SETTINGS_DOT]}
      />
      {hasMediaOverlays && onToggleMediaOverlay && (
        <ToolbarIconButton
          label={t('reader.mediaOverlay.title')}
          onClick={onToggleMediaOverlay}
          isExpanded={isMediaOverlayActive}
          svgPath={PATH_SPEAKER}
        />
      )}
      {renditions && renditions.length > 1 && (
        <Suspense fallback={null}>
          <RenditionSelector
            renditions={renditions}
            activeRendition={activeRendition ?? null}
            onSelectRendition={onSelectRendition ?? (() => {})}
            t={t}
          />
        </Suspense>
      )}
      <div className="mx-1 h-6 w-px bg-border cq-reader-toolbar-divider" />
      <LocaleSwitcher />
      <Button onClick={onLogout} variant="ghost" size="sm">
        {t('reader.signOut')}
      </Button>
    </div>
  );
}
