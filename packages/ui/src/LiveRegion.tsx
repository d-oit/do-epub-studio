import { type ReactNode, useEffect, useState } from 'react';

/**
 * LiveRegion — announces dynamic content to screen readers via aria-live.
 * Use for error banners, status messages, and notifications that appear
 * after initial render.
 *
 * @param polite - If true, uses aria-live="polite" (non-interrupting).
 *                 If false, uses aria-live="assertive" (interrupting).
 * @param children - The message to announce.
 */
export function LiveRegion({
  polite = true,
  children,
}: {
  polite?: boolean;
  children: ReactNode;
}) {
  // Key-based re-announcement: changing the key forces screen readers
  // to re-announce the content even if the text hasn't changed.
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (children) {
      setKey((k) => k + 1);
    }
  }, [children]);

  if (!children) return null;

  return (
    <div
      key={key}
      role={polite ? 'status' : 'alert'}
      aria-live={polite ? 'polite' : 'assertive'}
      aria-atomic="true"
      className="sr-only"
    >
      {children}
    </div>
  );
}
