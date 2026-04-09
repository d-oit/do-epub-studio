import type { Env } from './lib/env';
import { jsonResponse } from './lib/responses';
import {
  createRequestContext,
  logRequestEnd,
  logRequestError,
  logRequestStart,
  withTraceHeaders,
} from './lib/observability';
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
  handleUploadComplete,
  handleCreateAdminGrant,
  handleUpdateGrant,
  handleRevokeGrant,
  handleGetBookGrants,
  handleGetAuditLog,
} from './routes';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  Vary: 'Origin, Access-Control-Request-Headers',
};

async function handleRequest(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (path === '/api/access/request' && method === 'POST') {
    const body = await request.json();
    return handleAccessRequest(env, body);
  }

  if (path === '/api/access/logout' && method === 'POST') {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';
    return handleLogout(env, token);
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
      const body = await request.json();
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
      const body = await request.json();
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
      const body = await request.json();
      return handleCreateHighlight(env, request, bookId, body);
    }
  }

  const highlightDeleteMatch = /\/api\/books\/([^/]+)\/highlights\/([^/]+)$/.exec(path);
  if (highlightDeleteMatch && method === 'DELETE') {
    return handleDeleteHighlight(env, request, highlightDeleteMatch[1], highlightDeleteMatch[2]);
  }

  const highlightPatchMatch = /\/api\/books\/([^/]+)\/highlights\/([^/]+)$/.exec(path);
  if (highlightPatchMatch && method === 'PATCH') {
    const body = await request.json();
    return handleUpdateHighlight(
      env,
      request,
      highlightPatchMatch[1],
      highlightPatchMatch[2],
      body,
    );
  }

  const commentsMatch = /\/api\/books\/([^/]+)\/comments$/.exec(path);
  if (commentsMatch) {
    const bookId = commentsMatch[1];
    if (method === 'GET') {
      return handleListComments(env, request, bookId);
    }
    if (method === 'POST') {
      const body = await request.json();
      return handleCreateComment(env, request, bookId, body);
    }
  }

  const commentPatchMatch = /\/api\/comments\/([^/]+)$/.exec(path);
  if (commentPatchMatch && method === 'PATCH') {
    const body = await request.json();
    return handleUpdateComment(env, request, commentPatchMatch[1], body);
  }

  if (path === '/api/admin/books' && method === 'POST') {
    const body = await request.json();
    return handleCreateBook(env, body);
  }

  const uploadCompleteMatch = /\/api\/admin\/books\/([^/]+)\/upload-complete$/.exec(path);
  if (uploadCompleteMatch && method === 'POST') {
    const body = await request.json();
    return handleUploadComplete(env, uploadCompleteMatch[1], body);
  }

  const grantsMatch = /\/api\/admin\/books\/([^/]+)\/grants$/.exec(path);
  if (grantsMatch && method === 'POST') {
    const body = await request.json();
    return handleCreateAdminGrant(env, grantsMatch[1], body);
  }

  if (grantsMatch && method === 'GET') {
    return handleGetBookGrants(env, grantsMatch[1]);
  }

  const grantUpdateMatch = /\/api\/admin\/grants\/([^/]+)$/.exec(path);
  if (grantUpdateMatch && method === 'PATCH') {
    const body = await request.json();
    return handleUpdateGrant(env, grantUpdateMatch[1], body);
  }

  const grantRevokeMatch = /\/api\/admin\/grants\/([^/]+)\/revoke$/.exec(path);
  if (grantRevokeMatch && method === 'POST') {
    return handleRevokeGrant(env, grantRevokeMatch[1]);
  }

  if (path === '/api/admin/audit' && method === 'GET') {
    const entityType = url.searchParams.get('entityType') ?? undefined;
    const entityId = url.searchParams.get('entityId') ?? undefined;
    const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
    return handleGetAuditLog(env, entityType, entityId, limit);
  }

  const validatePermissionMatch = /\/api\/access\/validate\?bookId=(.+)$/.exec(path);
  if (validatePermissionMatch && method === 'GET') {
    const bookId = decodeURIComponent(validatePermissionMatch[1]);
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
      return applyCorsHeaders(withTraceHeaders(response, context));
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
      return applyCorsHeaders(withTraceHeaders(failure, context));
    }
  },
};

function applyCorsHeaders(response: Response): Response {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
