# ホットペッパーMCPサーバー

## このプロジェクトについて
リクルートwebサービスのAPIつかってホットペッパーグルメのMCPサーバーを作るプロジェクトです。
- 設計: S:\03_Development\98_ObsidianVault\DevelopmentVault\hpgourmmet-mcp-docs\design.md
- リクルートwebサービス APIリファレンス: S:\03_Development\98_ObsidianVault\DevelopmentVault\hpgourmmet-mcp-docs\APIリファレンス

## 進め方（重要）

1. ユーザーの指示に不明瞭な部分があれば質問する
2. 不明点がなくなるまで1を繰り返す
3. 方針を示して、ユーザーにこれで進めていいか確認する
特にコーディングする際は**必ず**確認してから進めてください・
4. 作業を実施

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
