/**
 * Shop Map MCP App
 *
 * search_restaurantsの検索結果（上位10件）をCesiumJSの地球儀上にピン表示する。
 * https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/map-server の
 * 実装パターン（CDNからのCesiumJS動的ロード、Ion無効化＋タイルレイヤー）を踏襲している。
 */
import { App } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// TypeScript declaration for Cesium loaded from CDN
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let Cesium: any;

const CESIUM_VERSION = "1.123";
const CESIUM_BASE_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

const MAX_SHOPS = 10;

const log = {
  info: console.log.bind(console, "[shop-map]"),
  warn: console.warn.bind(console, "[shop-map]"),
  error: console.error.bind(console, "[shop-map]"),
};

/** 静的<script src="">はsrcdocのiframeで動作しないため、CesiumJSをCDNから動的ロードする。 */
async function loadCesium(): Promise<void> {
  if (typeof Cesium !== "undefined") {
    return;
  }

  const cssLink = document.createElement("link");
  cssLink.rel = "stylesheet";
  cssLink.href = `${CESIUM_BASE_URL}/Widgets/widgets.css`;
  document.head.appendChild(cssLink);

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${CESIUM_BASE_URL}/Cesium.js`;
    script.onload = () => {
      (window as any).CESIUM_BASE_URL = CESIUM_BASE_URL;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load CesiumJS from CDN"));
    document.head.appendChild(script);
  });
}

/** CesiumJSをOpenStreetMapタイルで初期化する（Cesium Ionは使用しない）。 */
async function initCesium(): Promise<any> {
  Cesium.Ion.defaultAccessToken = undefined;
  // Ion無効時はデフォルトの表示範囲設定が必須。日本全体を初期表示範囲とする。
  Cesium.Camera.DEFAULT_VIEW_RECTANGLE = Cesium.Rectangle.fromDegrees(122, 24, 146, 46);

  const cesiumViewer = new Cesium.Viewer("cesiumContainer", {
    // 標準UIのinfoBox（ピンクリック時の詳細ポップアップ）は有効のままにする。
    baseLayer: false,
    geocoder: false,
    baseLayerPicker: false,
    animation: false,
    timeline: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    terrainProvider: undefined,
    contextOptions: {
      webgl: {
        preserveDrawingBuffer: true,
        alpha: true,
      },
    },
    useBrowserRecommendedResolution: false,
  });

  cesiumViewer.scene.globe.show = true;
  cesiumViewer.scene.globe.enableLighting = false;
  cesiumViewer.scene.globe.baseColor = Cesium.Color.DARKSLATEGRAY;
  cesiumViewer.scene.requestRenderMode = false;
  cesiumViewer.canvas.style.imageRendering = "auto";
  cesiumViewer.scene.postProcessStages.fxaa.enabled = false;

  for (const eventName of ["touchstart", "touchmove"] as const) {
    cesiumViewer.canvas.addEventListener(eventName, (e: TouchEvent) => e.preventDefault(), { passive: false });
  }

  // OpenStreetMap標準タイル。非商用・小規模利用の範囲でTile Usage Policy
  // （https://operations.osmfoundation.org/policies/tiles/）に沿って利用する。
  const osmProvider = new Cesium.UrlTemplateImageryProvider({
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    minimumLevel: 0,
    maximumLevel: 19,
    credit: new Cesium.Credit('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', true),
  });
  osmProvider.errorEvent.addEventListener((error: unknown) => log.error("OSM imagery provider error:", error));
  cesiumViewer.imageryLayers.addImageryProvider(osmProvider);

  cesiumViewer.camera.flyTo({
    destination: Cesium.Camera.DEFAULT_VIEW_RECTANGLE,
    duration: 0,
  });

  return cesiumViewer;
}

/** 地図タイルの読み込み完了を待つ（最大10秒）。 */
function waitForTilesLoaded(cesiumViewer: any): Promise<void> {
  return new Promise((resolve) => {
    if (cesiumViewer.scene.globe.tilesLoaded) {
      resolve();
      return;
    }
    const removeListener = cesiumViewer.scene.globe.tileLoadProgressEvent.addEventListener((queueLength: number) => {
      if (queueLength === 0 && cesiumViewer.scene.globe.tilesLoaded) {
        removeListener();
        resolve();
      }
    });
    setTimeout(() => {
      removeListener();
      resolve();
    }, 10000);
  });
}

function hideLoading(): void {
  const loadingEl = document.getElementById("loading");
  if (loadingEl) {
    loadingEl.style.display = "none";
  }
}

interface Shop {
  name: string;
  address?: string;
  photo?: string;
  url?: string;
  lat: number;
  lng: number;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** 緯度経度からGoogleマップの検索結果ページを開くURLを組み立てる。 */
function buildGoogleMapsUrl(shop: Shop): string {
  return `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`;
}

/** infoBoxに表示する店舗詳細のHTMLを組み立てる。CesiumのInfoBoxはダークテーマのため、それに馴染むダークカードにしている。 */
function buildShopDescription(shop: Shop): string {
  const photo = shop.photo
    ? `<img src="${escapeHtml(shop.photo)}" alt="${escapeHtml(shop.name)}" style="width:200px;height:150px;max-width:100%;object-fit:cover;display:block;margin:0 auto 12px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.4);" onerror="this.style.display='none'" />`
    : "";
  const addressRow = shop.address
    ? `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #383e4a;"><span style="font-size:15px;">📍</span><a href="${escapeHtml(buildGoogleMapsUrl(shop))}" target="_blank" rel="noopener noreferrer" style="color:#7dd3fc;text-decoration:none;font-size:13px;">${escapeHtml(shop.address)}</a></div>`
    : "";
  const urlRow = shop.url
    ? `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;"><span style="font-size:15px;">🔗</span><a href="${escapeHtml(shop.url)}" target="_blank" rel="noopener noreferrer" style="color:#facc15;text-decoration:none;font-size:13px;font-weight:600;">ホットペッパーで見る ›</a></div>`
    : "";
  return `<div style="background:#20242c;padding:14px;border-radius:10px;font-family:-apple-system,'Segoe UI',sans-serif;color:#e5e7eb;">${photo}${addressRow}${urlRow}</div>`;
}

/** 店舗すべてにピンを追加し、全ピンが収まるようカメラを移動する。店名はクリック時のinfoBoxで確認できるため、常時表示のラベルは付けない（密集時の重なり防止）。 */
async function showShops(cesiumViewer: any, shops: Shop[]): Promise<void> {
  for (const shop of shops) {
    cesiumViewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(shop.lng, shop.lat),
      point: {
        pixelSize: 12,
        color: Cesium.Color.CRIMSON,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      name: shop.name,
      description: buildShopDescription(shop),
    });
  }

  await new Promise<void>((resolve) => {
    if (shops.length === 1) {
      const shop = shops[0];
      cesiumViewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(shop.lng, shop.lat, 1000),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
        duration: 1.5,
        complete: () => resolve(),
        cancel: () => resolve(),
      });
    } else {
      cesiumViewer.camera.flyTo({
        destination: computeBoundingDestination(shops),
        duration: 1.5,
        complete: () => resolve(),
        cancel: () => resolve(),
      });
    }
  });

  await waitForTilesLoaded(cesiumViewer);
  hideLoading();
}

/** 複数店舗の緯度経度から、全ピンが収まるRectangleを計算する。 */
function computeBoundingDestination(shops: Shop[]): any {
  const west = Math.min(...shops.map((s) => s.lng));
  const east = Math.max(...shops.map((s) => s.lng));
  const south = Math.min(...shops.map((s) => s.lat));
  const north = Math.max(...shops.map((s) => s.lat));
  return Cesium.Rectangle.fromDegrees(west, south, east, north);
}

/** ホストが`structuredContent`を転送しない場合があるため、`content`内のテキストからのJSON復元をフォールバックとして用意する。 */
function findShopsFromContent(result: CallToolResult): { shops?: unknown[] } | undefined {
  for (const block of result.content ?? []) {
    if (block.type !== "text") {
      continue;
    }
    try {
      const parsed = JSON.parse(block.text) as { shops?: unknown[] };
      if (Array.isArray(parsed.shops)) {
        return parsed;
      }
    } catch {
      // JSON以外のテキストブロック（代替テキスト等）はスキップする
    }
  }
  return undefined;
}

function isValidShop(shop: unknown): shop is Shop {
  const s = shop as { name?: unknown; lat?: unknown; lng?: unknown } | undefined;
  return !!s && typeof s.name === "string" && typeof s.lat === "number" && typeof s.lng === "number";
}

function extractShops(result: CallToolResult): Shop[] {
  const structured = result.structuredContent as { shops?: unknown[] } | undefined;
  const data = Array.isArray(structured?.shops) ? structured : findShopsFromContent(result);
  const rawShops = data?.shops ?? [];
  return rawShops.filter(isValidShop).slice(0, MAX_SHOPS) as Shop[];
}

// Cesium ViewerはリサイズのたびにinfoBox.viewModel.maxHeightを「コンテナ高さ - 125px」で自動調整するため、
// ウィジェット全体の高さを広げるだけでinfoBoxの表示可能領域も連動して広がる。
const PREFERRED_HEIGHT = 550;

let viewer: any = null;

const app = new App({ name: "hpgourmet-shop-map", version: "0.1.0" }, {}, { autoResize: false });

app.onerror = log.error;

app.onteardown = async () => {
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }
  return {};
};

app.ontoolresult = async (result) => {
  log.info("ontoolresult received:", JSON.stringify(result));
  if (!viewer) {
    log.warn("ontoolresult received but viewer is not ready yet");
    return;
  }
  const shops = extractShops(result);
  log.info("extractShops ->", shops.length, "shops");
  if (shops.length > 0) {
    log.info("showShops start");
    await showShops(viewer, shops);
    log.info("showShops done");
  } else {
    log.warn("no shops found in toolresult, skip showShops");
  }
};

async function initialize(): Promise<void> {
  try {
    log.info("loading CesiumJS from CDN...");
    await loadCesium();
    log.info("CesiumJS loaded");

    viewer = await initCesium();
    log.info("CesiumJS viewer initialized");

    await app.connect();
    log.info("connected to host");

    app.sendSizeChanged({ height: PREFERRED_HEIGHT });
    log.info("sendSizeChanged sent:", PREFERRED_HEIGHT);
  } catch (error) {
    log.error("Failed to initialize:", error);
    const loadingEl = document.getElementById("loading");
    if (loadingEl) {
      loadingEl.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
      loadingEl.style.background = "rgba(200, 0, 0, 0.8)";
    }
  }
}

initialize();
