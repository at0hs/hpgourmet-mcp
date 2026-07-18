import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { consoleApp } from './console/router';
import { HotpepperClient } from './hotpepper/HotpepperClient';
import { buildGourmetSearchParams, searchRestaurantsInputSchema } from './tools/searchRestaurants';

function createServer(client: HotpepperClient, rayId: string | undefined): McpServer {
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

app.all('/', async (c) => {
  const client = new HotpepperClient(c.env.HOTPEPPER_API_KEY);
  const rayId = c.req.raw.headers.get('cf-ray') ?? undefined;
  const server = createServer(client, rayId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

export default app;
