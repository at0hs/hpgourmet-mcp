import type { HotpepperClient, LargeAreaMaster, MiddleAreaMaster, SmallAreaMaster } from '../hotpepper/HotpepperClient';
import { BUDGETS, type Budget } from './budgets';
import { GENRES, type Genre } from './genres';

/**
 * ジャンル名のテキストから完全一致優先でジャンルを検索する。
 * 完全一致するレコードがあればそれのみを返し、なければ部分一致（複数件許容）にフォールバックする。
 * 「居酒屋」→G001だけでなく、「バー」のような曖昧なテキストで複数件ヒットすることもある。
 */
export function findGenresByText(text: string): Genre[] {
  const partial = GENRES.filter((genre) => genre.name.includes(text));
  const exact = partial.filter((genre) => genre.name === text);
  return exact.length > 0 ? exact : partial;
}

/**
 * 大エリア名のテキストから完全一致優先で大エリアマスタAPIを検索する。
 * マスタAPIのkeyword検索自体は部分一致のみのため、完全一致優先は取得した候補集合に対する後処理として行う。
 */
export async function findLargeAreasByText(client: HotpepperClient, text: string): Promise<LargeAreaMaster[]> {
  const candidates = await client.searchLargeAreas(text);
  const exact = candidates.filter((area) => area.name === text);
  return exact.length > 0 ? exact : candidates;
}

/**
 * 中エリア名のテキストから完全一致優先で中エリアマスタAPIを検索する。
 */
export async function findMiddleAreasByText(client: HotpepperClient, text: string): Promise<MiddleAreaMaster[]> {
  const candidates = await client.searchMiddleAreas(text);
  const exact = candidates.filter((area) => area.name === text);
  return exact.length > 0 ? exact : candidates;
}

/**
 * 小エリア名のテキストから完全一致優先で小エリアマスタAPIを検索する。
 */
export async function findSmallAreasByText(client: HotpepperClient, text: string): Promise<SmallAreaMaster[]> {
  const candidates = await client.searchSmallAreas(text);
  const exact = candidates.filter((area) => area.name === text);
  return exact.length > 0 ? exact : candidates;
}

/**
 * 目安金額（円）から、その金額が属する予算帯を検索する。
 * マスタの範囲外（500円未満）の場合は最も近い端（最安の予算帯）にクランプする。
 * 上限（30001円～）は範囲が無制限のため、金額がどれだけ大きくてもクランプは発生しない。
 */
export function findBudgetByAmount(yen: number): Budget {
  const matched = BUDGETS.find((budget) => yen >= budget.min && (budget.max === null || yen <= budget.max));
  if (matched) {
    return matched;
  }
  return BUDGETS.reduce((cheapest, budget) => (budget.min < cheapest.min ? budget : cheapest));
}
