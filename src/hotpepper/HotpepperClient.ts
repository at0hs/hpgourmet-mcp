// ホットペッパー Web Service (Recruit) を呼び出す唯一の窓口。
// - call(): 任意のエンドポイントを生のレスポンスのまま返す（APIコンソールの動作確認用途）
// - searchXxx(): MCPサーバー内部ロジック用の型付きメソッド（レスポンスをzodで検証し整形して返す）
import { z } from 'zod';
import { type HotpepperEndpointSlug } from './endpoints';

const RECRUIT_BASE_URL = 'https://webservice.recruit.co.jp/hotpepper';

export type HotpepperResponse = { status: number; body: unknown };

export class HotpepperApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HotpepperApiError';
    this.status = status;
  }
}

export type AreaRef = { code: string; name: string };
export type LargeAreaMaster = AreaRef;
export type MiddleAreaMaster = AreaRef & { largeArea: AreaRef };
export type SmallAreaMaster = AreaRef & { middleArea: AreaRef; largeArea: AreaRef };

export type GourmetSearchParams = {
  largeArea?: string[];
  middleArea?: string[];
  smallArea?: string[];
  genre?: string[];
  budget?: string;
  keyword?: string;
  count?: number;
};

export type Shop = {
  name: string;
  genre: string;
  address: string;
  budget: string;
  catch: string;
  photo: string;
  url: string;
  open: string;
  close: string;
};

export type GourmetSearchResult = {
  resultsAvailable: number;
  shops: Shop[];
};

const areaRefSchema = z.object({ code: z.string(), name: z.string() });

const largeAreaResponseSchema = z.object({
  results: z.object({
    large_area: z.array(areaRefSchema).optional().default([]),
  }),
});

const middleAreaResponseSchema = z.object({
  results: z.object({
    middle_area: z
      .array(areaRefSchema.extend({ large_area: areaRefSchema }))
      .optional()
      .default([]),
  }),
});

const smallAreaResponseSchema = z.object({
  results: z.object({
    small_area: z
      .array(areaRefSchema.extend({ middle_area: areaRefSchema, large_area: areaRefSchema }))
      .optional()
      .default([]),
  }),
});

const gourmetShopSchema = z.object({
  name: z.string(),
  genre: z.object({ name: z.string() }),
  address: z.string(),
  budget: z.object({ name: z.string() }),
  catch: z.string(),
  photo: z.object({ pc: z.object({ m: z.string() }) }),
  urls: z.object({ pc: z.string() }),
  open: z.string(),
  close: z.string(),
});

const gourmetResponseSchema = z.object({
  results: z.object({
    results_available: z.number(),
    shop: z.array(gourmetShopSchema).optional().default([]),
  }),
});

export class HotpepperClient {
  constructor(private readonly apiKey: string) {}

  /** 任意のエンドポイントをkey/format付与のみ行った生のレスポンスのまま呼び出す。APIコンソールの動作確認用途。 */
  async call(slug: HotpepperEndpointSlug, params: Record<string, string>, logTag: string): Promise<HotpepperResponse> {
    return this.fetchJson(slug, params, logTag);
  }

  /** 大エリア名のテキストからマスタAPIを検索する（部分一致）。 */
  async searchLargeAreas(keyword: string): Promise<LargeAreaMaster[]> {
    const { body } = await this.fetchJson('large_area', { keyword }, 'hotpepper_client');
    const parsed = parseOrThrow(largeAreaResponseSchema, body, 'large_area');
    return parsed.results.large_area.map((a) => ({ code: a.code, name: a.name }));
  }

  /** 中エリア名のテキストからマスタAPIを検索する（部分一致）。階層情報として大エリアを含む。 */
  async searchMiddleAreas(keyword: string): Promise<MiddleAreaMaster[]> {
    const { body } = await this.fetchJson('middle_area', { keyword }, 'hotpepper_client');
    const parsed = parseOrThrow(middleAreaResponseSchema, body, 'middle_area');
    return parsed.results.middle_area.map((a) => ({
      code: a.code,
      name: a.name,
      largeArea: { code: a.large_area.code, name: a.large_area.name },
    }));
  }

  /** 小エリア名のテキストからマスタAPIを検索する（部分一致）。階層情報として中エリア・大エリアを含む。 */
  async searchSmallAreas(keyword: string): Promise<SmallAreaMaster[]> {
    const { body } = await this.fetchJson('small_area', { keyword }, 'hotpepper_client');
    const parsed = parseOrThrow(smallAreaResponseSchema, body, 'small_area');
    return parsed.results.small_area.map((a) => ({
      code: a.code,
      name: a.name,
      middleArea: { code: a.middle_area.code, name: a.middle_area.name },
      largeArea: { code: a.large_area.code, name: a.large_area.name },
    }));
  }

  /** グルメサーチAPIを呼び出す。パラメータはコード変換済みのものを渡すこと（テキスト→コード変換は呼び出し元の責務）。 */
  async searchRestaurants(params: GourmetSearchParams): Promise<GourmetSearchResult> {
    const apiParams: Record<string, string> = {
      large_area: params.largeArea?.join(',') ?? '',
      middle_area: params.middleArea?.join(',') ?? '',
      small_area: params.smallArea?.join(',') ?? '',
      genre: params.genre?.join(',') ?? '',
      budget: params.budget ?? '',
      keyword: params.keyword ?? '',
      count: params.count !== undefined ? String(params.count) : '',
    };
    const { body } = await this.fetchJson('gourmet', apiParams, 'hotpepper_client');
    const parsed = parseOrThrow(gourmetResponseSchema, body, 'gourmet');
    return {
      resultsAvailable: parsed.results.results_available,
      shops: parsed.results.shop.map((s) => ({
        name: s.name,
        genre: s.genre.name,
        address: s.address,
        budget: s.budget.name,
        catch: s.catch,
        photo: s.photo.pc.m,
        url: s.urls.pc,
        open: s.open,
        close: s.close,
      })),
    };
  }

  private async fetchJson(slug: HotpepperEndpointSlug, params: Record<string, string>, logTag: string): Promise<HotpepperResponse> {
    const url = new URL(`${RECRUIT_BASE_URL}/${slug}/v1/`);
    for (const [name, value] of Object.entries(params)) {
      if (value !== '') {
        url.searchParams.set(name, value);
      }
    }
    // key/formatは呼び出し元のparamsで上書きされないようここで強制する
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('format', 'json');

    console.log(`[${logTag}] calling slug=${slug} params=${JSON.stringify(params)}`);

    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch (err) {
      throw new HotpepperApiError(`fetch failed: ${(err as Error).message}`, 502);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new HotpepperApiError('failed to parse response as JSON', 502);
    }

    // HotPepper系APIはパラメータ不正等のエラー時もHTTPステータス200で返すため、
    // レスポンスボディ内のresults.errorも見て成否判定する。
    const apiError = extractApiError(body);
    if (apiError) {
      console.log(`[${logTag}] slug=${slug} api error: ${apiError}`);
      throw new HotpepperApiError(apiError, 200);
    }

    console.log(`[${logTag}] slug=${slug} success`);
    return { status: response.status, body };
  }
}

function extractApiError(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const results = (body as Record<string, unknown>).results;
  if (typeof results !== 'object' || results === null) return null;
  const error = (results as Record<string, unknown>).error;
  if (!Array.isArray(error) || error.length === 0) return null;
  return error.map((e) => (typeof e === 'object' && e !== null ? JSON.stringify(e) : String(e))).join('; ');
}

function parseOrThrow<T>(schema: z.ZodType<T>, body: unknown, path: string): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HotpepperApiError(`${path}マスタAPIのレスポンス形式が不正です: ${result.error.message}`, 502);
  }
  return result.data;
}
