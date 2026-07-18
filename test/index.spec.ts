import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

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
    expect(await response.text()).toContain('hotpepper_api_console');
  });

  it('ENVIRONMENTがdevelopmentでも存在しないendpointは404を返す', async () => {
    const request = new IncomingRequest('http://example.com/console/api/not_an_endpoint');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, { ...env, ENVIRONMENT: 'development' }, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
  });
});
