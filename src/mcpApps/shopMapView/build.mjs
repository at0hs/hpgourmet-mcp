// mcp-app.tsをesbuildで単一ファイルにバンドルし、mcp-app.htmlに埋め込んだ上で
// ../shopMapHtml.generated.ts にテンプレートリテラルとして書き出す。
// 使い方: node src/mcpApps/shopMapView/build.mjs
import esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const entry = path.join(__dirname, "src", "mcp-app.ts");
const htmlTemplatePath = path.join(__dirname, "mcp-app.html");
const outPath = path.join(__dirname, "..", "shopMapHtml.generated.ts");

const result = esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  charset: "utf8",
  write: false,
});

const bundledJs = result.outputFiles[0].text;

const template = readFileSync(htmlTemplatePath, "utf8");
const scriptTagPattern = /<script type="module" src="\/src\/mcp-app\.ts"><\/script>/;
if (!scriptTagPattern.test(template)) {
  throw new Error(`mcp-app.html内にエントリスクリプトタグが見つかりません: ${htmlTemplatePath}`);
}
// 第2引数を文字列にすると$&等の特殊置換パターンがbundledJs内の文字列と衝突するため、関数形式で置換する。
const html = template.replace(scriptTagPattern, () => `<script>${bundledJs}</script>`);

const escaped = html.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const output = `// このファイルはビルド生成物です。手動で編集しないでください。
// 生成コマンド: node src/mcpApps/shopMapView/build.mjs
export const SHOP_MAP_HTML = \`${escaped}\`;
`;

writeFileSync(outPath, output);
console.log(`Wrote ${outPath}`);
