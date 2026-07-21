import { afterEach, describe, expect, it, vi } from 'vitest';
import { HotpepperApiError, HotpepperClient } from './HotpepperClient';

const API_KEY = 'test-api-key-12345';

function mockFetchOnce(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HotpepperClient#searchRestaurants', () => {
  it('正常系: グルメサーチAPIのレスポンスをShop型に整形して返す', async () => {
    mockFetchOnce({
      results: {
        results_available: 1,
        shop: [
          {
            name: '居酒屋テスト',
            genre: { name: '居酒屋' },
            address: '東京都渋谷区テスト1-1-1',
            budget: { name: '2001～3000円' },
            catch: 'テスト用のキャッチコピー',
            photo: { pc: { m: 'https://example.com/photo.jpg' } },
            urls: { pc: 'https://example.com/shop' },
            open: '17:00～23:00',
            close: '日曜日',
            lat: '35.6608183454',
            lng: '139.7754267645',
          },
        ],
      },
    });
    const client = new HotpepperClient(API_KEY);

    const result = await client.searchRestaurants({ keyword: 'テスト' });

    expect(result).toEqual({
      resultsAvailable: 1,
      shops: [
        {
          name: '居酒屋テスト',
          genre: '居酒屋',
          address: '東京都渋谷区テスト1-1-1',
          budget: '2001～3000円',
          catch: 'テスト用のキャッチコピー',
          photo: 'https://example.com/photo.jpg',
          url: 'https://example.com/shop',
          open: '17:00～23:00',
          close: '日曜日',
          lat: 35.6608183454,
          lng: 139.7754267645,
        },
      ],
    });
  });

  it('0件ヒット: results_available: 0の場合はエラーにせずshops: []を返す', async () => {
    mockFetchOnce({ results: { results_available: 0, shop: [] } });
    const client = new HotpepperClient(API_KEY);

    const result = await client.searchRestaurants({ keyword: '存在しない店' });

    expect(result).toEqual({ resultsAvailable: 0, shops: [] });
  });

  it('APIエラーレスポンス（HTTP 200・results.errorあり）はHotpepperApiErrorを投げる', async () => {
    mockFetchOnce({ results: { error: [{ code: 1000, message: 'パラメータ不正' }] } });
    const client = new HotpepperClient(API_KEY);

    await expect(client.searchRestaurants({ keyword: 'テスト' })).rejects.toThrow(HotpepperApiError);
  });

  it('レスポンス形式が不正（zodスキーマ不一致）な場合はHotpepperApiErrorを投げる', async () => {
    mockFetchOnce({ results: { results_available: 'not-a-number', shop: [] } });
    const client = new HotpepperClient(API_KEY);

    await expect(client.searchRestaurants({ keyword: 'テスト' })).rejects.toThrow(HotpepperApiError);
  });

  it('fetch自体が失敗した場合はHotpepperApiErrorを投げ、メッセージ中のAPIキーはマスキングされる', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(`network error: https://example.com/?key=${API_KEY}`)));
    const client = new HotpepperClient(API_KEY);

    const error = await client.searchRestaurants({ keyword: 'テスト' }).catch((e) => e);

    expect(error).toBeInstanceOf(HotpepperApiError);
    expect((error as Error).message).not.toContain(API_KEY);
    expect((error as Error).message).toContain('***');
  });

  it('レスポンスがJSONとしてパースできない場合はHotpepperApiErrorを投げる', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })));
    const client = new HotpepperClient(API_KEY);

    await expect(client.searchRestaurants({ keyword: 'テスト' })).rejects.toThrow(HotpepperApiError);
  });
});

describe('HotpepperClient#searchLargeAreas', () => {
  it('正常系: 大エリアマスタAPIのレスポンスをLargeAreaMaster型に整形して返す', async () => {
    mockFetchOnce({ results: { large_area: [{ code: 'Z011', name: '東京' }] } });
    const client = new HotpepperClient(API_KEY);

    const result = await client.searchLargeAreas('東京');

    expect(result).toEqual([{ code: 'Z011', name: '東京' }]);
  });
});

describe('HotpepperClient#searchMiddleAreas', () => {
  it('正常系: 中エリアマスタAPIのレスポンスを大エリア階層情報付きで整形して返す', async () => {
    mockFetchOnce({
      results: {
        middle_area: [{ code: 'Y005', name: '渋谷', large_area: { code: 'Z011', name: '東京' } }],
      },
    });
    const client = new HotpepperClient(API_KEY);

    const result = await client.searchMiddleAreas('渋谷');

    expect(result).toEqual([{ code: 'Y005', name: '渋谷', largeArea: { code: 'Z011', name: '東京' } }]);
  });
});

describe('HotpepperClient#searchSmallAreas', () => {
  it('正常系: 小エリアマスタAPIのレスポンスを中/大エリア階層情報付きで整形して返す', async () => {
    mockFetchOnce({
      results: {
        small_area: [
          {
            code: 'X010',
            name: '渋谷',
            middle_area: { code: 'Y005', name: '渋谷' },
            large_area: { code: 'Z011', name: '東京' },
          },
        ],
      },
    });
    const client = new HotpepperClient(API_KEY);

    const result = await client.searchSmallAreas('渋谷');

    expect(result).toEqual([
      {
        code: 'X010',
        name: '渋谷',
        middleArea: { code: 'Y005', name: '渋谷' },
        largeArea: { code: 'Z011', name: '東京' },
      },
    ]);
  });
});

describe('HotpepperClient#call', () => {
  it('正常系: 生のレスポンス（status・body）を整形せずそのまま返す', async () => {
    const body = { results: { some: 'raw-response' } };
    mockFetchOnce(body, 200);
    const client = new HotpepperClient(API_KEY);

    const result = await client.call('genre', {}, 'test');

    expect(result).toEqual({ status: 200, body });
  });

  it('key/formatパラメータをURLに自動付与する', async () => {
    const fetchMock = mockFetchOnce({ results: {} });
    const client = new HotpepperClient(API_KEY);

    await client.call('genre', {}, 'test');

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get('key')).toBe(API_KEY);
    expect(calledUrl.searchParams.get('format')).toBe('json');
  });

  it('呼び出し元paramsにkey/formatが含まれていても内部の値で上書きする', async () => {
    const fetchMock = mockFetchOnce({ results: {} });
    const client = new HotpepperClient(API_KEY);

    await client.call('genre', { key: 'malicious-key', format: 'xml' }, 'test');

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get('key')).toBe(API_KEY);
    expect(calledUrl.searchParams.get('format')).toBe('json');
  });

  it('空文字のパラメータはURLから除外する', async () => {
    const fetchMock = mockFetchOnce({ results: {} });
    const client = new HotpepperClient(API_KEY);

    await client.call('gourmet', { keyword: '', large_area: 'Z011' }, 'test');

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.has('keyword')).toBe(false);
    expect(calledUrl.searchParams.get('large_area')).toBe('Z011');
  });

  it('slugがURLパスに反映される', async () => {
    const fetchMock = mockFetchOnce({ results: {} });
    const client = new HotpepperClient(API_KEY);

    await client.call('small_area', {}, 'test');

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe('/hotpepper/small_area/v1/');
  });

  it('APIエラーレスポンス（results.errorあり）はHotpepperApiErrorを投げる', async () => {
    mockFetchOnce({ results: { error: [{ code: 1000, message: 'パラメータ不正' }] } });
    const client = new HotpepperClient(API_KEY);

    await expect(client.call('gourmet', {}, 'test')).rejects.toThrow(HotpepperApiError);
  });
});
