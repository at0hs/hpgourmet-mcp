import { describe, expect, it, vi } from 'vitest';
import type { HotpepperClient, LargeAreaMaster, MiddleAreaMaster, SmallAreaMaster } from '../hotpepper/HotpepperClient';
import { findBudgetByAmount, findGenresByText, findLargeAreasByText, findMiddleAreasByText, findSmallAreasByText } from './converter';

describe('findGenresByText', () => {
  it('完全一致するレコードがある場合はそれのみを返す', () => {
    expect(findGenresByText('居酒屋')).toEqual([{ code: 'G001', name: '居酒屋' }]);
  });

  it('完全一致がない場合は部分一致するレコードを複数返す', () => {
    const result = findGenresByText('バー');
    expect(result.map((g) => g.code).sort()).toEqual(['G002', 'G012'].sort());
  });

  it('一致するレコードがない場合は空配列を返す', () => {
    expect(findGenresByText('存在しないジャンル')).toEqual([]);
  });
});

describe('findBudgetByAmount', () => {
  it('予算帯の範囲内の金額はその予算帯を返す', () => {
    expect(findBudgetByAmount(3000).code).toBe('B002');
  });

  it('予算帯の下限境界値はその予算帯を返す', () => {
    expect(findBudgetByAmount(2001).code).toBe('B002');
  });

  it('上限なしの予算帯（30001円～）はどれだけ大きい金額でもマッチする', () => {
    expect(findBudgetByAmount(100000).code).toBe('B014');
  });

  it('マスタの下限（0円）未満の金額は最安の予算帯にクランプする', () => {
    expect(findBudgetByAmount(-100).code).toBe('B009');
  });
});

describe('findLargeAreasByText', () => {
  it('完全一致するレコードがある場合はそれのみを返す', async () => {
    const candidates: LargeAreaMaster[] = [
      { code: 'Z011', name: '渋谷' },
      { code: 'Z099', name: '渋谷区' },
    ];
    const client = { searchLargeAreas: vi.fn().mockResolvedValue(candidates) } as unknown as HotpepperClient;

    const result = await findLargeAreasByText(client, '渋谷');

    expect(result).toEqual([{ code: 'Z011', name: '渋谷' }]);
  });

  it('完全一致するレコードがない場合は候補を全件返す', async () => {
    const candidates: LargeAreaMaster[] = [
      { code: 'Z011', name: '渋谷駅前' },
      { code: 'Z099', name: '渋谷区' },
    ];
    const client = { searchLargeAreas: vi.fn().mockResolvedValue(candidates) } as unknown as HotpepperClient;

    const result = await findLargeAreasByText(client, '渋谷');

    expect(result).toEqual(candidates);
  });
});

describe('findMiddleAreasByText', () => {
  it('完全一致するレコードがある場合はそれのみを返す', async () => {
    const largeArea = { code: 'Z011', name: '福岡' };
    const candidates: MiddleAreaMaster[] = [
      { code: 'Y005', name: '天神', largeArea },
      { code: 'Y099', name: '天神駅前', largeArea },
    ];
    const client = { searchMiddleAreas: vi.fn().mockResolvedValue(candidates) } as unknown as HotpepperClient;

    const result = await findMiddleAreasByText(client, '天神');

    expect(result).toEqual([{ code: 'Y005', name: '天神', largeArea }]);
  });

  it('完全一致するレコードがない場合は候補を全件返す', async () => {
    const largeArea = { code: 'Z011', name: '福岡' };
    const candidates: MiddleAreaMaster[] = [
      { code: 'Y005', name: '天神駅前', largeArea },
      { code: 'Y006', name: '天神南', largeArea },
    ];
    const client = { searchMiddleAreas: vi.fn().mockResolvedValue(candidates) } as unknown as HotpepperClient;

    const result = await findMiddleAreasByText(client, '天神');

    expect(result).toEqual(candidates);
  });
});

describe('findSmallAreasByText', () => {
  it('完全一致するレコードがある場合はそれのみを返す', async () => {
    const largeArea = { code: 'Z011', name: '福岡' };
    const middleArea = { code: 'Y005', name: '天神', largeArea };
    const candidates: SmallAreaMaster[] = [
      { code: 'X010', name: '天神', middleArea, largeArea },
      { code: 'X099', name: '天神駅前', middleArea, largeArea },
    ];
    const client = { searchSmallAreas: vi.fn().mockResolvedValue(candidates) } as unknown as HotpepperClient;

    const result = await findSmallAreasByText(client, '天神');

    expect(result).toEqual([{ code: 'X010', name: '天神', middleArea, largeArea }]);
  });

  it('完全一致するレコードがない場合は候補を全件返す', async () => {
    const largeArea = { code: 'Z011', name: '福岡' };
    const middleArea = { code: 'Y005', name: '天神', largeArea };
    const candidates: SmallAreaMaster[] = [
      { code: 'X010', name: '天神駅前', middleArea, largeArea },
      { code: 'X011', name: '天神南', middleArea, largeArea },
    ];
    const client = { searchSmallAreas: vi.fn().mockResolvedValue(candidates) } as unknown as HotpepperClient;

    const result = await findSmallAreasByText(client, '天神');

    expect(result).toEqual(candidates);
  });
});
