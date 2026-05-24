import type { Env } from '../lib/env';
import { jsonResponse } from '../lib/responses';
import { verifySignedUrlExpiry, verifySignedUrlSignature } from '../storage/signed-url';

export async function handleDownloadBookFile(
  env: Env,
  request: Request,
  bookId: string,
  fileKey: string,
): Promise<Response> {
  const url = new URL(request.url);
  const expires = url.searchParams.get('expires');
  const signature = url.searchParams.get('signature');

  if (!expires || !signature) {
    return jsonResponse(
      { ok: false, error: { code: 'BAD_REQUEST', message: 'Missing signature parameters' } },
      400,
    );
  }

  const expiryValid = verifySignedUrlExpiry(expires);
  const signatureValid = await verifySignedUrlSignature(env, bookId, fileKey, expires, signature);

  if (!expiryValid || !signatureValid) {
    return jsonResponse(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Invalid signature' } },
      403,
    );
  }

  const object = await env.BOOKS_BUCKET.get(fileKey);

  if (!object || !object.body) {
    return jsonResponse(
      { ok: false, error: { code: 'NOT_FOUND', message: 'File not found' } },
      404,
    );
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/epub+zip');
  headers.set('Cache-Control', 'private, max-age=0');

  // Strict CSP for EPUB content — served within a sandboxed iframe.
  // We allow styles and images but block all scripts and framing except by the application.
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'self'; sandbox allow-same-origin allow-scripts; report-uri /api/csp-report",
  );

  return new Response(object.body, {
    status: 200,
    headers,
  });
}
