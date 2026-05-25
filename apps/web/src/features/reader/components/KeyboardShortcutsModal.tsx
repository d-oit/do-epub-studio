import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useFocusTrap } from '@do-epub-studio/ui';
import { scaleVariants } from '../../../components/ui';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

export function KeyboardShortcutsModal({ isOpen, onClose, t }: KeyboardShortcutsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, modalRef);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: '← / →', label: t('reader.shortcuts.navigation') },
    { key: 'Ctrl + D', label: t('reader.shortcuts.bookmark') },
    { key: 'H', label: t('reader.shortcuts.highlight') },
    { key: 'C', label: t('reader.shortcuts.comment') },
    { key: 'Ctrl + Alt + T', label: t('reader.shortcuts.toggleToc') },
    { key: 'Ctrl + Alt + B', label: t('reader.shortcuts.toggleBookmarks') },
    { key: 'Ctrl + Alt + M', label: t('reader.shortcuts.toggleComments') },
    { key: 'Ctrl + Alt + S', label: t('reader.shortcuts.toggleSettings') },
    { key: '?', label: t('reader.shortcuts.help') },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={scaleVariants}
        className="glass-panel rounded-2xl shadow-2xl border border-border p-6 w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="shortcuts-title" className="text-xl font-bold text-foreground">
            {t('reader.shortcuts.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background-secondary transition-colors text-foreground-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent outline-none"
            aria-label={t('reader.settings.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <span className="text-sm text-foreground-muted">{shortcut.label}</span>
              <kbd className="px-2 py-1 bg-background-secondary border border-border rounded text-xs font-mono text-foreground min-w-[3rem] text-center">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors focus-visible:ring-2 focus-visible:ring-accent outline-none"
          >
            {t('common.close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
