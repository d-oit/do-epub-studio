import type { EpubFindingItem } from '../../../lib/api/admin-validation';

export function FindingsGroupList({
  title,
  items,
  variant,
}: {
  title: string;
  items: EpubFindingItem[];
  variant: 'error' | 'warning' | 'info';
}) {
  if (items.length === 0) return null;
  const badgeColor =
    variant === 'error'
      ? 'bg-semantic-error/10 text-semantic-error border-semantic-error/30'
      : variant === 'warning'
        ? 'bg-semantic-warning/10 text-semantic-warning border-semantic-warning/30'
        : 'bg-accent/10 text-accent border-accent/30';

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
        <span>{title}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${badgeColor}`}>
          {items.length}
        </span>
      </h4>
      <ul className="space-y-1.5 text-xs">
        {items.map((item, idx) => (
          <li key={idx} className="p-2.5 rounded border border-border bg-surface space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold text-foreground">{item.code}</span>
              {(item.path || item.location) && (
                <span className="text-[11px] font-mono text-foreground-muted">
                  {item.path}
                  {item.location ? ` (${item.location})` : ''}
                </span>
              )}
            </div>
            <p className="text-foreground-muted leading-relaxed">{item.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
