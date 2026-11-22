/**
 * Reader-side archive validation. This is the same ingestion boundary as the
 * worker upload/validation paths: the documented limits policy in
 * `@do-epub-studio/shared/src/ingest-limits.ts` is enforced by the shared
 * validator, and rejections surface as typed {@link ArchiveRejectionError}s
 * with stable codes.
 */
export {
  validateArchive,
  ArchiveRejectionError,
  DEFAULT_INGEST_LIMITS,
} from '@do-epub-studio/shared/src/archive-validator';
