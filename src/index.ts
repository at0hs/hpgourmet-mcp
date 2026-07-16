import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { z } from "zod";
import { consoleApp } from "./console/router";

function createServer(): McpServer {
	const server = new McpServer({
		name: "hpgourmet-mcp",
		version: "0.0.0",
	});

	// 疎通確認用のダミーtool。search_restaurantsの実装前にMCP Inspectorからの接続・呼び出しを確認するためのもの。
	server.registerTool(
		"ping",
		{
			title: "Ping",
			description: "疎通確認用。渡した文字列をそのまま返す。",
			inputSchema: { message: z.string().describe("エコーする文字列") },
		},
		async ({ message }) => ({
			content: [{ type: "text", text: `pong: ${message}` }],
		}),
	);

	return server;
}

const app = new Hono<{ Bindings: Env }>();

app.route("/console", consoleApp);

app.all("/", async (c) => {
	// design.mdの方針通り、Durable Objects/McpAgentは使わずリクエストごとにserver/transportを生成するステートレス実装
	const server = createServer();
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	});
	await server.connect(transport);
	return transport.handleRequest(c.req.raw);
});

export default app;
