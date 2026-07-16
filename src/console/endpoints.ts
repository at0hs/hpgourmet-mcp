// HotPepper Web Service (Recruit) の各APIエンドポイント定義。
// hotpepper_api_console のフォームUI生成・プロキシ側のバリデーション両方の単一ソースとして使う。
// key(APIキー)とformatはサーバー側で強制するためここには含めない。

export type ParamDef = {
	name: string;
	label: string;
	type: "text" | "number" | "select";
	required?: boolean;
	options?: { value: string; label: string }[];
	placeholder?: string;
	hint?: string;
	// フォーム表示時のグループ見出し。未指定時は"基本"扱い。
	group?: string;
};

export type EndpointDef = {
	slug: string;
	label: string;
	desc?: string;
	// Recruit側のパスセグメント（https://webservice.recruit.co.jp/hotpepper/{path}/v1/）
	path: string;
	params: ParamDef[];
};

const rangeOptions = [
	{ value: "", label: "指定なし（デフォルト=3:1000m）" },
	{ value: "1", label: "1: 300m" },
	{ value: "2", label: "2: 500m" },
	{ value: "3", label: "3: 1000m" },
	{ value: "4", label: "4: 2000m" },
	{ value: "5", label: "5: 3000m" },
];

export const ENDPOINTS: Record<string, EndpointDef> = {
	gourmet: {
		slug: "gourmet",
		label: "グルメサーチAPI",
		path: "gourmet",
		desc: "店舗を各種条件で検索します。id / エリアコード / keyword / lat のいずれか最低1つが必要です。",
		params: [
			{ name: "keyword", label: "キーワード", type: "text", group: "基本", hint: "店名・住所・駅名などのフリーワード。半角スペースでAND" },
			{ name: "id", label: "店舗ID", type: "text", group: "基本", hint: "カンマ区切りで複数指定可" },
			{ name: "large_area", label: "大エリア", type: "text", placeholder: "Z011", group: "エリア・位置", hint: "3個まで" },
			{ name: "middle_area", label: "中エリア", type: "text", placeholder: "Y005", group: "エリア・位置", hint: "5個まで" },
			{ name: "small_area", label: "小エリア", type: "text", placeholder: "X010", group: "エリア・位置", hint: "5個まで" },
			{ name: "lat", label: "緯度", type: "text", placeholder: "33.7263", group: "エリア・位置" },
			{ name: "lng", label: "経度", type: "text", placeholder: "130.4644", group: "エリア・位置" },
			{ name: "range", label: "検索範囲", type: "select", options: rangeOptions, group: "エリア・位置" },
			{ name: "genre", label: "ジャンルコード", type: "text", placeholder: "G001", group: "絞り込み", hint: "ジャンルマスタAPI参照。複数可" },
			{ name: "budget", label: "ディナー予算", type: "text", placeholder: "B002", group: "絞り込み", hint: "予算マスタAPI参照。2個まで" },
			{ name: "party_capacity", label: "宴会収容人数", type: "number", placeholder: "50", group: "絞り込み", hint: "指定数より大きい店を検索" },
			{
				name: "order",
				label: "ソート順",
				type: "select",
				group: "出力",
				options: [
					{ value: "", label: "指定なし（デフォルト=おすすめ順）" },
					{ value: "1", label: "1: おすすめ順" },
					{ value: "2", label: "2: ジャンルコード順" },
					{ value: "3", label: "3: 小エリアコード順" },
					{ value: "4", label: "4: 掲載店舗コード順" },
				],
			},
			{ name: "start", label: "検索開始位置", type: "number", placeholder: "1", group: "出力" },
			{ name: "count", label: "取得件数", type: "number", placeholder: "10", group: "出力", hint: "デフォルト10 / 最大100" },
		],
	},
	shop: {
		slug: "shop",
		label: "店名サーチAPI",
		path: "shop",
		desc: "店名・住所・電話番号で検索します。keyword か tel のいずれか最低1つが必要です。",
		params: [
			{ name: "keyword", label: "キーワード", type: "text", group: "基本", hint: "店名・住所の部分一致。カンマ/半角スペースでAND" },
			{ name: "tel", label: "電話番号", type: "text", placeholder: "0355550000", group: "基本", hint: "完全一致・ハイフンなし" },
			{ name: "start", label: "検索開始位置", type: "number", placeholder: "1", group: "出力" },
			{ name: "count", label: "取得件数", type: "number", placeholder: "30", group: "出力", hint: "デフォルト30 / 最大30" },
		],
	},
	budget: {
		slug: "budget",
		label: "検索用ディナー予算マスタAPI",
		path: "budget",
		desc: "ディナー予算コードの一覧を取得します。",
		params: [],
	},
	large_service_area: {
		slug: "large_service_area",
		label: "大サービスエリアマスタAPI",
		path: "large_service_area",
		desc: "大サービスエリアコードの一覧を取得します。",
		params: [],
	},
	service_area: {
		slug: "service_area",
		label: "サービスエリアマスタAPI",
		path: "service_area",
		desc: "サービスエリアコードの一覧を取得します。",
		params: [
			{ name: "large_service_area", label: "大サービスエリアコード", type: "text", group: "基本", hint: "完全一致" },
			{ name: "keyword", label: "キーワード", type: "text", group: "基本", hint: "部分一致" },
		],
	},
	large_area: {
		slug: "large_area",
		label: "大エリアマスタAPI",
		path: "large_area",
		desc: "大エリアコードの一覧を取得します。",
		params: [
			{ name: "large_area", label: "大エリアコード", type: "text", placeholder: "Z011", group: "基本", hint: "完全一致。3個まで" },
			{ name: "keyword", label: "大エリア名", type: "text", group: "基本", hint: "部分一致" },
		],
	},
	middle_area: {
		slug: "middle_area",
		label: "中エリアマスタAPI",
		path: "middle_area",
		desc: "中エリアコードの一覧を取得します。",
		params: [
			{ name: "middle_area", label: "中エリアコード", type: "text", placeholder: "Y005", group: "基本", hint: "完全一致。5個まで" },
			{ name: "large_area", label: "大エリアコード", type: "text", placeholder: "Z011", group: "基本", hint: "完全一致。3個まで" },
			{ name: "keyword", label: "中エリア名", type: "text", group: "基本", hint: "部分一致" },
			{ name: "start", label: "検索開始位置", type: "number", placeholder: "1", group: "出力" },
			{ name: "count", label: "取得件数", type: "number", group: "出力", hint: "デフォルトは全て取得" },
		],
	},
	small_area: {
		slug: "small_area",
		label: "小エリアマスタAPI",
		path: "small_area",
		desc: "小エリアコードの一覧を取得します。",
		params: [
			{ name: "small_area", label: "小エリアコード", type: "text", placeholder: "X010", group: "基本", hint: "完全一致。5個まで" },
			{ name: "middle_area", label: "中エリアコード", type: "text", placeholder: "Y005", group: "基本", hint: "完全一致。5個まで" },
			{ name: "keyword", label: "小エリア名", type: "text", group: "基本", hint: "部分一致" },
			{ name: "start", label: "検索開始位置", type: "number", placeholder: "1", group: "出力" },
			{ name: "count", label: "取得件数", type: "number", group: "出力", hint: "デフォルトは全て取得" },
		],
	},
	genre: {
		slug: "genre",
		label: "ジャンルマスタAPI",
		path: "genre",
		desc: "お店ジャンルコードの一覧を取得します。",
		params: [
			{ name: "code", label: "ジャンルコード", type: "text", placeholder: "G002", group: "基本", hint: "完全一致。2個まで" },
			{ name: "keyword", label: "ジャンル名", type: "text", group: "基本", hint: "部分一致" },
		],
	},
	credit_card: {
		slug: "credit_card",
		label: "クレジットカードマスタAPI",
		path: "credit_card",
		desc: "クレジットカードコードの一覧を取得します。",
		params: [],
	},
	special: {
		slug: "special",
		label: "特集マスタAPI",
		path: "special",
		desc: "特集コードの一覧を取得します。",
		params: [
			{ name: "special", label: "特集コード", type: "text", placeholder: "LJ0028", group: "基本", hint: "完全一致。複数可" },
			{ name: "special_category", label: "特集カテゴリコード", type: "text", placeholder: "SPG6", group: "基本", hint: "完全一致。複数可" },
		],
	},
	special_category: {
		slug: "special_category",
		label: "特集カテゴリマスタAPI",
		path: "special_category",
		desc: "特集カテゴリコードの一覧を取得します。",
		params: [{ name: "special_category", label: "特集カテゴリコード", type: "text", placeholder: "SPC0", group: "基本", hint: "完全一致。複数可" }],
	},
};
