import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000';

const REQUEST_HEADERS_TO_SKIP = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const RESPONSE_HEADERS_TO_SKIP = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
]);

const PROXY_TIMEOUT_MS = 60_000;
const PROXY_RETRY_DELAY_MS = 300;
const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);

function buildTargetUrl(request: NextRequest, path: string[] | undefined) {
  const normalizedBaseUrl = API_INTERNAL_URL.replace(/\/+$/, '');
  const normalizedPath = (path ?? []).join('/');
  const target = `${normalizedBaseUrl}/${normalizedPath}`;
  const url = new URL(target);
  url.search = request.nextUrl.search;
  return url;
}

function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (REQUEST_HEADERS_TO_SKIP.has(key.toLowerCase())) {
      return;
    }
    headers.set(key, value);
  });

  if (request.headers.get('host')) {
    headers.set('x-forwarded-host', request.headers.get('host') as string);
  }
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));

  return headers;
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      /timeout/i.test(error.message))
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUpstream(
  targetUrl: URL,
  init: RequestInit,
  method: string,
) {
  const maxAttempts = RETRYABLE_METHODS.has(method.toUpperCase()) ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetch(targetUrl, {
        ...init,
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || isTimeoutError(error)) {
        throw error;
      }

      await sleep(PROXY_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

async function forwardRequest(
  request: NextRequest,
  { params }: { params: { path?: string[] } },
) {
  const startedAt = Date.now();
  let targetUrl: URL | null = null;

  try {
    targetUrl = buildTargetUrl(request, params.path);
    const init: RequestInit = {
      method: request.method,
      headers: buildProxyHeaders(request),
      cache: 'no-store',
      redirect: 'manual',
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer();
    }

    const upstreamResponse = await fetchUpstream(targetUrl, init, request.method);
    const responseHeaders = new Headers();

    upstreamResponse.headers.forEach((value, key) => {
      if (!RESPONSE_HEADERS_TO_SKIP.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timeout = isTimeoutError(error);

    console.error('Dashboard proxy request failed', {
      path: request.nextUrl.pathname,
      search: request.nextUrl.search,
      target: targetUrl?.toString(),
      method: request.method,
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      {
        message: timeout
          ? 'Le proxy du dashboard a attendu trop longtemps la reponse du routeur.'
          : 'Le proxy du dashboard n a pas pu joindre l API.',
      },
      { status: timeout ? 504 : 502 },
    );
  }
}

export const GET = forwardRequest;
export const POST = forwardRequest;
export const PUT = forwardRequest;
export const PATCH = forwardRequest;
export const DELETE = forwardRequest;
export const OPTIONS = forwardRequest;
