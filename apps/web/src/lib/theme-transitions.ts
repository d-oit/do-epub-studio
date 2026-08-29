import type { ReaderTheme } from '../stores/reader-prefs';

export function applyTheme(theme: ReaderTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
}

export async function goToChapter(fn: () => void | Promise<void>) {
  if (
    !('startViewTransition' in document) ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    await fn();
    return;
  }
  (document as unknown as { startViewTransition: (cb: () => void | Promise<void>) => void }).startViewTransition(fn);
}
