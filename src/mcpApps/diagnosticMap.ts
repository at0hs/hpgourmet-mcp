// MCP Apps（UI付きツール）が実行環境で実際にレンダリングされるかを切り分けるための診断用ツール。
// 公式サンプル（https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/map-server）の
// server.tsをほぼそのまま移植したもの。ホットペッパーAPIとは無関係で、認証も不要。
// 検証が終わったら削除する想定の一時的なコード。
import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { MAP_DIAGNOSTIC_HTML } from './mapDiagnosticHtml.generated';

const resourceUri = 'ui://cesium-map/mcp-app.html';

interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
  class: string;
  type: string;
  importance: number;
}

// Nominatimの利用規約（1秒1リクエスト）を守るためのレート制限
let lastNominatimRequest = 0;
const NOMINATIM_RATE_LIMIT_MS = 1100;

async function geocodeWithNominatim(query: string): Promise<NominatimResult[]> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastNominatimRequest;
  if (timeSinceLastRequest < NOMINATIM_RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_RATE_LIMIT_MS - timeSinceLastRequest));
  }
  lastNominatimRequest = Date.now();

  const params = new URLSearchParams({ q: query, format: 'json', limit: '5' });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      'User-Agent': 'hpgourmet-mcp-map-diagnostic/1.0 (https://github.com/modelcontextprotocol)',
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<NominatimResult[]>;
}

/** 診断用の`show-map`（CesiumJSの地球儀）・`geocode`ツールをMCPサーバーに登録する。 */
export function registerDiagnosticMapTools(server: McpServer): void {
  const cspMeta = {
    ui: {
      csp: {
        connectDomains: ['https://*.openstreetmap.org', 'https://cesium.com', 'https://*.cesium.com'],
        resourceDomains: ['https://*.openstreetmap.org', 'https://cesium.com', 'https://*.cesium.com'],
      },
    },
  };

  registerAppResource(server, resourceUri, resourceUri, { mimeType: RESOURCE_MIME_TYPE }, async (): Promise<ReadResourceResult> => ({
    contents: [
      {
        uri: resourceUri,
        mimeType: RESOURCE_MIME_TYPE,
        text: MAP_DIAGNOSTIC_HTML,
        _meta: cspMeta,
      },
    ],
  }));

  registerAppTool(
    server,
    'show-map',
    {
      title: 'Show Map',
      description:
        'Display an interactive world map zoomed to a specific bounding box. Use the GeoCode tool to find the bounding box of a location. The widget is interactive and exposes tools for navigation (fly to locations) and querying the current view.',
      inputSchema: {
        west: z.number().optional().default(-0.5).describe('Western longitude (-180 to 180)'),
        south: z.number().optional().default(51.3).describe('Southern latitude (-90 to 90)'),
        east: z.number().optional().default(0.3).describe('Eastern longitude (-180 to 180)'),
        north: z.number().optional().default(51.7).describe('Northern latitude (-90 to 90)'),
        label: z.string().optional().describe('Optional label to display on the map'),
      },
      _meta: { ui: { resourceUri } },
    },
    async ({ west, south, east, north, label }): Promise<CallToolResult> => ({
      content: [
        {
          type: 'text',
          text: `Displaying globe at: W:${west.toFixed(4)}, S:${south.toFixed(4)}, E:${east.toFixed(4)}, N:${north.toFixed(4)}${label ? ` (${label})` : ''}`,
        },
      ],
      _meta: {
        viewUUID: randomUUID(),
      },
    }),
  );

  server.registerTool(
    'geocode',
    {
      title: 'Geocode',
      description: 'Search for places using OpenStreetMap. Returns coordinates and bounding boxes for up to 5 matches.',
      inputSchema: {
        query: z.string().describe("Place name or address to search for (e.g., 'Paris', 'Golden Gate Bridge', '1600 Pennsylvania Ave')"),
      },
    },
    async ({ query }): Promise<CallToolResult> => {
      try {
        const results = await geocodeWithNominatim(query);

        if (results.length === 0) {
          return { content: [{ type: 'text', text: `No results found for "${query}"` }] };
        }

        const formattedResults = results.map((r) => ({
          displayName: r.display_name,
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
          boundingBox: {
            south: parseFloat(r.boundingbox[0]),
            north: parseFloat(r.boundingbox[1]),
            west: parseFloat(r.boundingbox[2]),
            east: parseFloat(r.boundingbox[3]),
          },
          type: r.type,
          importance: r.importance,
        }));

        const textContent = formattedResults
          .map(
            (r, i) =>
              `${i + 1}. ${r.displayName}\n   Coordinates: ${r.lat.toFixed(6)}, ${r.lon.toFixed(6)}\n   Bounding box: W:${r.boundingBox.west.toFixed(4)}, S:${r.boundingBox.south.toFixed(4)}, E:${r.boundingBox.east.toFixed(4)}, N:${r.boundingBox.north.toFixed(4)}`,
          )
          .join('\n\n');

        return { content: [{ type: 'text', text: textContent }] };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Geocoding error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
