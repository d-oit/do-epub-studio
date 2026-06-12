import { NavLink } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';

const NAV_ITEMS = [
  { key: 'nav.library' as const, icon: 'library', href: '/catalog' },
  { key: 'nav.reader' as const, icon: 'book-open', href: '/read' },
  { key: 'nav.settings' as const, icon: 'settings', href: '/admin/books' },
] as const;

function NavIcon({ icon, className = '' }: { icon: string; className?: string }) {
  const paths: Record<string, string> = {
    library:
      'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
    'book-open':
      'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z',
    settings:
      'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
  };

  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d={paths[icon] ?? paths.library} />
    </svg>
  );
}

export function BottomTabBar() {
  const { t } = useTranslation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-background-secondary border-t border-border md:hidden"
      role="tablist"
      aria-label={t('nav.library')}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map(({ key, icon, href }) => (
          <NavLink
            key={key}
            to={href}
            role="tab"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] transition-colors ${
                isActive
                  ? 'text-accent'
                  : 'text-foreground-muted hover:text-foreground'
              }`
            }
            aria-label={t(key)}
          >
            {({ isActive }) => (
              <>
                <NavIcon
                  icon={icon}
                  className={`w-6 h-6 ${isActive ? 'text-accent' : ''}`}
                />
                <span className="text-[10px] leading-tight">{t(key)}</span>
                {isActive && (
                  <span
                    className="absolute top-0 w-8 h-0.5 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
