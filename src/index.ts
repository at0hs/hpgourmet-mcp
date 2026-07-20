import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono, type Context } from 'hono';
import { consoleApp } from './console/router';
import { HotpepperClient } from './hotpepper/HotpepperClient';
import { buildGourmetSearchParams, searchRestaurantsInputSchema } from './tools/searchRestaurants';

export function createServer(client: HotpepperClient, rayId: string | undefined): McpServer {
  const server = new McpServer({
    name: 'hpgourmet-mcp',
    version: '0.0.0',
  });

  server.registerTool(
    'search_restaurants',
    {
      title: '飲食店検索',
      description:
        'ホットペッパーグルメで飲食店を検索する。areaは必須。genre・keywordのうち少なくとも一方の指定が必須（ジャンル不明時はkeywordを指定すること）。',
      inputSchema: searchRestaurantsInputSchema,
    },
    async (input) => {
      console.log(`[search_restaurants] rayId=${rayId} called input=${JSON.stringify(input)}`);
      try {
        const params = await buildGourmetSearchParams(client, input);
        console.log(`[search_restaurants] rayId=${rayId} converted params=${JSON.stringify(params)}`);
        const result = await client.searchRestaurants(params);
        console.log(`[search_restaurants] rayId=${rayId} success resultsAvailable=${result.resultsAvailable}`);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        console.log(`[search_restaurants] rayId=${rayId} failed error=${(err as Error).message}`);
        throw err;
      }
    },
  );

  return server;
}

const app = new Hono<{ Bindings: Env }>();

app.route('/console', consoleApp);

const HOTPEPPER_API_KEY_HEADER = 'X-Hotpepper-Api-Key';

app.post('/', async (c) => {
  const apiKey = c.req.raw.headers.get(HOTPEPPER_API_KEY_HEADER);
  if (!apiKey) {
    return c.json({ jsonrpc: '2.0', error: { code: -32001, message: `${HOTPEPPER_API_KEY_HEADER} header is required.` }, id: null }, 401);
  }

  const client = new HotpepperClient(apiKey);
  const rayId = c.req.raw.headers.get('cf-ray') ?? undefined;
  const server = createServer(client, rayId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

// ステートレスモードのためGET（サーバー→クライアントの非同期通知用SSE）とDELETE（セッション終了）は非対応。
// GETを受け入れるとレスポンスをクローズしないSSEストリームを開いたままにしてしまい、
// Workers runtimeに「ハングしたリクエスト」として強制キャンセルされるため、明示的に拒否する。
const methodNotAllowed = (c: Context<{ Bindings: Env }>) =>
  c.json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }, 405);
app.get('/', methodNotAllowed);
app.delete('/', methodNotAllowed);

export default app;
