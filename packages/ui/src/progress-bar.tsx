export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
  showValue?: boolean;
  ariaValueText?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  className = '',
  showValue = false,
  ariaValueText,
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(max, value));
  const percentage = max > 0 ? (clampedValue / max) * 100 : 0;
  const computedAriaValueText =
    ariaValueText ?? (showValue ? `${Math.round(percentage)}%` : undefined);

  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-foreground-muted">{label}</span>
          {showValue && <span className="text-foreground-muted">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={computedAriaValueText}
        aria-label={label ?? 'Progress'}
        className="h-2 w-full overflow-hidden rounded-full bg-border"
      >
        <div className="h-full bg-accent transition-all" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
