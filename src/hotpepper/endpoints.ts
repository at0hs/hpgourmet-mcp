// ホットペッパー Web Service (Recruit) の既知エンドポイント一覧。
// パスセグメントは常にslugと一致する（https://webservice.recruit.co.jp/hotpepper/{slug}/v1/）ため、
// pathを別途保持せずslug自体をURLパスとして扱う。
export const HOTPEPPER_ENDPOINT_SLUGS = [
  'gourmet',
  'shop',
  'budget',
  'large_service_area',
  'service_area',
  'large_area',
  'middle_area',
  'small_area',
  'genre',
  'credit_card',
  'special',
  'special_category',
] as const;

export type HotpepperEndpointSlug = (typeof HOTPEPPER_ENDPOINT_SLUGS)[number];

export function isHotpepperEndpointSlug(value: string): value is HotpepperEndpointSlug {
  return (HOTPEPPER_ENDPOINT_SLUGS as readonly string[]).includes(value);
}
