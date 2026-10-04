// ---------------------------------------------------------------------------
// Shared types, constants, and factory helpers for the Grants feature
// ---------------------------------------------------------------------------

export const DEFAULT_EXPIRY_DAYS = 30;

export function defaultExpiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_EXPIRY_DAYS);
  return d.toISOString().split('T')[0];
}

export interface Book {
  id: string;
  slug: string;
  title: string;
}

export interface Grant {
  id: string;
  email: string;
  mode: string;
  commentsAllowed: boolean;
  offlineAllowed: boolean;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface GrantFormData {
  email: string;
  password: string;
  passwordConfirm: string;
  mode: string;
  commentsAllowed: boolean;
  offlineAllowed: boolean;
  expiresAt: string;
}

export function emptyFormData(): GrantFormData {
  return {
    email: '',
    password: '',
    passwordConfirm: '',
    mode: 'private',
    commentsAllowed: false,
    offlineAllowed: false,
    expiresAt: defaultExpiryDate(),
  };
}

export const GRANT_MODES = [
  { value: 'private', label: 'Private' },
  { value: 'password_protected', label: 'Password Protected' },
  { value: 'reader_only', label: 'Reader Only' },
  { value: 'editorial_review', label: 'Editorial Review' },
  { value: 'public', label: 'Public' },
] as const;
