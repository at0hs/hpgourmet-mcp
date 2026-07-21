// search_restaurantsの結果をMCP Apps（https://modelcontextprotocol.io/docs/extensions/apps）で地図表示するためのUIリソース。
// スモールスタートとして、検索結果の最初の店舗（shops[0]）の緯度経度のみを、
// CesiumJS（OpenStreetMapタイル、Cesium Ion不使用）の地球儀上にピン＋ラベルで表示する。
// UI本体はshopMapView/でVite（vite-plugin-singlefile）ビルドし、shopMapHtml.generated.tsに埋め込んでいる。
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { SHOP_MAP_HTML } from './shopMapHtml.generated';

export const SHOP_MAP_RESOURCE_URI = 'ui://hpgourmet-mcp/shop-map.html';

const CESIUM_ORIGIN = 'https://cesium.com';
const CESIUM_WILDCARD_ORIGIN = 'https://*.cesium.com';
const OSM_WILDCARD_ORIGIN = 'https://*.openstreetmap.org';

export const shopSchema = z.object({
  name: z.string(),
  genre: z.string(),
  address: z.string(),
  budget: z.string(),
  catch: z.string(),
  photo: z.string(),
  url: z.string(),
  open: z.string(),
  close: z.string(),
  lat: z.number(),
  lng: z.number(),
});

/** search_restaurantsのoutputSchema。既存のGourmetSearchResultと同じ形。 */
export const searchRestaurantsOutputSchema = z.object({
  resultsAvailable: z.number(),
  shops: z.array(shopSchema),
});

/** 地図UIリソースをMCPサーバーに登録する。search_restaurantsツール側は`_meta.ui.resourceUri`でこのURIを参照する。 */
export function registerShopMapResource(server: McpServer): void {
  registerAppResource(server, 'Shop Map', SHOP_MAP_RESOURCE_URI, { description: '検索結果の最初の店舗の位置を地図表示する' }, async () => ({
    contents: [
      {
        uri: SHOP_MAP_RESOURCE_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: SHOP_MAP_HTML,
        _meta: {
          ui: {
            csp: {
              resourceDomains: [OSM_WILDCARD_ORIGIN, CESIUM_ORIGIN, CESIUM_WILDCARD_ORIGIN],
              connectDomains: [OSM_WILDCARD_ORIGIN, CESIUM_ORIGIN, CESIUM_WILDCARD_ORIGIN],
            },
          },
        },
      },
    ],
  }));
}
