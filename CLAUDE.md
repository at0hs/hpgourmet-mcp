# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command               | Purpose                   |
| --------------------- | ------------------------- |
| `npx wrangler dev`    | Local development         |
| `npx wrangler deploy` | Deploy to Cloudflare      |
| `npx wrangler types`  | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/

## 進め方（重要）

1. ユーザーの指示に不明瞭な部分があれば質問する
2. 不明点がなくなるまで1を繰り返す
3. 方針を示して、ユーザーにこれで進めていいか確認する
特にコーディングする際は**必ず**確認してから進めてください・
4. 作業を実施

## このプロジェクトについて
リクルートwebサービスのAPIつかってホットペッパーグルメのMCPサーバーを作るプロジェクトです。
- 設計: S:\03_Development\98_ObsidianVault\DevelopmentVault\hpgourmmet-mcp-docs\design.md
- リクルートwebサービス APIリファレンス: S:\03_Development\98_ObsidianVault\DevelopmentVault\hpgourmmet-mcp-docs\APIリファレンス
