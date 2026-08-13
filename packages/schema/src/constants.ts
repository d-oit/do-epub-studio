/**
 * Token purpose / domain-separation constants.
 *
 * The stateless-JWT recovery flow (JWT_PURPOSE_READER_RECOVER / ADMIN_RECOVER)
 * was removed in GOAP-230 in favor of persisted single-use reset/magic-link
 * tokens (see apps/worker/src/auth/reset.ts). No JWT purpose claims remain.
 */
export {};
