import { Hono } from "hono";
import { ENDPOINTS } from "./endpoints";
import { callHotpepperApi } from "./proxy";

export const consoleApp = new Hono<{ Bindings: Env }>();

// ENVIRONMENTが"development"の場合のみ有効。本番では存在を隠すため404を返す。
// wrangler.jsoncのassets.run_worker_firstで/console配下は必ずこのミドルウェアを経由する。
consoleApp.use("*", async (c, next) => {
	if (c.env.ENVIRONMENT !== "development") {
		return c.notFound();
	}
	await next();
});

consoleApp.get("/api/_endpoints", (c) => c.json(ENDPOINTS));

consoleApp.get("/api/:endpoint", async (c) => {
	const slug = c.req.param("endpoint");
	const query = new URL(c.req.url).searchParams;
	const result = await callHotpepperApi(slug, query, c.env.HOTPEPPER_API_KEY);
	return c.json(result, result.status as import("hono/utils/http-status").ContentfulStatusCode);
});

// ガード通過後にpublic/console/配下の静的ファイルを配信する
consoleApp.get("/", (c) => {
	const url = new URL(c.req.url);
	url.pathname = "/console/index.html";
	return c.env.ASSETS.fetch(url.toString());
});

consoleApp.get("/app.js", (c) => c.env.ASSETS.fetch(c.req.raw));
consoleApp.get("/app.css", (c) => c.env.ASSETS.fetch(c.req.raw));
