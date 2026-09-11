import { useCreatorBooks } from '../../features/creator/hooks/useCreatorBooks';

/**
 * GOAP-999 COL-01: a contextual creator entry renders only for users with at
 * least one book-scoped creator assignment. The assignment check is the same
 * GET /api/creator/books the /creator route uses; it is never derived from
 * global admin/editor roles.
 */
export function useCreatorNavItem(): { show: boolean } {
  const { books } = useCreatorBooks();
  return { show: books.length > 0 };
}
