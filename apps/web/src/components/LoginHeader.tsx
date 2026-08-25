import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

interface LoginHeaderProps {
  className?: string;
}

export function LoginHeader({ className = '' }: LoginHeaderProps) {
  return (
    <header
      data-testid="login-header"
      className={`w-full max-w-6xl mx-auto px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-end gap-2 sm:gap-3 transition-all ${className}`}
    >
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 max-w-full min-w-0">
        <div className="shrink-0 focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 rounded-lg transition-shadow">
          <ThemeToggle />
        </div>
        <div className="shrink-0 max-w-full min-w-0">
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
