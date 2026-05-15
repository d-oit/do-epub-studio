import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { scaleVariants } from '../../../../components/ui';

interface ReaderSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark' | 'sepia' | 'system';
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  fontFamily: 'serif' | 'sans-serif' | 'monospace';
  onSetTheme: (theme: 'light' | 'dark' | 'sepia' | 'system') => void;
  onSetFontSize: (size: 'small' | 'medium' | 'large' | 'xlarge') => void;
  onSetFontFamily: (family: 'serif' | 'sans-serif' | 'monospace') => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string) => any;
}

export function ReaderSettingsPanel({
  isOpen,
  onClose,
  theme,
  fontSize,
  fontFamily,
  onSetTheme,
  onSetFontSize,
  onSetFontFamily,
  t,
}: ReaderSettingsPanelProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={scaleVariants}
      className="fixed top-14 right-4 glass-panel rounded-xl shadow-xl border border-border p-4 z-50 w-72"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">{t('reader.settings')}</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-background-secondary transition-colors text-foreground-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent outline-none"
          aria-label={t('reader.settings.close')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wider mb-2">
            {t('reader.theme')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['light', 'dark', 'sepia', 'system'] as const).map((themeOption) => (
              <button
                key={themeOption}
                onClick={() => onSetTheme(themeOption)}
                aria-pressed={theme === themeOption}
                aria-label={t(`reader.settings.theme.${themeOption}`)}
                className={`
                  px-3 py-2 text-sm rounded-lg border transition-all duration-150 outline-none
                  focus-visible:ring-2 focus-visible:ring-accent
                  ${
                    theme === themeOption
                      ? 'bg-accent text-white border-accent font-medium shadow-sm'
                      : 'bg-background-secondary text-foreground border-border hover:border-foreground-muted'
                  }
                `}
              >
                {t(`reader.settings.theme.${themeOption}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wider mb-2">
            {t('reader.fontSize')}
          </label>
          <div className="flex gap-1.5 p-1 bg-background-secondary rounded-lg">
            {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
              <button
                key={size}
                onClick={() => onSetFontSize(size)}
                aria-pressed={fontSize === size}
                aria-label={t(`reader.settings.fontSize.${size}`)}
                className={`
                  flex-1 py-1.5 text-xs rounded-md transition-all duration-150 outline-none
                  focus-visible:ring-2 focus-visible:ring-accent
                  ${
                    fontSize === size
                      ? 'bg-background shadow-sm text-foreground font-semibold'
                      : 'text-foreground-muted hover:text-foreground'
                  }
                `}
              >
                {size === 'small' ? 'A' : size === 'medium' ? 'A+' : size === 'large' ? 'A++' : 'A+++'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wider mb-2">
            {t('reader.fontFamily')}
          </label>
          <div className="flex flex-col gap-1">
            {(['serif', 'sans-serif', 'monospace'] as const).map((family) => (
              <button
                key={family}
                onClick={() => onSetFontFamily(family)}
                aria-pressed={fontFamily === family}
                aria-label={t(`reader.settings.fontFamily.${family}`)}
                className={`
                  w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 outline-none
                  focus-visible:ring-2 focus-visible:ring-accent
                  ${
                    fontFamily === family
                      ? 'bg-accent/10 text-accent font-medium border border-accent/20'
                      : 'text-foreground hover:bg-background-secondary border border-transparent'
                  }
                `}
                style={{
                  fontFamily:
                    family === 'serif' ? 'serif' : family === 'sans-serif' ? 'sans-serif' : 'monospace',
                }}
              >
                {t(`reader.settings.fontFamily.${family}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
