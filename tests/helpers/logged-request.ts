import { APIRequestContext, APIResponse, test as base } from '@playwright/test';

/**
 * Opt-in API request wrapper that records every HTTP call as a Playwright
 * attachment named `api-call:METHOD URL`. The rich HTML reporter reads
 * those attachments and renders them inline under each test, so a
 * non-technical reader (or a debugging engineer) can see exactly what was
 * sent and what came back without firing up a trace viewer.
 *
 * Usage:
 *
 *   import { logged } from '../helpers/logged-request';
 *
 *   test('...', async ({ request }) => {
 *     const api = logged(request);
 *     const res = await api.post('/api/Cards/', { headers, data });
 *     // ...attach to test.info() done automatically
 *   });
 *
 * Designed to be a drop-in replacement for the four most common verbs
 * (get / post / put / delete). For exotic verbs, fall back to the raw
 * `request` and call `attachApiCall` manually.
 */

interface RequestInit {
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, string | number | boolean>;
}

export interface LoggedClient {
  get(url: string, init?: RequestInit): Promise<APIResponse>;
  post(url: string, init?: RequestInit): Promise<APIResponse>;
  put(url: string, init?: RequestInit): Promise<APIResponse>;
  delete(url: string, init?: RequestInit): Promise<APIResponse>;
}

const REDACT_HEADERS = ['authorization', 'cookie', 'set-cookie'];

function redactHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [k, v] of Object.entries(headers)) {
    out[k] = REDACT_HEADERS.includes(k.toLowerCase())
      ? `${String(v).slice(0, 12)}…(redacted)`
      : String(v);
  }
  return out;
}

async function safeJson(response: APIResponse): Promise<unknown> {
  const ct = (response.headers()['content-type'] ?? '').toLowerCase();
  try {
    if (ct.includes('json')) return await response.json();
  } catch {
    /* fall through */
  }
  try {
    const text = await response.text();
    return text.length > 4_000 ? text.slice(0, 4_000) + '…' : text;
  } catch {
    return null;
  }
}

async function attachApiCall(
  method: string,
  url: string,
  init: RequestInit | undefined,
  response: APIResponse,
  startedAt: number
): Promise<void> {
  // test.info() throws outside a test, so guard the call. Reporter-time
  // attaching happens inside the test runner, so this is normally safe.
  let info: ReturnType<typeof base.info>;
  try {
    info = base.info();
  } catch {
    return;
  }

  const body = await safeJson(response);
  const payload = {
    method,
    url,
    durationMs: Date.now() - startedAt,
    request: {
      headers: redactHeaders(init?.headers),
      params: init?.params ?? null,
      body: init?.data ?? null,
    },
    response: {
      status: response.status(),
      ok: response.ok(),
      headers: redactHeaders(response.headers()),
      body,
    },
  };

  await info.attach(`api-call:${method} ${url}`, {
    body: JSON.stringify(payload, null, 2),
    contentType: 'application/json',
  });
}

export function logged(request: APIRequestContext): LoggedClient {
  const wrap =
    (verb: 'get' | 'post' | 'put' | 'delete') =>
    async (url: string, init: RequestInit = {}): Promise<APIResponse> => {
      const startedAt = Date.now();
      const response = await request[verb](url, init);
      await attachApiCall(verb.toUpperCase(), url, init, response, startedAt);
      return response;
    };
  return {
    get: wrap('get'),
    post: wrap('post'),
    put: wrap('put'),
    delete: wrap('delete'),
  };
}
