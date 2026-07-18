import { isHotpepperEndpointSlug } from '../hotpepper/endpoints';
import { HotpepperApiError, type HotpepperClient } from '../hotpepper/HotpepperClient';
import { ENDPOINTS } from './endpoints';

export type ProxyResult = { ok: true; status: number; body: unknown } | { ok: false; status: number; error: string };

// APIコンソール用の薄いラッパー。ENDPOINTS（フォームUI定義）に基づき
// クエリパラメータをホワイトリスト適用してから、HotpepperClientの汎用call()を呼び出す。
export async function callHotpepperApiForConsole(client: HotpepperClient, slug: string, query: URLSearchParams): Promise<ProxyResult> {
  if (!isHotpepperEndpointSlug(slug)) {
    return { ok: false, status: 404, error: `unknown endpoint: ${slug}` };
  }

  const allowedParamNames = new Set(ENDPOINTS[slug].params.map((p) => p.name));
  const params: Record<string, string> = {};
  for (const [name, value] of query.entries()) {
    if (allowedParamNames.has(name)) {
      params[name] = value;
    }
  }

  try {
    const { status, body } = await client.call(slug, params, 'hotpepper_api_console');
    return { ok: true, status, body };
  } catch (err) {
    if (err instanceof HotpepperApiError) {
      return { ok: false, status: err.status, error: err.message };
    }
    throw err;
  }
}
