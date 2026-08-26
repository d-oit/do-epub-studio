import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

export interface LoginHeaderProps {
  className?: string;
}

export function LoginHeader({ className = '' }: LoginHeaderProps) {
  return (
    <div
      data-testid="login-header-controls"
      className={`fixed right-3 top-3 z-20 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-end gap-2 sm:right-4 sm:top-4 sm:gap-3 ${className}`}
    >
      <ThemeToggle />
      <LocaleSwitcher />
    </div>
  );
}
