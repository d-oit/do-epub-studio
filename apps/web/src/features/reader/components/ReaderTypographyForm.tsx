/* eslint-disable i18next/no-literal-string -- UI control labels in settings panel */
import { useReaderPrefsStore } from '../../../stores/reader-prefs';

export function ReaderTypographyForm() {
  const { prefs, updatePrefs } = useReaderPrefsStore();

  return (
    <div className="flex flex-col gap-6 p-4 text-[var(--color-foreground)]">
      <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">
        Typography & Display
      </h3>

      {/* Font scale range */}
      <div className="flex flex-col gap-2">
        <label htmlFor="font-scale-range" className="flex justify-between text-sm font-medium">
          <span>Font Size</span>
          <span>{Math.round(prefs.fontScale * 100)}%</span>
        </label>
        <input
          id="font-scale-range"
          type="range"
          min="0.85"
          max="1.6"
          step="0.05"
          value={prefs.fontScale}
          aria-valuemin={85}
          aria-valuemax={160}
          aria-valuenow={Math.round(prefs.fontScale * 100)}
          onChange={(e) => updatePrefs({ fontScale: parseFloat(e.target.value) })}
          className="h-11 w-full cursor-pointer accent-[var(--color-accent)] touch-target"
        />
      </div>

      {/* Line height range */}
      <div className="flex flex-col gap-2">
        <label htmlFor="line-height-range" className="flex justify-between text-sm font-medium">
          <span>Line Height</span>
          <span>{prefs.lineHeight}</span>
        </label>
        <input
          id="line-height-range"
          type="range"
          min="1.4"
          max="1.9"
          step="0.05"
          value={prefs.lineHeight}
          aria-valuemin={140}
          aria-valuemax={190}
          aria-valuenow={Math.round(prefs.lineHeight * 100)}
          onChange={(e) => updatePrefs({ lineHeight: parseFloat(e.target.value) })}
          className="h-11 w-full cursor-pointer accent-[var(--color-accent)] touch-target"
        />
      </div>

      {/* Font Family Segmented Control */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Font Family</span>
        <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-paper)] border border-[var(--color-rule)] p-1 bg-[var(--color-paper)]">
          <button
            type="button"
            onClick={() => updatePrefs({ fontFamily: 'serif' })}
            className={`min-h-11 px-3 py-2 text-sm font-medium rounded font-serif transition-colors touch-target ${
              prefs.fontFamily === 'serif'
                ? 'bg-[var(--color-foreground)] text-[var(--color-paper)] shadow-sm'
                : 'text-[var(--color-foreground)] hover:bg-[color-mix(in_oklch,var(--color-paper)_90%,var(--color-foreground)_10%)]'
            }`}
          >
            Serif
          </button>
          <button
            type="button"
            onClick={() => updatePrefs({ fontFamily: 'sans' })}
            className={`min-h-11 px-3 py-2 text-sm font-medium rounded font-sans transition-colors touch-target ${
              prefs.fontFamily === 'sans'
                ? 'bg-[var(--color-foreground)] text-[var(--color-paper)] shadow-sm'
                : 'text-[var(--color-foreground)] hover:bg-[color-mix(in_oklch,var(--color-paper)_90%,var(--color-foreground)_10%)]'
            }`}
          >
            Sans
          </button>
        </div>
      </div>

      {/* Margins */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Margins</span>
        <div className="grid grid-cols-3 gap-2 rounded-[var(--radius-paper)] border border-[var(--color-rule)] p-1 bg-[var(--color-paper)]">
          {(['narrow', 'default', 'wide'] as const).map((marginOption) => (
            <button
              key={marginOption}
              type="button"
              onClick={() => updatePrefs({ margin: marginOption })}
              className={`min-h-11 px-2 py-2 text-xs font-medium capitalize rounded transition-colors touch-target ${
                prefs.margin === marginOption
                  ? 'bg-[var(--color-foreground)] text-[var(--color-paper)] shadow-sm'
                  : 'text-[var(--color-foreground)] hover:bg-[color-mix(in_oklch,var(--color-paper)_90%,var(--color-foreground)_10%)]'
              }`}
            >
              {marginOption}
            </button>
          ))}
        </div>
      </div>

      {/* Theme selection */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Theme</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['paper', 'light', 'sepia', 'dark'] as const).map((tOption) => (
            <button
              key={tOption}
              type="button"
              onClick={() => updatePrefs({ theme: tOption })}
              className={`min-h-11 px-2 py-2 text-xs font-medium capitalize rounded-[var(--radius-paper)] border transition-all touch-target ${
                prefs.theme === tOption
                  ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] font-semibold'
                  : 'border-[var(--color-rule)] hover:bg-[color-mix(in_oklch,var(--color-paper)_90%,var(--color-foreground)_10%)]'
              }`}
            >
              {tOption}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
