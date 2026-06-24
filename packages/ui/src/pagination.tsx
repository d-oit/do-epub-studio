export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function getPageRange(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

const baseBtn =
  'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent px-3 py-1.5 text-sm';
const ghostBtn = 'text-foreground hover:bg-background-secondary';
const primaryBtn = 'bg-accent text-white hover:bg-accent/90';

export function Pagination({ currentPage, totalPages, onPageChange, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = getPageRange(currentPage, totalPages);
  return (
    <nav aria-label="Pagination" className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        className={`${baseBtn} ${ghostBtn} disabled:opacity-50`}
        disabled={currentPage <= 1}
        onClick={() => { onPageChange(currentPage - 1); }}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-2 text-foreground-muted" aria-hidden="true">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`${baseBtn} ${p === currentPage ? primaryBtn : ghostBtn}`}
            onClick={() => { onPageChange(p); }}
            aria-label={`Page ${p}`}
            aria-current={p === currentPage ? 'page' : undefined}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={`${baseBtn} ${ghostBtn} disabled:opacity-50`}
        disabled={currentPage >= totalPages}
        onClick={() => { onPageChange(currentPage + 1); }}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
