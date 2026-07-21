import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HotpepperClient } from './hotpepper/HotpepperClient';
import { createServer } from './index';
import { SHOP_MAP_RESOURCE_URI } from './mcpApps/shopMap';

function mockFetchOnce(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function connectedClient(): Promise<Client> {
  const hotpepperClient = new HotpepperClient('test-api-key');
  const server = createServer(hotpepperClient, 'test-ray-id');
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('search_restaurants tool', () => {
  it('tool一覧にsearch_restaurantsが登録されている', async () => {
    mockFetchOnce({});
    const client = await connectedClient();

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name)).toEqual(['search_restaurants']);
  });

  it('search_restaurantsツールに地図UIリソース（MCP Apps）が紐付けられている', async () => {
    mockFetchOnce({});
    const client = await connectedClient();

    const { tools } = await client.listTools();

    const tool = tools.find((t) => t.name === 'search_restaurants');
    expect((tool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri).toBe(SHOP_MAP_RESOURCE_URI);
  });

  it('地図UIリソースの内容にCesiumJS地図とCSP設定（resourceDomains/connectDomains）が含まれる', async () => {
    mockFetchOnce({});
    const client = await connectedClient();

    const result = await client.readResource({ uri: SHOP_MAP_RESOURCE_URI });

    const resourceContent = result.contents[0] as {
      text: string;
      _meta?: { ui?: { csp?: { resourceDomains?: string[]; connectDomains?: string[] } } };
    };
    expect(resourceContent.text).toContain('cesiumContainer');
    expect(resourceContent._meta?.ui?.csp?.resourceDomains).toContain('https://cesium.com');
    expect(resourceContent._meta?.ui?.csp?.connectDomains).toContain('https://tile.openstreetmap.org');
  });

  it('正常系: 検索結果をJSON文字列として返し、structuredContentにも同じ内容（緯度経度を含む）が入る', async () => {
    mockFetchOnce({
      results: {
        results_available: 1,
        shop: [
          {
            name: '居酒屋テスト',
            genre: { name: '居酒屋' },
            address: '東京都渋谷区テスト1-1-1',
            budget: { name: '2001～3000円' },
            catch: 'テスト用のキャッチコピー',
            photo: { pc: { m: 'https://example.com/photo.jpg' } },
            urls: { pc: 'https://example.com/shop' },
            open: '17:00～23:00',
            close: '日曜日',
            lat: '35.6608183454',
            lng: '139.7754267645',
          },
        ],
      },
    });
    const client = await connectedClient();

    const result = await client.callTool({ name: 'search_restaurants', arguments: { area: '渋谷', genre: '居酒屋' } });

    expect(result.isError).toBeFalsy();
    const content = result.content as { type: string; text: string }[];
    const parsed = JSON.parse(content[0].text);
    const expectedResult = {
      resultsAvailable: 1,
      shops: [
        {
          name: '居酒屋テスト',
          genre: '居酒屋',
          address: '東京都渋谷区テスト1-1-1',
          budget: '2001～3000円',
          catch: 'テスト用のキャッチコピー',
          photo: 'https://example.com/photo.jpg',
          url: 'https://example.com/shop',
          open: '17:00～23:00',
          close: '日曜日',
          lat: 35.6608183454,
          lng: 139.7754267645,
        },
      ],
    };
    expect(parsed).toEqual(expectedResult);
    expect(result.structuredContent).toEqual(expectedResult);
  });

  it('パラメータ不正（areaが未指定）の場合はisError: trueを返す', async () => {
    const client = await connectedClient();

    const result = await client.callTool({ name: 'search_restaurants', arguments: { genre: '居酒屋' } });

    expect(result.isError).toBe(true);
  });

  it('通信エラー（fetch失敗）の場合はisError: trueを返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const client = await connectedClient();

    const result = await client.callTool({ name: 'search_restaurants', arguments: { area: '渋谷', genre: '居酒屋' } });

    expect(result.isError).toBe(true);
  });

  it('0件ヒットの場合はエラーにせずresultsAvailable: 0を返す', async () => {
    mockFetchOnce({ results: { results_available: 0, shop: [] } });
    const client = await connectedClient();

    const result = await client.callTool({ name: 'search_restaurants', arguments: { area: '渋谷', genre: '居酒屋' } });

    expect(result.isError).toBeFalsy();
    const content = result.content as { type: string; text: string }[];
    expect(JSON.parse(content[0].text)).toEqual({ resultsAvailable: 0, shops: [] });
  });
});
