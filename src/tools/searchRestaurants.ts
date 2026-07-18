import { z } from 'zod';
import type { GourmetSearchParams, HotpepperClient } from '../hotpepper/HotpepperClient';
import { findBudgetByAmount, findGenresByText, findLargeAreasByText, findMiddleAreasByText, findSmallAreasByText } from '../master/converter';

export const searchRestaurantsInputSchema = z
  .object({
    area: z.string().describe('検索したいエリア・地名（自由文）。例: "渋谷"。必須パラメータ。'),
    genre: z
      .string()
      .optional()
      .describe('料理ジャンル・業態（自由文）。例: "居酒屋"。genreまたはkeywordの少なくとも一方の指定が必須。ジャンルが不明な場合はkeywordを指定すること。'),
    keyword: z
      .string()
      .optional()
      .describe('店名・駅名・キャッチコピー等の自由キーワード。genreまたはkeywordの少なくとも一方の指定が必須。半角スペース区切りで複数指定するとAND検索になる。'),
    budget: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('目安予算（1人あたり、円）。例: 3000。指定した金額が属する価格帯で絞り込む（ぴったりの金額の店に限らず、近い価格帯の店も対象になる）。'),
    count: z.number().int().min(1).max(10).optional().describe('取得件数の上限（1〜10、デフォルト10）'),
  })
  .refine((v) => !!v.genre || !!v.keyword, {
    message: 'genreまたはkeywordの少なくとも一方を指定してください',
  });

export type SearchRestaurantsInput = z.infer<typeof searchRestaurantsInputSchema>;

/**
 * inputSchemaで受け取った自由文パラメータを、マスタコード変換を通してグルメサーチAPI呼び出し用のパラメータに組み立てる。
 * area/genreが変換できなかった場合はテキストをkeywordへフォールバックする。
 */
export async function buildGourmetSearchParams(client: HotpepperClient, input: SearchRestaurantsInput): Promise<GourmetSearchParams> {
  const keywordParts: string[] = [];
  if (input.keyword) keywordParts.push(input.keyword);

  let genreCodes: string[] | undefined;
  if (input.genre) {
    const genres = findGenresByText(input.genre);
    if (genres.length > 0) {
      genreCodes = genres.map((g) => g.code);
    } else {
      keywordParts.push(input.genre);
    }
  }

  let largeArea: string[] | undefined;
  let middleArea: string[] | undefined;
  let smallArea: string[] | undefined;
  const smallAreas = await findSmallAreasByText(client, input.area);
  if (smallAreas.length > 0) {
    smallArea = smallAreas.map((a) => a.code);
  } else {
    const middleAreas = await findMiddleAreasByText(client, input.area);
    if (middleAreas.length > 0) {
      middleArea = middleAreas.map((a) => a.code);
    } else {
      const largeAreas = await findLargeAreasByText(client, input.area);
      if (largeAreas.length > 0) {
        largeArea = largeAreas.map((a) => a.code);
      } else {
        keywordParts.push(input.area);
      }
    }
  }

  const budget = input.budget !== undefined ? findBudgetByAmount(input.budget).code : undefined;

  return {
    largeArea,
    middleArea,
    smallArea,
    genre: genreCodes,
    budget,
    keyword: keywordParts.length > 0 ? keywordParts.join(' ') : undefined,
    count: input.count,
  };
}
