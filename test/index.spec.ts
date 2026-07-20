import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hotpepper_api_console 環境ガード', () => {
  it('ENVIRONMENTがproductionの場合は/consoleが404を返す', async () => {
    const request = new IncomingRequest('http://example.com/console');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, { ...env, ENVIRONMENT: 'production' }, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
  });

  it('ENVIRONMENTがdevelopmentの場合は/consoleが200を返す', async () => {
    const request = new IncomingRequest('http://example.com/console');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, { ...env, ENVIRONMENT: 'development' }, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>ホットペッパーAPIコンソール</title>');
  });

  it('ENVIRONMENTがdevelopmentでも存在しないendpointは404を返す', async () => {
    const request = new IncomingRequest('http://example.com/console/api/not_an_endpoint');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, { ...env, ENVIRONMENT: 'development' }, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
  });
});

function mcpRequest(headers: Record<string, string> = {}) {
  return new IncomingRequest('http://example.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
  });
}

describe('X-Hotpepper-Api-Key ヘッダー', () => {
  it('ヘッダーが未指定の場合は401を返す', async () => {
    const request = mcpRequest();
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(401);
  });

  it('ヘッダーが空文字の場合は401を返す', async () => {
    const request = mcpRequest({ 'X-Hotpepper-Api-Key': '' });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(401);
  });

  it('ヘッダーが指定されている場合はホットペッパーAPI呼び出しにそのAPIキーが使われる', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const request = new IncomingRequest('http://example.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'X-Hotpepper-Api-Key': 'user-supplied-key',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'search_restaurants', arguments: { area: '渋谷', genre: '居酒屋' } },
        id: 1,
      }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).not.toBe(401);
    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls.map((args) => String(args[0])).find((url) => url.includes('key=user-supplied-key'));
    expect(calledUrl).toBeDefined();
  });
});
