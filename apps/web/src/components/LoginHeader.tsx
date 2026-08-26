import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

export interface LoginHeaderProps {
  className?: string;
}

export function LoginHeader({ className = '' }: LoginHeaderProps) {
  return (
    <header
      data-testid="login-header-controls"
      className={`relative z-20 flex w-full max-w-7xl mx-auto items-center justify-end gap-2 px-4 pt-4 sm:gap-3 sm:px-6 lg:px-8 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
    </header>
  );
}
