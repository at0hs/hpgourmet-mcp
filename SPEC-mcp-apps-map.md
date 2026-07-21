# SPEC: search_restaurants結果のMCP Apps地図表示（CesiumJS版）

## 背景・目的
Claude組み込みの「places」的な地図UIと同様の体験を、ホットペッパーグルメMCPサーバーでも提供する。MCP Apps（SEP-1865、`@modelcontextprotocol/ext-apps`）を使い、`search_restaurants`ツールの検索結果に地図UIを追加する。

当初はキー不要のGoogle Maps埋め込み（iframe）方式で実装したが、Claude Desktop上で地図が表示されない問題（コンソールに`t.custom is not a function`エラー）が発生し、原因究明が難航した。切り分けのため公式のCesiumJS地図サンプルを`/diagnostic`エンドポイントとして移植したところ、こちらは動作実証済みであることが確認できた。そのため、`search_restaurants`の地図表示をCesiumJSベースで作り直し、目視確認まで完了した（`shops[0]`の1件のみをピン＋ラベル表示するスモールスタート版）。

その後、同じ知見（ホストが`ontoolresult`で`structuredContent`を転送しないことがある）をGoogle Maps版にも適用して再検証したが、Google Maps版では改善が確認できなかったため、Google Maps版は断念し、CesiumJS版を正式な実装方針として採用した。本SPECはそのCesiumJS版の完成度を高めるための改修を対象とする。

## 受入条件
1. `search_restaurants`の検索結果のうち上位10件まで（`shops.slice(0, 10)`）の緯度経度をもとに、CesiumJSの地球儀上にピン＋ラベル（店舗名）を表示する。全ピンは同じ見た目（色・サイズ）で均等に扱い、特定の店舗を強調しない。
2. 各ピンをクリック/タップすると、店名・ジャンル・予算・住所を含む詳細情報をCesiumの標準infoBox（ポップアップ）で表示する。
3. カメラは表示する全ピンが収まるように自動調整する（1件のみの場合は該当店舗にフォーカス、複数件の場合は全ピンのbounding boxにフィットさせる）。
4. 地図タイルを現在の標準OpenStreetMapタイルから、国土地理院（GSI）の標準地図タイルに変更し、地理院タイルの利用規約に従ったクレジット表示を行う。
5. 既存のテキストレスポンス（店舗一覧のJSON文字列）は変更前と同様にそのまま返す（地図UIは追加であり、置き換えではない）。
6. 検索結果データのUI側への受け渡しは`toolresult`イベント経由で行う。ホストが`structuredContent`を転送しない場合に備え、`content`配列内のテキスト（JSON文字列）から店舗データを復元するフォールバックは維持する。
7. ローカル`wrangler dev` + Claude Desktop接続で、複数件ヒットする検索を実行し、複数ピン・infoBox・GSIタイルが実際に表示されることを目視確認する。
8. ユニットテスト（`shopMap.test.ts`）を新実装に合わせて更新し、UIリソースの構造（GSIタイルURL・複数ピン処理・infoBox用description・CSP設定）を検証する。
9. 既存テスト（`index.test.ts`、`HotpepperClient.test.ts`）が通り続ける。
10. `npm run check`（型チェック・フォーマットチェック）が通る。

## 非目標（スコープ外）
- 検索結果の全件表示（今回は上位10件までに上限を設ける）
- ピンのクラスタリング（近接ピンの集約表示）等、10件を超える大量表示に対応する高度な表示
- 経路検索・ナビゲーション機能
- モデル向けの地図操作ツール（診断版にある`navigate-to`/`get-current-view`相当）の実装
- `outputSchema`／`inputSchema`の`.refine()`に関する`t.custom is not a function`エラーの原因究明（保留のまま先送り）
- `diagnosticMap.ts` / `/diagnostic`エンドポイント・`mapDiagnosticView`の削除（引き続き検証用参照実装として残す）
- Google Maps版への回帰（今回のCesiumJS改善がうまくいかない場合の再検討事項とし、本SPECの対象外とする）
- 検索結果が0件の場合の地図表示（対象がないため地図UI上はピンなしの初期表示のまま）
- VS Code / ChatGPT等、Claude以外のMCP Appsクライアントでの動作保証

## 仕様詳細

### タイルソースの変更（`shopMapView/src/mcp-app.ts`）
- `Cesium.UrlTemplateImageryProvider`の`url`を`https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png`（国土地理院 標準地図）に変更する。
- 地理院タイルの利用規約に従い、`credit`に出典表示（「国土地理院」等）を設定する。

### 複数ピン表示
- `ontoolresult`ハンドラで受け取った`shops`配列から先頭10件を取り出し、各店舗ごとに`Cesium.Entity`（point + label）を追加する。全ピンは同一の色・サイズとする。
- 各Entityの`description`にHTML（店名・ジャンル・住所・予算）を設定し、Cesium標準のinfoBoxでクリック時に表示されるようにする。

### カメラフィット
- 表示件数が1件の場合は現行同様、該当座標に一定高度でフォーカスする。
- 2件以上の場合は、全店舗の緯度経度からbounding rectangleを計算し、`camera.flyTo`の`destination`にその範囲を渡してフィットさせる（診断版`calculateDestination`と同様の考え方）。

### `shopMap.ts`側
- CSP設定の`resourceDomains`/`connectDomains`に国土地理院タイルのドメイン（`https://cyberjapandata.gsi.go.jp`）を追加する。CesiumJS CDN関連の設定は維持する。
- `shopSchema`/`searchRestaurantsOutputSchema`は変更しない。

### 例外・境界ケース
- 検索結果が0件の場合：地図リソース自体はツールに紐づいたまま返るが、UI側は店舗データなしの初期表示（ピンなし）のままとする。
- 店舗の緯度経度が欠損・不正な値の場合：該当店舗のみピン表示をスキップする（他の正常な店舗の表示には影響しない）。
- 11件目以降の店舗：地図には反映しない（非目標に記載の通り）。

## テスト方針
- `shopMap.test.ts`を更新する：
  - 国土地理院タイルのURL（`cyberjapandata.gsi.go.jp`）を含むことを検証する。
  - 複数件のshopsをピン表示するロジック（`slice(0, 10)`相当の処理）を含むことを検証する。
  - infoBox用の`description`設定ロジックを含むことを検証する。
  - CSP設定（`resourceDomains`/`connectDomains`に地理院タイルドメインが含まれること）を検証する。
- 手動E2E：ローカル`wrangler dev` + Claude Desktopで、複数件ヒットする検索（例：エリアのみでジャンル・キーワード指定なし等）を実行し、複数ピン・infoBoxクリック・GSIタイル表示を目視確認する。
- `HotpepperClient.test.ts`・`index.test.ts`は既存内容のまま変更不要見込み。

## 互換性・移行
- 既存のMCPクライアント（テキストのみ対応）への影響なし。テキストレスポンスは維持されるため、地図UIを解釈できないクライアントでも従来通り利用できる。
- 破壊的変更なし。新規ブランチ`feature/mcp-apps-map`上での作業であり、mainへの影響はマージするまで発生しない。
- 依存パッケージの変更なし。

## ロールバック案
- 作業ブランチ（`feature/mcp-apps-map`）を破棄する、またはコミットをrevertすることで容易に戻せる。
- タイル変更やカメラフィットのロジックのみ問題が出た場合は、該当箇所のみ現行実装（OSMタイル・単一ピン）に戻すことも可能。
