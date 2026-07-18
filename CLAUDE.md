# ホットペッパーMCPサーバー

## このプロジェクトについて
リクルートwebサービスのAPIつかってホットペッパーグルメのMCPサーバーを作るプロジェクトです。
- 設計: S:\03_Development\98_ObsidianVault\DevelopmentVault\hpgourmmet-mcp-docs\design.md
- リクルートwebサービス APIリファレンス: S:\03_Development\98_ObsidianVault\DevelopmentVault\hpgourmmet-mcp-docs\API-reference

## 最重要ルール（必ず守る）
IMPORTANT:
- 不明点・選択肢・前提が 1つでもあるなら、必ず質問して埋める。推測で進めない。
- 最初の返答は「質問（＋理解の要約）」のみ。未確定が残る限り、実装案や修正案に踏み込まない。
- こちらの明示的な合図（例:「OK」「GO」「その方針で」）があるまで、次フェーズへ進まない。
- 迷ったら確認を増やす（遠慮しない）。ただし質問は “答えれば前に進むもの” に限定する。

## 質問の出し方（AskUserQuestion 優先）
- 可能な限り AskUserQuestion を使って、選択式（A/B/C、Yes/No、数値、短文）で答えやすくする。
- 質問は優先度順に、1回あたり 3〜7 個。まずブロッカー（答えがないと進めない）を先に。
- 仕様決めが必要な箇所は、必ず「複数案 + 推奨案 + トレードオフ」を提示して選んでもらう。

## ワークフロー（必ずこの順で）
### Phase 0: インテイク（最初のターン）
1) 依頼内容の理解を 1〜3 行で要約
2) 現時点で分かっていることを箇条書き
   - 目的（何を達成するか）
   - スコープ（含む/含まない）
   - 受入条件（どうなったら完了か）
   - 制約（期限/互換性/性能/セキュリティ/運用/依存）
3) 未確定事項を列挙し、質問する（ここで止まる）

### Phase 1: 合意形成（必要なら SPEC を作る）
- タスクが中規模以上、または曖昧さが残る場合：
  - 質問の回答が揃ったら、仕様を SPEC.md（または tmp/）にまとめる案を提示する
  - 仕様に含める：受入条件 / 非目標 / 仕様詳細 / 例外・境界 / テスト方針 / 互換性 / 移行・ロールバック
  - SPEC案を出したら「承認してよいか」を必ず確認する
- 小さな作業でも、最低限「受入条件」と「非目標」は確認して合意を取る
- 実装計画には極力コードを記載しないこと。ユーザーがわかりやすいように文章で説明すること。

### Phase 2: 実装計画（Plan）
- 変更方針、変更対象（ファイル/モジュール）、ステップ、テスト計画、影響範囲、ロールバック案を提示
- ここでも未確定があれば Phase 0 に戻って質問する
- 「この計画で進めてよいか」を必ず確認する

### Phase 3: 実行（コーディング/修正/レビュー）
- 私の「GO」が出るまで、編集・コミット・破壊的コマンドはしない
- 実行中に以下が出たら必ず停止して質問：
  (a) 高リスク/不可逆/環境変更の操作が必要
  (b) 方針の分岐（複数の実装/設計があり得る）
  (c) 想定外の結果（テスト失敗、ログで異常、互換性懸念）
- 主要ステップごとに必ずミニ報告：
  - 何をしたか（要点）
  - 影響範囲
  - 次に何をするか
  - 続行してよいか

## コマンド

| コマンド              | 目的                   |
| --------------------- | ---------------------- |
| `npx wrangler dev`    | ローカル開発           |
| `npx wrangler deploy` | Cloudflareへのデプロイ |
| `npx wrangler types`  | TypeScriptの型生成     |

wrangler.jsonc 内のバインディング（bindings）を変更した後は、`wrangler types` を実行してください。

## Cloudflare Workers

注意：Cloudflare WorkersのAPIや制限に関するあなたの知識は古い可能性があります。Workers、KV、R2、D1、Durable Objects、Queues、Vectorize、AI、またはAgents SDKに関するタスクを行う前には、必ず最新のドキュメントを取得してください。

### ドキュメント

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

すべての制限（limits）およびクォータ（quotas）については、各製品の `/platform/limits/` ページから取得してください。 例: `/workers/platform/limits`

### Node.js 互換性

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

### エラー

- **エラー 1102** (CPU/メモリ超過): `/workers/platform/limits/` から制限値を取得してください。
- **すべてのエラー**: https://developers.cloudflare.com/workers/observability/errors/

### 製品ドキュメント

APIリファレンスと制限については、以下から取得してください：
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

### ベストプラクティス（条件付き）

アプリケーションが Durable Objects または Workflows を使用している場合は、関連するベストプラクティスを参照してください：

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
