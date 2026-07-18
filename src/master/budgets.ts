/**
 * ホットペッパーグルメサーチAPI 検索用ディナー予算マスタ
 * @see https://webservice.recruit.co.jp/doc/hotpepper/reference.html
 */
export interface Budget {
  code: string;
  name: string;
  /** 予算帯の下限（円）。含む。 */
  min: number;
  /** 予算帯の上限（円）。含む。上限なしの場合は`null`。 */
  max: number | null;
}

export const BUDGETS: readonly Budget[] = [
  { code: 'B009', name: '～500円', min: 0, max: 500 },
  { code: 'B010', name: '501～1000円', min: 501, max: 1000 },
  { code: 'B011', name: '1001～1500円', min: 1001, max: 1500 },
  { code: 'B001', name: '1501～2000円', min: 1501, max: 2000 },
  { code: 'B002', name: '2001～3000円', min: 2001, max: 3000 },
  { code: 'B003', name: '3001～4000円', min: 3001, max: 4000 },
  { code: 'B008', name: '4001～5000円', min: 4001, max: 5000 },
  { code: 'B015', name: '5001～6000円', min: 5001, max: 6000 },
  { code: 'B016', name: '6001～7000円', min: 6001, max: 7000 },
  { code: 'B017', name: '7001～8000円', min: 7001, max: 8000 },
  { code: 'B018', name: '8001～9000円', min: 8001, max: 9000 },
  { code: 'B019', name: '9001～10000円', min: 9001, max: 10000 },
  { code: 'B020', name: '10001～12000円', min: 10001, max: 12000 },
  { code: 'B021', name: '12001～15000円', min: 12001, max: 15000 },
  { code: 'B012', name: '15001～20000円', min: 15001, max: 20000 },
  { code: 'B013', name: '20001～30000円', min: 20001, max: 30000 },
  { code: 'B014', name: '30001円～', min: 30001, max: null },
] as const;
