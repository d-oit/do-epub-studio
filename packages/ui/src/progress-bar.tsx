export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
  showValue?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  className = '',
  showValue = false,
}: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
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
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? 'Progress'}
        className="h-2 w-full overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
