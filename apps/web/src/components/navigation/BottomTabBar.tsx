import { NavLink } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { NAV_ITEMS, NavIcon } from './shared';

export function BottomTabBar() {
  const { t } = useTranslation();

  return (
    <nav
      className="bottom-tab-bar fixed bottom-0 left-0 right-0 z-40 bg-background-secondary border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label={t('nav.catalog')}
    >
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map(({ key, icon, href }) => (
          <NavLink
            key={key}
            to={href}
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
