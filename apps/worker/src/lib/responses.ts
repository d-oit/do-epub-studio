interface ResponseOptions {
  status?: number;
  headers?: HeadersInit;
}

export function jsonResponse(data: unknown, options?: number | ResponseOptions): Response {
  const resolvedOptions: ResponseOptions =
    typeof options === 'number' ? { status: options } : (options ?? {});
  const { status = 200, headers } = resolvedOptions;

  const headerBag = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });

  if (headers) {
    const extra = new Headers(headers);
    extra.forEach((value, key) => {
      headerBag.set(key, value);
    });
  }

  return new Response(JSON.stringify(data), {
    status,
    headers: headerBag,
  });
}
