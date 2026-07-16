import { ENDPOINTS } from "./endpoints";

const RECRUIT_BASE_URL = "https://webservice.recruit.co.jp/hotpepper";

export type ProxyResult =
	| { ok: true; status: number; body: unknown }
	| { ok: false; status: number; error: string };

// HotPepper系APIはパラメータ不正等のエラー時もHTTPステータス200で返すため、
// レスポンスボディ内のresults.errorも見て成否判定する。
export async function callHotpepperApi(
	slug: string,
	query: URLSearchParams,
	apiKey: string,
): Promise<ProxyResult> {
	const endpoint = ENDPOINTS[slug];
	if (!endpoint) {
		return { ok: false, status: 404, error: `unknown endpoint: ${slug}` };
	}

	const allowedParamNames = new Set(endpoint.params.map((p) => p.name));
	const url = new URL(`${RECRUIT_BASE_URL}/${endpoint.path}/v1/`);
	for (const [name, value] of query.entries()) {
		if (allowedParamNames.has(name) && value !== "") {
			url.searchParams.set(name, value);
		}
	}
	// key/formatはユーザー入力で上書きされないようサーバー側で強制する
	url.searchParams.set("key", apiKey);
	url.searchParams.set("format", "json");

	const loggedParams = Object.fromEntries(
		Array.from(url.searchParams.entries()).filter(([name]) => name !== "key"),
	);
	console.log(`[hotpepper_api_console] calling endpoint=${slug} params=${JSON.stringify(loggedParams)}`);

	let response: Response;
	try {
		response = await fetch(url.toString());
	} catch (err) {
		return { ok: false, status: 502, error: `fetch failed: ${(err as Error).message}` };
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		return { ok: false, status: 502, error: "failed to parse response as JSON" };
	}

	const apiError = extractApiError(body);
	if (apiError) {
		console.log(`[hotpepper_api_console] endpoint=${slug} api error: ${apiError}`);
		return { ok: false, status: 200, error: apiError };
	}

	console.log(`[hotpepper_api_console] endpoint=${slug} success`);
	return { ok: true, status: response.status, body };
}

function extractApiError(body: unknown): string | null {
	if (typeof body !== "object" || body === null) return null;
	const results = (body as Record<string, unknown>).results;
	if (typeof results !== "object" || results === null) return null;
	const error = (results as Record<string, unknown>).error;
	if (!Array.isArray(error) || error.length === 0) return null;
	return error
		.map((e) => (typeof e === "object" && e !== null ? JSON.stringify(e) : String(e)))
		.join("; ");
}
