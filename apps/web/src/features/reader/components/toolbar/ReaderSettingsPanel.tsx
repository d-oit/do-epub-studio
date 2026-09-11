import { useRef } from 'react';
import { IconButton } from '../../../../components/ui';
import { useFocusTrap } from '@do-epub-studio/ui';
import { useKeyboardShortcut } from '../../../../hooks/useKeyboardShortcut';

export type PageDirection = 'ltr' | 'rtl' | 'default';
export type WritingMode = 'horizontal-tb' | 'vertical-rl' | 'vertical-lr';

interface ReaderSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark' | 'sepia' | 'system';
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  fontFamily: 'serif' | 'sans-serif' | 'monospace';
  direction?: PageDirection;
  writingMode?: WritingMode;
  onSetTheme: (theme: 'light' | 'dark' | 'sepia' | 'system') => void;
  onSetFontSize: (size: 'small' | 'medium' | 'large' | 'xlarge') => void;
  onSetFontFamily: (family: 'serif' | 'sans-serif' | 'monospace') => void;
  onSetDirection?: (direction: PageDirection) => void;
  onSetWritingMode?: (writingMode: WritingMode) => void;
  aiEnabled: boolean;
  onSetAiEnabled?: (enabled: boolean) => void;
  isFixedLayout?: boolean;
  t: (key: string) => string;
}

export function ReaderSettingsPanel({
  isOpen,
  onClose,
  theme,
  fontSize,
  fontFamily,
  direction,
  writingMode,
  onSetTheme,
  onSetFontSize,
  onSetFontFamily,
  onSetDirection,
  onSetWritingMode,
  aiEnabled,
  onSetAiEnabled,
  isFixedLayout = false,
  t,
}: ReaderSettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, panelRef);
  useKeyboardShortcut('Escape', onClose, { enabled: isOpen });

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed top-14 right-4 glass-panel rounded-sm shadow-xl border border-border p-4 z-50 w-72 max-h-[calc(100dvh-4rem)] overflow-y-auto animate-scale-in"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 id="settings-title" className="text-sm font-semibold text-foreground">{t('reader.settings')}</h2>
        <IconButton
          onClick={onClose}
          variant="ghost"
          aria-label={t('a11y.close')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </IconButton>
      </div>

      <div className="space-y-6">
        <fieldset className="min-w-0">
          <legend className="eyebrow block mb-2">
            {t('reader.theme')}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {/* eslint-disable-next-line i18next/no-literal-string -- option keys passed to t() */}
            {(['light', 'dark', 'sepia', 'system'] as const).map((themeOption) => (
              <button
                key={themeOption}
                onClick={() => onSetTheme(themeOption)}
                aria-pressed={theme === themeOption}
                aria-label={t(`reader.settings.theme.${themeOption}`)}
                className={`
                  min-h-11 px-3 py-2 text-sm rounded-lg border transition-all duration-150 outline-none
                  focus-visible:ring-2 focus-visible:ring-accent
                  ${
                    theme === themeOption
                      ? 'bg-primary-700 text-background border-primary-700 font-medium shadow-sm'
                      : 'bg-background-secondary text-foreground border-border hover:border-foreground-muted'
                  }
                `}
              >
                {t(`reader.settings.theme.${themeOption}`)}
              </button>
            ))}
          </div>
        </fieldset>

        {!isFixedLayout && (
          <fieldset className="min-w-0">
            <legend className="eyebrow block mb-2">
              {t('reader.fontSize')}
            </legend>
            <div className="flex gap-1.5 p-1 bg-background-secondary rounded-lg">
              {/* eslint-disable-next-line i18next/no-literal-string -- option keys passed to t() */}
              {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => onSetFontSize(size)}
                  aria-pressed={fontSize === size}
                  aria-label={t(`reader.settings.fontSize.${size}`)}
                  className={`
                    min-h-11 flex-1 py-1.5 text-xs rounded-md transition-all duration-150 outline-none
                    focus-visible:ring-2 focus-visible:ring-accent
                    ${
                      fontSize === size
                        ? 'bg-background shadow-sm text-foreground font-semibold'
                        : 'text-foreground-muted hover:text-foreground'
                    }
                  `}
                >
                  {/* eslint-disable i18next/no-literal-string -- font size abbreviations */}
                  {size === 'small'
                    ? 'A'
                    : size === 'medium'
                      ? 'A+'
                      : size === 'large'
                        ? 'A++'
                        : 'A+++'}
                  {/* eslint-enable i18next/no-literal-string */}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {!isFixedLayout && (
          <fieldset className="min-w-0">
            <legend className="eyebrow block mb-2">
              {t('reader.fontFamily')}
            </legend>
            <div className="flex flex-col gap-1">
              {/* eslint-disable-next-line i18next/no-literal-string -- option keys passed to t() */}
              {(['serif', 'sans-serif', 'monospace'] as const).map((family) => (
                <button
                  key={family}
                  onClick={() => onSetFontFamily(family)}
                  aria-pressed={fontFamily === family}
                  aria-label={t(`reader.settings.fontFamily.${family}`)}
                  className={`
                    min-h-11 w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 outline-none
                    focus-visible:ring-2 focus-visible:ring-accent
                    ${
                      fontFamily === family
                      ? 'bg-primary-700 text-background font-medium shadow-sm'
                        : 'text-foreground hover:bg-background-secondary border border-transparent'
                    }
                  `}
                  style={{
                    fontFamily:
                      family === 'serif'
                        ? 'serif'
                        : family === 'sans-serif'
                          ? 'sans-serif'
                          : 'monospace',
                  }}
                >
                  {t(`reader.settings.fontFamily.${family}`)}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {onSetDirection && (
          <fieldset className="min-w-0">
            <legend className="eyebrow block mb-2">
              {t('reader.settings.direction')}
            </legend>
            <div className="grid grid-cols-3 gap-1.5">
              {/* eslint-disable-next-line i18next/no-literal-string -- option keys passed to t() */}
              {(['default', 'ltr', 'rtl'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => onSetDirection(d)}
                  aria-pressed={direction === d}
                  className={`
                    min-h-11 px-2 py-1.5 text-xs rounded-lg border transition-all duration-150 outline-none
                    focus-visible:ring-2 focus-visible:ring-accent
                    ${
                      direction === d
                      ? 'bg-primary-700 text-background border-primary-700 font-medium shadow-sm'
                        : 'bg-background-secondary text-foreground border-border hover:border-foreground-muted'
                    }
                  `}
                >
                  {t(`reader.settings.direction.${d}`)}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {onSetWritingMode && (
          <fieldset className="min-w-0">
            <legend className="eyebrow block mb-2">
              {t('reader.settings.writingMode')}
            </legend>
            <div className="grid grid-cols-1 gap-1">
              {/* eslint-disable-next-line i18next/no-literal-string -- option keys passed to t() */}
              {(['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onSetWritingMode(mode)}
                  aria-pressed={writingMode === mode}
                  className={`
                    min-h-11 w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 outline-none
                    focus-visible:ring-2 focus-visible:ring-accent
                    ${
                      writingMode === mode
                      ? 'bg-primary-700 text-background font-medium shadow-sm'
                        : 'text-foreground hover:bg-background-secondary border border-transparent'
                    }
                  `}
                >
                  {t(`reader.settings.writingMode.${mode}`)}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {onSetAiEnabled && (
          <fieldset className="min-w-0">
            <legend className="eyebrow block mb-2">
              {t('reader.settings.ai.title')}
            </legend>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(event) => onSetAiEnabled(event.target.checked)}
                className="mt-0.5 min-h-11 min-w-11 accent-accent"
              />
              <span className="text-xs text-foreground-muted">
                {t('reader.settings.ai.description')}
              </span>
            </label>
          </fieldset>
        )}

        {isFixedLayout && (
          <div className="text-xs text-foreground-muted text-center pt-2 border-t border-border">
            {t('reader.settings.fixedLayout')}
          </div>
        )}
      </div>
    </div>
  );
}
