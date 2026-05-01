interface ReaderSettingsPanelProps {
  isOpen: boolean;
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
  theme,
  fontSize,
  fontFamily,
  onSetTheme,
  onSetFontSize,
  onSetFontFamily,
  t,
}: ReaderSettingsPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed top-14 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50 w-64">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('reader.theme')}</label>
          <div className="flex gap-2">
            {(['light', 'dark', 'sepia'] as const).map((themeOption) => (
              <button
                key={themeOption}
                onClick={() => onSetTheme(themeOption)}
                className={`px-3 py-1 text-sm rounded ${theme === themeOption ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
              >
                {themeOption}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('reader.fontSize')}</label>
          <div className="flex gap-2">
            {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
              <button
                key={size}
                onClick={() => onSetFontSize(size)}
                className={`px-2 py-1 text-xs rounded ${fontSize === size ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
              >
                {size[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('reader.fontFamily')}</label>
          <div className="flex gap-2">
            {(['serif', 'sans-serif', 'monospace'] as const).map((family) => (
              <button
                key={family}
                onClick={() => onSetFontFamily(family)}
                className={`px-2 py-1 text-xs rounded ${fontFamily === family ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
              >
                {family === 'serif' ? 'Serif' : family === 'sans-serif' ? 'Sans' : 'Mono'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
