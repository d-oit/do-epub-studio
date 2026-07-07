import type { ReactNode } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { TranslationKeys } from '../../i18n';
import {
  usePreferencesStore,
  type Theme,
  type FontFamily,
  type FontSize,
  type PageDirection,
  type WritingMode,
} from '../../stores/preferences';
import { StorageQuota } from '../../components/StorageQuota';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { useAuthStore } from '../../stores/auth';

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-4 border-b border-border last:border-0">
      <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wider mb-3">
        {label}
      </label>
      {children}
    </div>
  );
}

function SegmentedButton<T extends string | number>({
  options,
  value,
  onChange,
  getLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  getLabel: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={`
            px-4 py-2 text-sm rounded-lg border transition-all duration-150 outline-none
            focus-visible:ring-2 focus-visible:ring-accent
            ${value === opt
              ? 'bg-accent text-white border-accent font-medium shadow-sm'
              : 'bg-background text-foreground border-border hover:border-foreground-muted'
            }
          `}
        >
          {getLabel(opt)}
        </button>
      ))}
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const {
    reader,
    setTheme,
    setFontFamily,
    setFontSize,
    setLineHeight,
    setPageWidth,
    setDirection,
    setWritingMode,
  } = usePreferencesStore();
  const { isAdmin } = useAuthStore();

  const themes: readonly Theme[] = ['light', 'dark', 'sepia', 'system'];
  const fontFamilies: readonly FontFamily[] = ['serif', 'sans-serif', 'monospace'];
  const fontSizes: readonly FontSize[] = ['small', 'medium', 'large', 'xlarge'];
  const pageWidths = ['narrow', 'normal', 'wide', 'full'] as const;
  const directions: readonly PageDirection[] = ['default', 'ltr', 'rtl'];
  const writingModes: readonly WritingMode[] = ['horizontal-tb', 'vertical-rl', 'vertical-lr'];

  return (
    <main id="main-content" className="min-h-dvh bg-background p-4 sm:p-6 lg:p-8">
      <header className="flex justify-between flex-wrap gap-4 items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
          <p className="text-sm text-foreground-muted mt-1">{t('settings.subtitle')}</p>
        </div>
        <LocaleSwitcher />
      </header>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Reader preferences */}
        <section className="bg-background-secondary rounded-xl border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-2">{t('settings.readerPreferences')}</h2>
          <p className="text-sm text-foreground-muted mb-4">{t('settings.readerPreferencesHint')}</p>

          <SettingRow label={t('reader.theme')}>
            <SegmentedButton
              options={themes}
              value={reader.theme}
              onChange={setTheme}
              getLabel={(v) => t(`reader.settings.theme.${v}`)}
            />
          </SettingRow>

          <SettingRow label={t('reader.fontSize')}>
            <SegmentedButton
              options={fontSizes}
              value={reader.fontSize}
              onChange={setFontSize}
              getLabel={(v) => t(`reader.settings.fontSize.${v}`)}
            />
          </SettingRow>

          <SettingRow label={t('reader.fontFamily')}>
            <SegmentedButton
              options={fontFamilies}
              value={reader.fontFamily}
              onChange={setFontFamily}
              getLabel={(v) => t(`reader.settings.fontFamily.${v}`)}
            />
          </SettingRow>

          <SettingRow label={t('settings.lineHeight')}>
            <SegmentedButton
              options={[1, 2, 3] as const}
              value={reader.lineHeight}
              onChange={setLineHeight}
              getLabel={(v) => t(`settings.lineHeight.${v}` as TranslationKeys)}
            />
          </SettingRow>

          <SettingRow label={t('settings.pageWidth')}>
            <SegmentedButton
              options={pageWidths}
              value={reader.pageWidth}
              onChange={setPageWidth}
              getLabel={(v) => t(`settings.pageWidth.${v}`)}
            />
          </SettingRow>

          <SettingRow label={t('reader.settings.direction')}>
            <SegmentedButton
              options={directions}
              value={reader.direction}
              onChange={setDirection}
              getLabel={(v) => t(`reader.settings.direction.${v}`)}
            />
          </SettingRow>

          <SettingRow label={t('reader.settings.writingMode')}>
            <SegmentedButton
              options={writingModes}
              value={reader.writingMode}
              onChange={setWritingMode}
              getLabel={(v) => t(`reader.settings.writingMode.${v}`)}
            />
          </SettingRow>
        </section>

        {/* Storage management */}
        <StorageQuota />

        {/* Account info */}
        <section className="bg-background-secondary rounded-xl border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('settings.account')}</h2>
          {isAdmin && (
            <div className="flex items-center gap-3 text-sm text-foreground-muted">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>{t('settings.adminBadge')}</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
