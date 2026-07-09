import { NavLink } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { NAV_ITEMS, NavIcon } from './shared';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-background-secondary border-r border-border h-full overflow-y-auto">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <AppLogo size={32} className="text-accent shrink-0" />
        <div className="min-w-0">
          <span className="block truncate font-semibold text-foreground text-sm">{APP_NAME}</span>
          <span className="block text-xs text-foreground-muted">{APP_VERSION_LABEL}</span>
        </div>
      </div>
      <nav className="flex-1 py-3" aria-label={t('nav.catalog')}>
        {NAV_ITEMS.map(({ key, icon, href }) => (
          <NavLink
            key={key}
            to={href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'text-accent bg-accent/10 border-r-2 border-accent'
                  : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
              }`
            }
            aria-label={t(key)}
          >
            {({ isActive }) => (
              <>
                <NavIcon icon={icon} className={`w-5 h-5 shrink-0 ${isActive ? 'text-accent' : ''}`} />
                <span>{t(key)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
