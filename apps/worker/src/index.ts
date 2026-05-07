import { TRACE_HEADER, SPAN_HEADER } from '@do-epub-studio/shared';
import type { Env } from './lib/env';
import { jsonResponse } from './lib/responses';
import {
  createRequestContext,
  logRequestEnd,
  logRequestError,
  logRequestStart,
  withTraceHeaders,
} from './lib/observability';
import { applySecurityHeaders, applyMinimalSecurityHeaders } from './lib/security-headers';
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

  if (method === 'OPTIONS') {
    const response = new Response(null, { status: 204 });
    return applyMinimalSecurityHeaders(applyCorsHeaders(response, request, env));
  }

  if (path === '/api/access/request' && method === 'POST') {
    const body = (await request.json()) as Record<string, unknown>;
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

  const booksMatch = /\/api\/books\/([^/]+)$/.exec(path);
  if (booksMatch && method === 'GET') {
    return handleGetBook(env, request, booksMatch[1]);
  }

  const fileUrlMatch = /\/api\/books\/([^/]+)\/file-url$/.exec(path);
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

  const progressMatch = /\/api\/books\/([^/]+)\/progress$/.exec(path);
  if (progressMatch) {
    const bookId = progressMatch[1];
    if (method === 'GET') {
      return handleGetProgress(env, request, bookId);
    }
    if (method === 'PUT') {
      const body = (await request.json()) as Record<string, unknown>;
      return handleUpdateProgress(env, request, bookId, body);
    }
  }

  const bookmarksMatch = /\/api\/books\/([^/]+)\/bookmarks$/.exec(path);
  if (bookmarksMatch) {
    const bookId = bookmarksMatch[1];
    if (method === 'GET') {
      return handleListBookmarks(env, request, bookId);
    }
    if (method === 'POST') {
      const body = (await request.json()) as Record<string, unknown>;
      return handleCreateBookmark(env, request, bookId, body);
    }
  }

  const bookmarkDeleteMatch = /\/api\/books\/([^/]+)\/bookmarks\/([^/]+)$/.exec(path);
  if (bookmarkDeleteMatch && method === 'DELETE') {
    return handleDeleteBookmark(env, request, bookmarkDeleteMatch[1], bookmarkDeleteMatch[2]);
  }

  const highlightsMatch = /\/api\/books\/([^/]+)\/highlights$/.exec(path);
  if (highlightsMatch) {
    const bookId = highlightsMatch[1];
    if (method === 'GET') {
      return handleListHighlights(env, request, bookId);
    }
    if (method === 'POST') {
      const body = (await request.json()) as Record<string, unknown>;
      return handleCreateHighlight(env, request, bookId, body);
    }
  }

  const highlightItemMatch = /\/api\/books\/([^/]+)\/highlights\/([^/]+)$/.exec(path);
  if (highlightItemMatch) {
    if (method === 'DELETE') {
      return handleDeleteHighlight(env, request, highlightItemMatch[1], highlightItemMatch[2]);
    }
    if (method === 'PATCH') {
      const body = (await request.json()) as Record<string, unknown>;
      return handleUpdateHighlight(
        env,
        request,
        highlightItemMatch[1],
        highlightItemMatch[2],
        body,
      );
    }
  }

  const commentsMatch = /\/api\/books\/([^/]+)\/comments$/.exec(path);
  if (commentsMatch) {
    const bookId = commentsMatch[1];
    if (method === 'GET') {
      return handleListComments(env, request, bookId);
    }
    if (method === 'POST') {
      const body = (await request.json()) as Record<string, unknown>;
      return handleCreateComment(env, request, bookId, body);
    }
  }

  const commentPatchMatch = /\/api\/comments\/([^/]+)$/.exec(path);
  if (commentPatchMatch && method === 'PATCH') {
    const body = (await request.json()) as Record<string, unknown>;
    return handleUpdateComment(env, request, commentPatchMatch[1], body);
  }

  if (path === '/api/admin/books' && method === 'POST') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    const body = (await request.json()) as Record<string, unknown>;
    return handleCreateBook(env, body, authResult.context.email);
  }

  const bookUploadMatch = /\/api\/admin\/books\/([^/]+)\/upload$/.exec(path);
  if (bookUploadMatch && method === 'PUT') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    return handleBookUpload(env, bookUploadMatch[1], request);
  }

  const uploadCompleteMatch = /\/api\/admin\/books\/([^/]+)\/upload-complete$/.exec(path);
  if (uploadCompleteMatch && method === 'POST') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    const body = (await request.json()) as Record<string, unknown>;
    return handleUploadComplete(env, uploadCompleteMatch[1], body);
  }

  const grantsMatch = /\/api\/admin\/books\/([^/]+)\/grants$/.exec(path);
  if (grantsMatch && method === 'POST') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    const body = (await request.json()) as Record<string, unknown>;
    return handleCreateAdminGrant(env, grantsMatch[1], body, authResult.context.email);
  }

  if (grantsMatch && method === 'GET') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    return handleGetBookGrants(env, grantsMatch[1]);
  }

  const grantUpdateMatch = /\/api\/admin\/grants\/([^/]+)$/.exec(path);
  if (grantUpdateMatch && method === 'PATCH') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    const body = (await request.json()) as Record<string, unknown>;
    return handleUpdateGrant(env, grantUpdateMatch[1], body, authResult.context.email);
  }

  const grantRevokeMatch = /\/api\/admin\/grants\/([^/]+)\/revoke$/.exec(path);
  if (grantRevokeMatch && method === 'POST') {
    const authResult = await requireAdminAuth(env, request);
    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: authResult.error } }, authResult.status);
    }
    return handleRevokeGrant(env, grantRevokeMatch[1], authResult.context.email);
  }

  if (path === '/api/admin/audit' && method === 'GET') {
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
    const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
    return handleGetAuditLog(env, entityType, entityId, limit);
  }

  const validatePermissionMatch = /\/api\/access\/validate$/.exec(path);
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
      const response = await handleRequest(env, request);
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
