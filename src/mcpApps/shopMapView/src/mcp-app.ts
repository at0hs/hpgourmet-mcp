/**
 * Shop Map MCP App
 *
 * search_restaurantsの検索結果（shops[0]）をCesiumJSの地球儀上にピン表示する。
 * https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/map-server の
 * 実装パターン（CDNからのCesiumJS動的ロード、Ion無効化＋OSMタイル）を踏襲している。
 */
import { App } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// TypeScript declaration for Cesium loaded from CDN
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let Cesium: any;

const CESIUM_VERSION = "1.123";
const CESIUM_BASE_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

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
  lat: number;
  lng: number;
}

/** 店舗の位置にピンとラベルを追加し、カメラをその位置へ移動する。 */
async function showShop(cesiumViewer: any, shop: Shop): Promise<void> {
  cesiumViewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(shop.lng, shop.lat),
    point: {
      pixelSize: 12,
      color: Cesium.Color.CRIMSON,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: shop.name,
      font: "14px sans-serif",
      fillColor: Cesium.Color.WHITE,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 3,
      outlineColor: Cesium.Color.BLACK,
      pixelOffset: new Cesium.Cartesian2(0, -20),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    },
  });

  await new Promise<void>((resolve) => {
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
  });

  await waitForTilesLoaded(cesiumViewer);
  hideLoading();
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

function extractFirstShop(result: CallToolResult): Shop | undefined {
  const structured = result.structuredContent as { shops?: unknown[] } | undefined;
  const data = Array.isArray(structured?.shops) ? structured : findShopsFromContent(result);
  const shop = data?.shops?.[0] as { name?: unknown; lat?: unknown; lng?: unknown } | undefined;
  if (shop && typeof shop.name === "string" && typeof shop.lat === "number" && typeof shop.lng === "number") {
    return { name: shop.name, lat: shop.lat, lng: shop.lng };
  }
  return undefined;
}

const PREFERRED_HEIGHT = 400;

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
  const shop = extractFirstShop(result);
  log.info("extractFirstShop ->", JSON.stringify(shop));
  if (shop) {
    log.info("showShop start:", shop.name, shop.lat, shop.lng);
    await showShop(viewer, shop);
    log.info("showShop done");
  } else {
    log.warn("no shop found in toolresult, skip showShop");
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
