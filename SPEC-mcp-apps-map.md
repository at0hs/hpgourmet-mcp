# SPEC: search_restaurants結果のMCP Apps地図表示（CesiumJS版）

## 背景・目的
Claude組み込みの「places」的な地図UIと同様の体験を、ホットペッパーグルメMCPサーバーでも提供する。MCP Apps（SEP-1865、`@modelcontextprotocol/ext-apps`）を使い、`search_restaurants`ツールの検索結果に地図UIを追加する。

当初はキー不要のGoogle Maps埋め込み（iframe）方式で実装したが、Claude Desktop上で地図が表示されない問題（コンソールに`t.custom is not a function`エラー）が発生し、原因究明が難航した。切り分けのため公式のCesiumJS地図サンプルを`/diagnostic`エンドポイントとして移植したところ、こちらは動作実証済みであることが確認できた。そのため、本SPECでは`search_restaurants`の地図表示をCesiumJSベースで作り直す。

スモールスタートとして、まずは検索結果の最初の1件の位置のみを地図表示する（検証段階のため）。

## 受入条件
1. `search_restaurants`の検索結果のうち最初の1件（`shops[0]`）の緯度経度をもとに、CesiumJSの地球儀上にピン＋ラベル（店舗名）を表示する。
2. カメラは該当店舗の座標にフォーカスする（flyToまたはsetView）。
3. 既存のテキストレスポンス（店舗一覧のJSON文字列）は変更前と同様にそのまま返す（地図UIは追加であり、置き換えではない）。
4. 検索結果データ（緯度経度を含む）のUI側への受け渡しは`toolresult`イベント経由で行う（Google Maps版と同じ構造を踏襲）。
5. UIリソースはVite（`vite-plugin-singlefile`）でビルドした単一HTMLとして生成し、`.generated.ts`に埋め込んでMCPサーバーから配信する（`/diagnostic`と同じビルドパターン）。
6. ローカル`wrangler dev` + Claude Desktop接続で、実際に地図とピンが表示されることを目視確認する。
7. ユニットテスト（`shopMap.test.ts`）を新実装に合わせて更新し、UIリソースの構造（CesiumJS関連のCDN URL・`toolresult`受信ロジック・CSP設定）を検証する。
8. 既存テスト（`index.test.ts`、`HotpepperClient.test.ts`）が通り続ける。
9. `npm run check`（型チェック・フォーマットチェック）が通る。

## 非目標（スコープ外）
- 検索結果すべての店舗を1枚の地図にまとめて複数ピン表示すること（今回は最初の1件のみ。複数ピン対応は将来の拡張として見送り）
- モデル向けの地図操作ツール（診断版にある`navigate-to`/`get-current-view`相当）の実装
- `outputSchema`／`inputSchema`の`.refine()`に関する`t.custom is not a function`エラーの原因究明（保留のまま先送り。現状の`inputSchema`は`.refine()`を外し手動チェック化した状態を維持する）
- `diagnosticMap.ts` / `/diagnostic`エンドポイント・`mapDiagnosticView`の削除（引き続き検証用参照実装として残す）
- 検索結果が0件の場合の地図表示（対象がないため地図UI上はピンなしの初期表示のまま）
- VS Code / ChatGPT等、Claude以外のMCP Appsクライアントでの動作保証

## 仕様詳細

### ディレクトリ構成
- 新規`src/mcpApps/shopMapView/`を作成する。`mapDiagnosticView/`と同じ構成（`vite.config.ts`、`mcp-app.html`、`src/mcp-app.ts`）とし、診断用と本番用のビルドを完全に分離する。

### ビルド成果物
- Viteでビルドした単一HTMLを`src/mcpApps/shopMapHtml.generated.ts`としてexportする（`mapDiagnosticHtml.generated.ts`と同じパターン）。

### UIロジック（`shopMapView/src/mcp-app.ts`）
- CesiumJSをCDNから動的ロードする（診断版と同じ手法：`<script>`/`<link>`をJSで動的挿入、Ion無効化、OSMタイルレイヤーを使用、Ion tokenは使わない）。
- `App`インスタンスを`autoResize: false`で生成し、`app.connect()`後に固定高さ（診断版と同じ400px）を`sendSizeChanged`で能動通知する。
- `ontoolresult`ハンドラで`result.structuredContent.shops[0]`のlat/lngを取得する。
- 取得した座標にピン（`Cesium.Entity`）とラベル（店舗名）を追加し、カメラをその座標へ移動する（flyToまたはsetView、診断版の`calculateDestination`相当のロジックを流用して良い）。
- モデル向けの追加ツール（`navigate-to`等）は実装しない。
- 画面のfullscreenボタン・display mode対応など、地図表示に必須でない診断版の付帯機能は本実装では省略可（必要最小限のみ移植する）。

### `shopMap.ts`側の変更
- 生成済みHTML（`shopMapHtml.generated.ts`）を`registerAppResource`で返すよう書き換える。
- CSP設定を診断版に合わせて変更する：`resourceDomains`/`connectDomains`に`https://cesium.com`、`https://*.cesium.com`、`https://*.openstreetmap.org`を追加し、Google Maps用の`frameDomains`は削除する。
- `shopSchema`/`searchRestaurantsOutputSchema`は変更しない。

### `index.ts`側の変更
- 変更不要見込み（既存の`registerShopMapResource`・`SHOP_MAP_RESOURCE_URI`参照構造をそのまま利用できるため）。

### 例外・境界ケース
- 検索結果が0件の場合：地図リソース自体はツールに紐づいたまま返るが、UI側は店舗データなしの初期表示（ピンなし）のままとする。
- 最初の店舗の緯度経度が欠損・不正な値の場合：zodスキーマで既に`number`必須のため通常は発生しない想定。UI側で値が無い場合はピン表示処理をスキップする。
- 2件目以降の店舗：今回は地図に反映しない（非目標に記載の通り）。

## テスト方針
- `shopMap.test.ts`を更新する：
  - Google Maps関連のアサーション（`https://www.google.com/maps?q=`、`frameDomains: ['https://www.google.com']`等）を削除する。
  - CesiumJS関連のCDN URL・`toolresult`/`structuredContent`受信ロジックを含むことを検証するアサーションに置き換える。
  - CSP設定（`resourceDomains`/`connectDomains`にcesium.com・openstreetmap.org系が含まれること）を検証するアサーションに置き換える。
- 手動E2E：ローカル`wrangler dev` + Claude Desktopで`search_restaurants`を実行し、地図・ピン表示を目視確認する（前回Google Maps版では断念していたが、CesiumJSは動作実績があるため今回は実施する）。
- `HotpepperClient.test.ts`・`index.test.ts`は既存内容のまま変更不要見込み（lat/lng対応は既に完了済みのため）。

## 互換性・移行
- 既存のMCPクライアント（テキストのみ対応）への影響なし。テキストレスポンスは維持されるため、地図UIを解釈できないクライアントでも従来通り利用できる。
- 破壊的変更なし。新規ブランチ`feature/mcp-apps-map`上での作業であり、mainへの影響はマージするまで発生しない。
- 依存パッケージの新規追加なし（CesiumJS自体はCDN読み込みのため`package.json`への追加は不要。`vite-plugin-singlefile`等は既存`devDependencies`を流用する）。

## ロールバック案
- 作業ブランチ（`feature/mcp-apps-map`）を破棄する、またはコミットをrevertすることで容易に戻せる。
- `shopMap.ts`は既存ファイルの上書きのため、git履歴から旧Google Maps版に戻すことも可能。
