import { describe, expect, it, vi } from 'vitest';
import type { HotpepperClient } from '../hotpepper/HotpepperClient';
import { buildGourmetSearchParams, searchRestaurantsInputSchema } from './searchRestaurants';

describe('searchRestaurantsInputSchema', () => {
  it('area・genreを指定した最小構成は成功する', () => {
    const result = searchRestaurantsInputSchema.safeParse({ area: '渋谷', genre: '居酒屋' });
    expect(result.success).toBe(true);
  });

  it('areaが未指定の場合は失敗する', () => {
    const result = searchRestaurantsInputSchema.safeParse({ genre: '居酒屋' });
    expect(result.success).toBe(false);
  });

  it('genre・keywordがどちらも未指定の場合は失敗する', () => {
    const result = searchRestaurantsInputSchema.safeParse({ area: '渋谷' });
    expect(result.success).toBe(false);
  });

  it('keywordのみ指定した場合は成功する', () => {
    const result = searchRestaurantsInputSchema.safeParse({ area: '渋谷', keyword: '個室' });
    expect(result.success).toBe(true);
  });

  it('budgetが正の整数の場合は成功する', () => {
    const result = searchRestaurantsInputSchema.safeParse({ area: '渋谷', genre: '居酒屋', budget: 3000 });
    expect(result.success).toBe(true);
  });

  it('budgetが0以下の場合は失敗する', () => {
    const result = searchRestaurantsInputSchema.safeParse({ area: '渋谷', genre: '居酒屋', budget: 0 });
    expect(result.success).toBe(false);
  });

  it('budgetが小数の場合は失敗する', () => {
    const result = searchRestaurantsInputSchema.safeParse({ area: '渋谷', genre: '居酒屋', budget: 3000.5 });
    expect(result.success).toBe(false);
  });

  it('countが1〜10の範囲内の場合は成功する', () => {
    const result = searchRestaurantsInputSchema.safeParse({ area: '渋谷', genre: '居酒屋', count: 5 });
    expect(result.success).toBe(true);
  });

  it('countが範囲外（0・11）の場合は失敗する', () => {
    expect(searchRestaurantsInputSchema.safeParse({ area: '渋谷', genre: '居酒屋', count: 0 }).success).toBe(false);
    expect(searchRestaurantsInputSchema.safeParse({ area: '渋谷', genre: '居酒屋', count: 11 }).success).toBe(false);
  });
});

function createClientMock(overrides: { smallAreas?: unknown[]; middleAreas?: unknown[]; largeAreas?: unknown[] }): HotpepperClient {
  return {
    searchSmallAreas: vi.fn().mockResolvedValue(overrides.smallAreas ?? []),
    searchMiddleAreas: vi.fn().mockResolvedValue(overrides.middleAreas ?? []),
    searchLargeAreas: vi.fn().mockResolvedValue(overrides.largeAreas ?? []),
  } as unknown as HotpepperClient;
}

describe('buildGourmetSearchParams', () => {
  it('小エリアでヒットした場合はsmallAreaのみセットし、中/大エリアは問い合わせない', async () => {
    const client = createClientMock({ smallAreas: [{ code: 'X010', name: '渋谷' }] });

    const params = await buildGourmetSearchParams(client, { area: '渋谷', genre: '居酒屋' });

    expect(params.smallArea).toEqual(['X010']);
    expect(params.middleArea).toBeUndefined();
    expect(params.largeArea).toBeUndefined();
    expect(client.searchMiddleAreas).not.toHaveBeenCalled();
    expect(client.searchLargeAreas).not.toHaveBeenCalled();
  });

  it('小エリアでヒットせず中エリアでヒットした場合はmiddleAreaをセットする', async () => {
    const client = createClientMock({ middleAreas: [{ code: 'Y005', name: '渋谷' }] });

    const params = await buildGourmetSearchParams(client, { area: '渋谷', genre: '居酒屋' });

    expect(params.smallArea).toBeUndefined();
    expect(params.middleArea).toEqual(['Y005']);
    expect(params.largeArea).toBeUndefined();
    expect(client.searchLargeAreas).not.toHaveBeenCalled();
  });

  it('小/中エリアでヒットせず大エリアでヒットした場合はlargeAreaをセットする', async () => {
    const client = createClientMock({ largeAreas: [{ code: 'Z011', name: '東京' }] });

    const params = await buildGourmetSearchParams(client, { area: '東京', genre: '居酒屋' });

    expect(params.smallArea).toBeUndefined();
    expect(params.middleArea).toBeUndefined();
    expect(params.largeArea).toEqual(['Z011']);
  });

  it('どの階層でもヒットしない場合はareaのテキストをkeywordにフォールバックする', async () => {
    const client = createClientMock({});

    const params = await buildGourmetSearchParams(client, { area: '存在しないエリア', genre: '居酒屋' });

    expect(params.smallArea).toBeUndefined();
    expect(params.middleArea).toBeUndefined();
    expect(params.largeArea).toBeUndefined();
    expect(params.keyword).toBe('存在しないエリア');
  });

  it('genreがマスタに存在する場合はgenreコードをセットする', async () => {
    const client = createClientMock({ smallAreas: [{ code: 'X010', name: '渋谷' }] });

    const params = await buildGourmetSearchParams(client, { area: '渋谷', genre: '居酒屋' });

    expect(params.genre).toEqual(['G001']);
    expect(params.keyword).toBeUndefined();
  });

  it('genreがマスタに存在しない場合はgenreのテキストをkeywordにフォールバックする', async () => {
    const client = createClientMock({ smallAreas: [{ code: 'X010', name: '渋谷' }] });

    const params = await buildGourmetSearchParams(client, { area: '渋谷', genre: '存在しないジャンル' });

    expect(params.genre).toBeUndefined();
    expect(params.keyword).toBe('存在しないジャンル');
  });

  it('genre未指定の場合はgenreパラメータもundefinedになる', async () => {
    const client = createClientMock({ smallAreas: [{ code: 'X010', name: '渋谷' }] });

    const params = await buildGourmetSearchParams(client, { area: '渋谷', keyword: '個室' });

    expect(params.genre).toBeUndefined();
  });

  it('budgetを指定した場合は該当する予算帯コードに変換される', async () => {
    const client = createClientMock({ smallAreas: [{ code: 'X010', name: '渋谷' }] });

    const params = await buildGourmetSearchParams(client, { area: '渋谷', genre: '居酒屋', budget: 3000 });

    expect(params.budget).toBe('B002');
  });

  it('budget未指定の場合はbudgetパラメータもundefinedになる', async () => {
    const client = createClientMock({ smallAreas: [{ code: 'X010', name: '渋谷' }] });

    const params = await buildGourmetSearchParams(client, { area: '渋谷', genre: '居酒屋' });

    expect(params.budget).toBeUndefined();
  });

  it('keyword指定・genre変換失敗・area変換失敗が全て発生した場合は半角スペース区切りでAND結合される', async () => {
    const client = createClientMock({});

    const params = await buildGourmetSearchParams(client, {
      area: '存在しないエリア',
      genre: '存在しないジャンル',
      keyword: '個室',
    });

    expect(params.keyword).toBe('個室 存在しないジャンル 存在しないエリア');
  });

  it('countはそのままcountパラメータに渡される', async () => {
    const client = createClientMock({ smallAreas: [{ code: 'X010', name: '渋谷' }] });

    const params = await buildGourmetSearchParams(client, { area: '渋谷', genre: '居酒屋', count: 5 });

    expect(params.count).toBe(5);
  });
});
