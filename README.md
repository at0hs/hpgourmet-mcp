# hpgourmet-mcp

ホットペッパーグルメ WEBサービスAPIをラップし、Claude等のLLMクライアントから自然文で飲食店検索ができるようにするMCPサーバーです。
Cloudflare Workers上でステートレスに動作し、認証なしで公開しています。

## 接続方法

接続URL:

```
https://hpgourmet-mcp.atohs.workers.dev/
```

### Claude Desktop

`claude_desktop_config.json`に以下を追記します。

```json
{
  "mcpServers": {
    "hpgourmet-mcp": {
      "url": "https://hpgourmet-mcp.atohs.workers.dev/"
    }
  }
}
```

### Claude Code

```
claude mcp add --transport http hpgourmet-mcp https://hpgourmet-mcp.atohs.workers.dev/
```

いずれも認証なしのため、追加のトークン設定は不要です。

## tool仕様

### `search_restaurants`

ホットペッパーグルメで飲食店を検索します。

| パラメータ | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `area` | string | ○ | 検索したいエリア・地名（自由文）。例: `"渋谷"` |
| `genre` | string | △（`keyword`との択一必須） | 料理ジャンル・業態（自由文）。例: `"居酒屋"` |
| `keyword` | string | △（`genre`との択一必須） | 店名・駅名・キャッチコピー等の自由キーワード。半角スペース区切りで複数指定するとAND検索になる |
| `budget` | number | - | 目安予算（1人あたり、円）。例: `3000` |
| `count` | number（1〜10） | - | 取得件数の上限。デフォルト10 |

`area`は必須です。加えて`genre`・`keyword`のうち少なくとも一方の指定が必須です（ジャンルが不明な場合は`keyword`を指定してください）。

レスポンスは以下の構造化データ（JSON）で返ります。自然文への要約はLLM側に委ねる方針のため、サーバー側では文章化しません。

| 返却キー | 内容 |
| --- | --- |
| `resultsAvailable` | ヒット件数 |
| `shops[].name` | 店名 |
| `shops[].genre` | ジャンル |
| `shops[].address` | 住所 |
| `shops[].budget` | 予算帯 |
| `shops[].catch` | 紹介文（お店キャッチ） |
| `shops[].photo` | 店舗写真URL（中サイズ） |
| `shops[].url` | ホットペッパー店舗ページURL |
| `shops[].open` | 営業時間 |
| `shops[].close` | 定休日 |

0件ヒット時もエラーにはならず、`{ "resultsAvailable": 0, "shops": [] }`が返ります。

## 既知の制約

- **ジャンル・エリアが変換できない場合**: マスタデータに一致しないテキストはそのまま検索キーワードとして扱われるため、意図しない範囲の結果が混ざることがあります
- **同一・類似地名が複数エリアにまたがる場合**: エリア名の部分一致で複数候補がヒットした際は候補を全て検索対象に含めるため、例えば「天神」のように福岡・大阪・京都などにまたがる地名では、意図しない地域の結果が混ざる可能性があります（完全一致する地名であれば発生しません）

## 開発

| コマンド | 目的 |
| --- | --- |
| `npx wrangler dev` | ローカル開発 |
| `npx wrangler deploy` | Cloudflareへのデプロイ |
| `npm test` | Vitestによるテスト実行 |

詳細な設計はプロジェクトの設計ドキュメント（design.md）を参照してください。
