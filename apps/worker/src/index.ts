import type { Env } from './lib/env';
import {
  handleAccessRequest,
  handleLogout,
  handleRefresh,
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
  handleListComments,
  handleCreateComment,
  handleUpdateComment,
  handleCreateBook,
  handleUploadComplete,
  handleCreateAdminGrant,
  handleUpdateGrant,
  handleRevokeGrant,
  handleGetBookGrants,
  handleGetAuditLog,
} from './routes';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function handleRequest(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (path === '/api/access/request' && method === 'POST') {
      const body = await request.json();
      return await handleAccessRequest(env, body);
    }

    if (path === '/api/access/logout' && method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') ?? '';
      return await handleLogout(env, token);
    }

    if (path === '/api/access/refresh' && method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') ?? '';
      return await handleRefresh(env, token);
    }

    if (path === '/api/books' && method === 'GET') {
      return await handleListBooks(env, request);
    }

    const booksMatch = path.match(/^\/api\/books\/([^/]+)$/);
    if (booksMatch && method === 'GET') {
      return await handleGetBook(env, request, booksMatch[1]);
    }

    const fileUrlMatch = path.match(/^\/api\/books\/([^/]+)\/file-url$/);
    if (fileUrlMatch && method === 'POST') {
      return await handleGetFileUrl(env, request, fileUrlMatch[1]);
    }

    const progressMatch = path.match(/^\/api\/books\/([^/]+)\/progress$/);
    if (progressMatch) {
      const bookId = progressMatch[1];
      if (method === 'GET') {
        return await handleGetProgress(env, request, bookId);
      }
      if (method === 'PUT') {
        const body = await request.json();
        return await handleUpdateProgress(env, request, bookId, body);
      }
    }

    const bookmarksMatch = path.match(/^\/api\/books\/([^/]+)\/bookmarks$/);
    if (bookmarksMatch) {
      const bookId = bookmarksMatch[1];
      if (method === 'GET') {
        return await handleListBookmarks(env, request, bookId);
      }
      if (method === 'POST') {
        const body = await request.json();
        return await handleCreateBookmark(env, request, bookId, body);
      }
    }

    const bookmarkDeleteMatch = path.match(/^\/api\/books\/([^/]+)\/bookmarks\/([^/]+)$/);
    if (bookmarkDeleteMatch && method === 'DELETE') {
      return await handleDeleteBookmark(env, request, bookmarkDeleteMatch[1], bookmarkDeleteMatch[2]);
    }

    const highlightsMatch = path.match(/^\/api\/books\/([^/]+)\/highlights$/);
    if (highlightsMatch) {
      const bookId = highlightsMatch[1];
      if (method === 'GET') {
        return await handleListHighlights(env, request, bookId);
      }
      if (method === 'POST') {
        const body = await request.json();
        return await handleCreateHighlight(env, request, bookId, body);
      }
    }

    const commentsMatch = path.match(/^\/api\/books\/([^/]+)\/comments$/);
    if (commentsMatch) {
      const bookId = commentsMatch[1];
      if (method === 'GET') {
        return await handleListComments(env, request, bookId);
      }
      if (method === 'POST') {
        const body = await request.json();
        return await handleCreateComment(env, request, bookId, body);
      }
    }

    const commentPatchMatch = path.match(/^\/api\/comments\/([^/]+)$/);
    if (commentPatchMatch && method === 'PATCH') {
      const body = await request.json();
      return await handleUpdateComment(env, request, commentPatchMatch[1], body);
    }

    if (path === '/api/admin/books' && method === 'POST') {
      const body = await request.json();
      return await handleCreateBook(env, body);
    }

    const uploadCompleteMatch = path.match(/^\/api\/admin\/books\/([^/]+)\/upload-complete$/);
    if (uploadCompleteMatch && method === 'POST') {
      const body = await request.json();
      return await handleUploadComplete(env, uploadCompleteMatch[1], body);
    }

    const grantsMatch = path.match(/^\/api\/admin\/books\/([^/]+)\/grants$/);
    if (grantsMatch && method === 'POST') {
      const body = await request.json();
      return await handleCreateAdminGrant(env, grantsMatch[1], body);
    }

    if (grantsMatch && method === 'GET') {
      return await handleGetBookGrants(env, grantsMatch[1]);
    }

    const grantUpdateMatch = path.match(/^\/api\/admin\/grants\/([^/]+)$/);
    if (grantUpdateMatch && method === 'PATCH') {
      const body = await request.json();
      return await handleUpdateGrant(env, grantUpdateMatch[1], body);
    }

    const grantRevokeMatch = path.match(/^\/api\/admin\/grants\/([^/]+)\/revoke$/);
    if (grantRevokeMatch && method === 'POST') {
      return await handleRevokeGrant(env, grantRevokeMatch[1]);
    }

    if (path === '/api/admin/audit' && method === 'GET') {
      const entityType = url.searchParams.get('entityType') ?? undefined;
      const entityId = url.searchParams.get('entityId') ?? undefined;
      const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
      return await handleGetAuditLog(env, entityType, entityId, limit);
    }

    return jsonResponse({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  } catch (error) {
    console.error('Request error:', error);
    return jsonResponse({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    }, 500);
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(env, request);
  },
};
