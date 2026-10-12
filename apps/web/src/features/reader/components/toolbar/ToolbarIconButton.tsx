import { IconButton, Tooltip } from '../../../../components/ui';

// ─── SVG path constants (avoids i18next/no-literal-string on JSX props) ────
export const PATH_SEARCH = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z';
export const PATH_COMMENT =
  'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z';
export const PATH_BOOKMARK = 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z';
export const PATH_INFO = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
export const PATH_FIXED_LAYOUT =
  'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4';
export const PATH_EXPORT =
  'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
export const PATH_SETTINGS_GEAR =
  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z';
export const PATH_SETTINGS_DOT = 'M15 12a3 3 0 11-6 0 3 3 0 016 0z';

// ─── Shared toolbar button: Tooltip + IconButton + svg path ─────────────────

export interface ToolbarIconButtonProps {
  label: string;
  svgPath: string | string[];
  onClick: () => void;
  isExpanded?: boolean;
  badge?: number;
  badgeLabel?: string;
}

export function ToolbarIconButton({
  label,
  svgPath,
  onClick,
  isExpanded,
  badge,
  badgeLabel,
}: ToolbarIconButtonProps) {
  const paths = Array.isArray(svgPath) ? svgPath : [svgPath];
  const ariaLabel = badge && badge > 0 && badgeLabel ? badgeLabel : label;
  return (
    <Tooltip content={label}>
      <IconButton
        onClick={onClick}
        variant="ghost"
        aria-label={ariaLabel}
        aria-expanded={isExpanded}
        className="relative"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          {paths.map((d, i) => (
            <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
          ))}
        </svg>
        {badge != null && badge > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 bg-primary-700 text-background text-[10px] rounded-full flex items-center justify-center font-bold"
            aria-hidden="true"
          >
            {badge}
          </span>
        )}
      </IconButton>
    </Tooltip>
  );
}
