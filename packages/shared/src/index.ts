export * from './dtos';
export * from './schemas';
export * from './errors';
export * from './telemetry';
export * from './safe-regex';
export * from './timeout';
// NOTE: './epub-validator' is intentionally NOT re-exported here. It pulls in
// jszip (~31KB gzip), which would ride the barrel into every web client.
// Import it via the deep path instead:
//   worker:  import { validateEpub } from '@do-epub-studio/shared/src/epub-validator';
//   web:     const { validateEpub } = await import('@do-epub-studio/shared/src/epub-validator');
// (upload-time only; keeps admin-route entry under the ADR-107 §3 budget).
