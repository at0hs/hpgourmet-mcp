// dist/mcp-app.html（viteのsingle-fileビルド成果物）を読み込み、
// ../shopMapHtml.generated.ts にテンプレートリテラルとして書き出す。
// 使い方: cd src/mcpApps/shopMapView && INPUT=./mcp-app.html npx vite build && node scripts_gen_shop_map_html.cjs
const fs = require("node:fs");
const path = require("node:path");

const distHtmlPath = path.join(__dirname, "dist", "mcp-app.html");
const outPath = path.join(__dirname, "..", "shopMapHtml.generated.ts");

const html = fs.readFileSync(distHtmlPath, "utf8");
const escaped = html.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const output = `// このファイルはビルド生成物です。手動で編集しないでください。
// 生成コマンド: cd src/mcpApps/shopMapView && INPUT=./mcp-app.html npx vite build
//   その後 node scripts_gen_shop_map_html.cjs を実行する
export const SHOP_MAP_HTML = \`${escaped}\`;
`;

fs.writeFileSync(outPath, output);
console.log(`Wrote ${outPath}`);
