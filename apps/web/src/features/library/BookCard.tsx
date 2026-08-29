import { Link } from 'react-router-dom';
import type { LibraryBookResponse } from '@do-epub-studio/shared';

export function BookCard({ book, isFirst = false }: { book: LibraryBookResponse; isFirst?: boolean }) {
  const { slug, title, authorName, coverImageUrl } = book;

  // Convert image URL to webp if applicable or pass directly
  const webpUrl = coverImageUrl ? coverImageUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp') : undefined;

  return (
    <article className="group flex flex-col gap-3">
      <Link
        to={`/read/${slug}`}
        aria-label={title}
        className="group flex flex-col gap-3 rounded-[var(--radius-paper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <div className="aspect-[2/3] w-full overflow-hidden rounded-[calc(var(--radius-paper)-2px)] bg-[var(--color-paper)] border border-[var(--color-rule)] shadow-[var(--elevation-2)]">
          {coverImageUrl ? (
            <picture>
              {webpUrl && <source srcSet={webpUrl} type="image/webp" />}
              <img
                src={coverImageUrl}
                alt=""
                width={320}
                height={480}
                loading={isFirst ? 'eager' : 'lazy'}
                fetchPriority={isFirst ? 'high' : 'auto'}
                decoding="async"
                className="size-full object-cover motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.03]"
              />
            </picture>
          ) : (
            <span className="flex size-full items-center justify-center text-[var(--color-muted-foreground)]" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-10">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </span>
          )}
        </div>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] leading-tight text-[var(--color-foreground)] group-hover:text-[var(--color-accent)] transition-colors">
            {title}
          </h2>
          {authorName && (
            <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-muted-foreground)]">
              {authorName}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}
