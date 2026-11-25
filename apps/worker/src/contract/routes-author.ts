import { z } from 'zod';
import {
  CreateBookSchema,
  SaveManuscriptDraftSchema,
  ApiActionSuccessEnvelopeSchema,
} from '@do-epub-studio/schema';
import type { ApiContractEntry } from './types';

/** POST /api/author/books body: CreateBookSchema + authoring template. */
const AuthorCreateBookSchema = CreateBookSchema.extend({
  template: z.enum(['blank', 'novel', 'guide']).default('blank'),
});

/**
 * Author (authorAuth) route contracts — issue #1489.
 */
export const authorRoutes: ApiContractEntry[] = [
  {
    path: '/api/author/books',
    method: 'POST',
    auth: 'author',
    statusCodes: [201],
    request: { body: AuthorCreateBookSchema },
  },
  {
    path: '/api/author/books/:id/manuscript',
    method: 'GET',
    auth: 'author',
    statusCodes: [200],
  },
  {
    path: '/api/author/books/:id/manuscript',
    method: 'PUT',
    auth: 'author',
    statusCodes: [200],
    request: { body: SaveManuscriptDraftSchema },
  },
  {
    path: '/api/author/books/:id/publish',
    method: 'POST',
    auth: 'author',
    statusCodes: [200, 201],
  },
  {
    path: '/api/author/books/:id/assets',
    method: 'GET',
    auth: 'author',
    statusCodes: [200],
  },
  {
    path: '/api/author/books/:id/assets/:assetId',
    method: 'PUT',
    auth: 'author',
    statusCodes: [200],
  },
  {
    path: '/api/author/books/:id/assets/:assetId',
    method: 'GET',
    auth: 'author',
    statusCodes: [200],
    // Binary asset bytes (image/stylesheet) streamed with their own
    // content-type — excluded from JSON-envelope enforcement.
    responseKind: 'binary',
  },
  {
    path: '/api/author/books/:id/assets/:assetId',
    method: 'DELETE',
    auth: 'author',
    statusCodes: [200],
    response: ApiActionSuccessEnvelopeSchema,
  },
];
