import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

interface LoginHeaderProps {
  className?: string;
}

export function LoginHeader({ className = '' }: LoginHeaderProps) {
  return (
    <header className={`w-full flex flex-wrap items-center justify-end gap-2 sm:gap-3 ${className}`}>
      <ThemeToggle />
      <LocaleSwitcher />
    </header>
  );
}
