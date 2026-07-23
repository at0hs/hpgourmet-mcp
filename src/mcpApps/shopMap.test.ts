import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { describe, expect, it } from 'vitest';
import { registerShopMapResource, searchRestaurantsOutputSchema, SHOP_MAP_RESOURCE_URI } from './shopMap';

async function connectedClient(): Promise<Client> {
  const server = new McpServer({ name: 'test-server', version: '0.0.0' });
  registerShopMapResource(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('registerShopMapResource', () => {
  it('resources一覧に地図UIリソースがMCP AppsのMIMEタイプで登録されている', async () => {
    const client = await connectedClient();

    const { resources } = await client.listResources();

    const resource = resources.find((r) => r.uri === SHOP_MAP_RESOURCE_URI);
    expect(resource).toBeDefined();
    expect(resource?.mimeType).toBe(RESOURCE_MIME_TYPE);
  });

  it('リソース本文はCesiumJSのCDN読み込みと、ホストからの検索結果受信ロジックを含む', async () => {
    const client = await connectedClient();

    const result = await client.readResource({ uri: SHOP_MAP_RESOURCE_URI });

    const content = result.contents[0] as { text: string };
    expect(content.text).toContain('cesiumContainer');
    expect(content.text).toContain('cesium.com/downloads/cesiumjs');
    expect(content.text).toContain('tile.openstreetmap.org');
    expect(content.text).toContain('ontoolresult');
    expect(content.text).toContain('structuredContent');
  });

  it('リソース本文は上位10件に絞って複数ピンを表示する処理を含む', async () => {
    const client = await connectedClient();

    const result = await client.readResource({ uri: SHOP_MAP_RESOURCE_URI });

    const content = result.contents[0] as { text: string };
    expect(content.text).toContain(',10)');
  });

  it('リソース本文はピンのinfoBoxに住所（Googleマップへのリンク）とホットペッパーへのリンクを表示する処理を含む', async () => {
    const client = await connectedClient();

    const result = await client.readResource({ uri: SHOP_MAP_RESOURCE_URI });

    const content = result.contents[0] as { text: string };
    expect(content.text).toContain('google.com/maps/search');
    expect(content.text).toContain('ホットペッパーで見る');
  });

  it('リソース本文はピンのinfoBoxに店舗写真のサムネイルを表示する処理を含む', async () => {
    const client = await connectedClient();

    const result = await client.readResource({ uri: SHOP_MAP_RESOURCE_URI });

    const content = result.contents[0] as { text: string };
    expect(content.text).toContain('<img');
    expect(content.text).toContain('onerror');
  });

  it('リソース本文はautoResizeを無効化し、固定高さをホストへ能動通知する', async () => {
    const client = await connectedClient();

    const result = await client.readResource({ uri: SHOP_MAP_RESOURCE_URI });

    const content = result.contents[0] as { text: string };
    expect(content.text).toContain('autoResize:!1');
    expect(content.text).toContain('sendSizeChanged');
  });

  it('リソース本文のCSP設定でCesiumJS CDN・OpenStreetMapタイル・ホットペッパー写真の読み込みのみを許可している', async () => {
    const client = await connectedClient();

    const result = await client.readResource({ uri: SHOP_MAP_RESOURCE_URI });

    const content = result.contents[0] as {
      _meta?: { ui?: { csp?: { frameDomains?: string[]; resourceDomains?: string[]; connectDomains?: string[] } } };
    };
    expect(content._meta?.ui?.csp?.frameDomains).toBeUndefined();
    expect(content._meta?.ui?.csp?.resourceDomains).toEqual([
      'https://tile.openstreetmap.org',
      'https://cesium.com',
      'https://*.cesium.com',
      'https://imgfp.hotp.jp',
    ]);
    expect(content._meta?.ui?.csp?.connectDomains).toEqual([
      'https://tile.openstreetmap.org',
      'https://cesium.com',
      'https://*.cesium.com',
    ]);
  });
});

describe('searchRestaurantsOutputSchema', () => {
  it('緯度経度を含む店舗データを正しくパースできる', () => {
    const parsed = searchRestaurantsOutputSchema.parse({
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
    });

    expect(parsed.shops[0].lat).toBe(35.6608183454);
    expect(parsed.shops[0].lng).toBe(139.7754267645);
  });

  it('shopsが空配列でもパースできる（0件ヒット時）', () => {
    const parsed = searchRestaurantsOutputSchema.parse({ resultsAvailable: 0, shops: [] });

    expect(parsed).toEqual({ resultsAvailable: 0, shops: [] });
  });
});
