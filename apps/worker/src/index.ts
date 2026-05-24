import { TRACE_HEADER, SPAN_HEADER, matchBounded } from '@do-epub-studio/shared';
import type { Env } from './lib/env';
import { jsonResponse } from './lib/responses';
import { RateLimiterDO } from './lib/rate-limiter-do';

export { RateLimiterDO };

import {
  createRequestContext,
  logRequestEnd,
  logRequestError,
  logRequestStart,
  withTraceHeaders,
} from './lib/observability';
import { applySecurityHeaders, applyMinimalSecurityHeaders } from './lib/security-headers';
import { applyRateLimit, addRateLimitHeaders } from './middleware/rate-limit';
import {
  handleAccessRequest,
  handleLogout,
  handleRefresh,
  handleValidatePermission,
  handleValidateAllPermissions,
  handleGetBook,
  handleGetFileUrl,
  handleListBooks,
  handleGetProgress,
  handleUpdateProgress,
  handleListBookmarks,
  handleCreateBookmark,
  handleDeleteBookmark,
  handleListHighlights,
  handleCreateHighlight,
  handleDeleteHighlight,
  handleUpdateHighlight,
  handleListComments,
  handleCreateComment,
  handleUpdateComment,
  handleDownloadBookFile,
  handleCreateBook,
  handleBookUpload,
  handleUploadComplete,
  handleCreateAdminGrant,
  handleUpdateGrant,
  handleRevokeGrant,
  handleGetBookGrants,
  handleGetAuditLog,
  handleAdminLogin,
  handleAdminLogout,
} from './routes';
import { requireAdminAuth } from './auth/admin-middleware';

async function handleRequest(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Security: Guard against ReDoS by limiting path length
  if (path.length > 2048) {
    return jsonResponse({ ok: false, error: { code: 'URI_TOO_LONG', message: 'URI too long' } }, 414);
  }

  if (method === 'OPTIONS') {
    const response = new Response(null, { status: 204 });
    return applyMinimalSecurityHeaders(applyCorsHeaders(response, request, env));
  }

  if (path === '/api/access/request' && method === 'POST') {
    const body = (await request.json());
    return handleAccessRequest(env, body);
  }

  if (path === '/api/access/logout' && method === 'POST') {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';
    return handleLogout(env, token);
  }

  if (path === '/api/admin/login' && method === 'POST') {
    return handleAdminLogin(env, request);
  }

  if (path === '/api/admin/logout' && method === 'POST') {
    return handleAdminLogout(env, request);
  }

  if (path === '/api/access/refresh' && method === 'POST') {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';
    return handleRefresh(env, token);
  }

  if (path === '/api/books' && method === 'GET') {
    return handleListBooks(env, request);
  }

  const booksMatch = matchBounded(/\/api\/books\/([^/]+)$/, path, 2048);
  if (booksMatch && method === 'GET') {
    return handleGetBook(env, request, booksMatch[1]);
  }

  const fileUrlMatch = matchBounded(/\/api\/books\/([^/]+)\/file-url$/, path, 2048);
  if (fileUrlMatch && method === 'POST') {
    return handleGetFileUrl(env, request, fileUrlMatch[1]);
  }

  if (path.startsWith('/api/files/') && method === 'GET') {
    const remainder = path.slice('/api/files/'.length);
    const [rawBookId, ...fileKeyParts] = remainder.split('/');
    if (rawBookId && fileKeyParts.length > 0) {
      const bookId = decodeURIComponent(rawBookId);
      const fileKey = fileKeyParts.map((part) => decodeURIComponent(part)).join('/');
      return handleDownloadBookFile(env, request, bookId, fileKey);
    }
  }

  const progressMatch = matchBounded(/\/api\/books\/([^/]+)\/progress$/, path, 2048);
  if (progressMatch) {
    const bookId = progressMatch[1];
    if (method === 'GET') {
      return handleGetProgress(env, request, bookId);
    }
    if (method === 'PUT') {
      const body = (await request.json());
      return handleUpdateProgress(env, request, bookId, body);
    }
  }

  const bookmarksMatch = matchBounded(/\/api\/books\/([^/]+)\/bookmarks$/, path, 2048);
  if (bookmarksMatch) {
    const bookId = bookmarksMatch[1];
    if (method === 'GET') {
      return handleListBookmarks(env, request, bookId);
    }
    if (method === 'POST') {
      const body = (await request.json());
      return handleCreateBookmark(env, request, bookId, body);
    }
  }

  const bookmarkDeleteMatch = matchBounded(
    /\/api\/books\/([^/]+)\/bookmarks\/([^/]+)$/,
    path,
    2048,
  );
  if (bookmarkDeleteMatch && method === 'DELETE') {
    return handleDeleteBookmark(env, request, bookmarkDeleteMatch[1], bookmarkDeleteMatch[2]);
  }

  const highlightsMatch = matchBounded(/\/api\/books\/([^/]+)\/highlights$/, path, 2048);
  if (highlightsMatch) {
    const bookId = highlightsMatch[1];
    if (method === 'GET') {
      return handleListHighlights(env, request, bookId);
    }
    if (method === 'POST') {
      const body = (await request.json());
      return handleCreateHighlight(env, request, bookId, body);
    }
  }

  const highlightItemMatch = matchBounded(
    /\/api\/books\/([^/]+)\/highlights\/([^/]+)$/,
    path,
    2048,
  );
  if (highlightItemMatch) {
    if (method === 'DELETE') {
      return handleDeleteHighlight(env, request, highlightItemMatch[1], highlightItemMatch[2]);
    }
    if (method === 'PATCH') {
      const body = (await request.json());
      return handleUpdateHighlight(
        env,
        request,
        highlightItemMatch[1],
        highlightItemMatch[2],
        body,
      );
    }
  }

  const commentsMatch = matchBounded(/\/api\/books\/([^/]+)\/comments$/, path, 2048);
  if (commentsMatch) {
    const bookId = commentsMatch[1];
    if (method === 'GET') {
      return handleListComments(env, request, bookId);
    }
    if (method === 'POST') {
      const body = (await request.json());
      return handleCreateComment(env, request, bookId, body);
    }
  }

  const commentPatchMatch = matchBounded(/\/api\/comments\/([^/]+)$/, path, 2048);
  if (commentPatchMatch && method === 'PATCH') {
    const body = (await request.json());
    return handleUpdateComment(env, request, commentPatchMatch[1], body);
  }

  if (path === '/api/admin/books' && method === 'POST') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    const body = (await request.json());
    return handleCreateBook(env, body, authResult.context.email);
  }

  const bookUploadMatch = matchBounded(/\/api\/admin\/books\/([^/]+)\/upload$/, path, 2048);
  if (bookUploadMatch && method === 'PUT') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    return handleBookUpload(env, bookUploadMatch[1], request);
  }

  const uploadCompleteMatch = matchBounded(
    /\/api\/admin\/books\/([^/]+)\/upload-complete$/,
    path,
    2048,
  );
  if (uploadCompleteMatch && method === 'POST') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    const body = (await request.json());
    return handleUploadComplete(env, uploadCompleteMatch[1], body);
  }

  const grantsMatch = matchBounded(/\/api\/admin\/books\/([^/]+)\/grants$/, path, 2048);
  if (grantsMatch && method === 'POST') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    const body = (await request.json());
    return handleCreateAdminGrant(env, grantsMatch[1], body, authResult.context.email);
  }

  if (grantsMatch && method === 'GET') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    return handleGetBookGrants(env, grantsMatch[1]);
  }

  const grantUpdateMatch = matchBounded(/\/api\/admin\/grants\/([^/]+)$/, path, 2048);
  if (grantUpdateMatch && method === 'PATCH') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    const body = (await request.json());
    return handleUpdateGrant(env, grantUpdateMatch[1], body, authResult.context.email);
  }

  const grantRevokeMatch = matchBounded(/\/api\/admin\/grants\/([^/]+)\/revoke$/, path, 2048);
  if (grantRevokeMatch && method === 'POST') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    return handleRevokeGrant(env, grantRevokeMatch[1], authResult.context.email);
  }

  if ((path === '/api/admin/audit' || path === '/api/admin/audit-logs') && method === 'GET') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    const entityType = (url.searchParams.get('entityType') ?? undefined) as
      | 'book'
      | 'grant'
      | 'session'
      | 'comment'
      | 'user'
      | 'bookmark'
      | 'highlight'
      | undefined;
    const entityId = url.searchParams.get('entityId') ?? undefined;
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const from = url.searchParams.get('from') ?? undefined;
    const to = url.searchParams.get('to') ?? undefined;
    return handleGetAuditLog(env, entityType, entityId, limit, offset, from, to);
  }

  const validatePermissionMatch = matchBounded(/\/api\/access\/validate$/, path, 2048);
  if (validatePermissionMatch && method === 'GET') {
    const bookId = url.searchParams.get('bookId');
    if (!bookId) {
      return jsonResponse({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'bookId parameter is required' } }, 400);
    }
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';
    return handleValidatePermission(env, bookId, token);
  }

  if (path === '/api/access/validate-all' && method === 'GET') {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';
    return handleValidateAllPermissions(env, token);
  }

  return jsonResponse({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const context = createRequestContext(request);
    logRequestStart(context);

    try {
      const { response: rateLimitResponse, metadata } = await applyRateLimit(request, env);
      if (rateLimitResponse) {
        logRequestEnd(context, rateLimitResponse.status);
        return applySecurityHeaders(
          applyCorsHeaders(withTraceHeaders(rateLimitResponse, context), request, env),
        );
      }

      let response = await handleRequest(env, request);
      if (metadata) {
        response = addRateLimitHeaders(response, metadata);
      }
      logRequestEnd(context, response.status);
      return applySecurityHeaders(applyCorsHeaders(withTraceHeaders(response, context), request, env));
    } catch (error) {
      logRequestError(context, error);
      logRequestEnd(context, 500);
      const failure = jsonResponse(
        {
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            traceId: context.traceId,
          },
        },
        500,
      );
      return applySecurityHeaders(applyCorsHeaders(withTraceHeaders(failure, context), request, env));
    }
  },
};

/**
 * Apply restricted CORS headers based on the environment configuration.
 * Hardens the API by restricting allowed origins to the application's base URL.
 */
function applyCorsHeaders(response: Response, request: Request, env: Env): Response {
  const origin = request.headers.get('Origin');
  const allowedOrigin = origin === env.APP_BASE_URL ? origin : env.APP_BASE_URL;

  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    `Content-Type, Authorization, ${TRACE_HEADER}, ${SPAN_HEADER}`,
  );
  response.headers.set('Vary', 'Origin, Access-Control-Request-Headers');

  return response;
}
