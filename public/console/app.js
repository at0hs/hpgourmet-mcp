"use strict";

/* ============================================================
   状態
   ============================================================ */
let ENDPOINTS = {};
let ORDER = [];
const MASTER_START_INDEX = 2; // gourmet, shopの次からmaster API群

const state = { slug: null, values: {}, tab: "view", last: null };

const $ = (s) => document.querySelector(s);
const el = (t, c) => {
	const e = document.createElement(t);
	if (c) e.className = c;
	return e;
};
const esc = (s) =>
	String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* ============================================================
   API一覧（レール）
   ============================================================ */
function renderRail() {
	const ul = $("#apilist");
	ul.innerHTML = "";
	ORDER.forEach((slug, i) => {
		if (i === MASTER_START_INDEX) {
			const li = el("li");
			li.className = "sep";
			li.textContent = "MASTER";
			ul.appendChild(li);
		}
		const endpoint = ENDPOINTS[slug];
		const li = el("li");
		const b = el("button");
		b.innerHTML = '<span class="num">' + String(i + 1).padStart(2, "0") + "</span><span>" + esc(endpoint.label) + "</span>";
		b.dataset.slug = slug;
		b.addEventListener("click", () => selectApi(slug));
		li.appendChild(b);
		ul.appendChild(li);
	});
}

function selectApi(slug) {
	state.slug = slug;
	state.values = {};
	document.querySelectorAll("#apilist button").forEach((b) => b.classList.toggle("on", b.dataset.slug === slug));
	$("#brand-slug").textContent = ENDPOINTS[slug].path + "/v1";
	renderForm();
	renderWire();
}

/* ============================================================
   フォーム
   ============================================================ */
function renderForm() {
	const endpoint = ENDPOINTS[state.slug];
	const box = $("#form");
	box.innerHTML = "";

	if (endpoint.desc) {
		const p = el("p", "desc");
		p.textContent = endpoint.desc;
		box.appendChild(p);
	}

	const groups = {};
	const groupOrder = [];
	endpoint.params.forEach((def) => {
		const g = def.group || "基本";
		if (!groups[g]) {
			groups[g] = [];
			groupOrder.push(g);
		}
		groups[g].push(def);
	});

	groupOrder.forEach((g) => {
		const fs = el("fieldset");
		const lg = el("legend");
		lg.textContent = g;
		fs.appendChild(lg);
		groups[g].forEach((def) => fs.appendChild(renderField(def)));
		box.appendChild(fs);
	});

	const act = el("div", "actions");
	const send = el("button", "btn primary");
	send.id = "send";
	send.textContent = "送信";
	send.addEventListener("click", run);
	const clear = el("button", "btn");
	clear.textContent = "クリア";
	clear.addEventListener("click", () => selectApi(state.slug));
	act.appendChild(send);
	act.appendChild(clear);
	box.appendChild(act);
}

function renderField(def) {
	const row = el("div", "row");
	const lab = el("label");
	lab.innerHTML = esc(def.label) + (def.required ? ' <span style="color:var(--accent)">*</span>' : "") + '<span class="pn">' + esc(def.name) + "</span>";
	row.appendChild(lab);

	let field;
	if (def.type === "select") {
		field = el("select");
		for (const o of def.options || []) {
			const opt = el("option");
			opt.value = o.value;
			opt.textContent = o.label;
			field.appendChild(opt);
		}
		state.values[def.name] = field.value;
		field.addEventListener("change", () => {
			state.values[def.name] = field.value;
			renderWire();
		});
	} else {
		field = el("input");
		field.type = def.type === "number" ? "number" : "text";
		if (def.placeholder) field.placeholder = def.placeholder;
		field.addEventListener("input", () => {
			state.values[def.name] = field.value.trim();
			renderWire();
		});
	}
	field.id = "field-" + def.name;
	row.appendChild(field);

	if (def.hint) {
		const h = el("div", "hint");
		h.textContent = def.hint;
		row.appendChild(h);
	}
	return row;
}

/* ============================================================
   リクエストURLプレビュー（wire）
   実際に叩くのは自分のプロキシ(/console/api/:slug)。
   key/formatはサーバー側で強制付与されるためここでは表示しない。
   ============================================================ */
function buildPairs() {
	const endpoint = ENDPOINTS[state.slug];
	const pairs = [];
	endpoint.params.forEach((def) => {
		const v = (state.values[def.name] || "").toString().trim();
		if (v !== "") pairs.push([def.name, v]);
	});
	return pairs;
}
function qs(pairs) {
	return pairs.map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
}
function proxyPath() {
	const pairs = buildPairs();
	return "/console/api/" + state.slug + (pairs.length ? "?" + qs(pairs) : "");
}
function fullUrl() {
	return window.location.origin + proxyPath();
}

function renderWire() {
	const pairs = buildPairs();
	let html = '<span class="base">/console/api/' + esc(state.slug) + "</span>";
	if (pairs.length) {
		html += '<span class="amp">?</span>';
		html += pairs
			.map(
				([k, v], i) =>
					(i ? '<span class="amp">&amp;</span>' : "") +
					'<span class="k">' + esc(k) + '</span><span class="amp">=</span>' +
					'<span class="v">' + esc(encodeURIComponent(v)) + "</span>",
			)
			.join("");
	}
	html += '<br><span class="masked">→ Recruit API送信時はkey（サーバー保持のシークレット）とformat=jsonが自動付与されます</span>';
	$("#wire").innerHTML = html;
}

$("#copyUrl").addEventListener("click", () => copy(fullUrl(), "リクエストURLをコピーしました"));
$("#copyCurl").addEventListener("click", () => copy("curl -s '" + fullUrl() + "'", "curlコマンドをコピーしました"));
function copy(text, msg) {
	navigator.clipboard.writeText(text).then(
		() => toast(msg),
		() => toast("コピーできませんでした"),
	);
}
function toast(msg) {
	const t = $("#toast");
	t.textContent = msg;
	t.classList.add("on");
	clearTimeout(t._t);
	t._t = setTimeout(() => t.classList.remove("on"), 1800);
}

/* ============================================================
   送信
   ============================================================ */
async function run() {
	const btn = $("#send");
	btn.disabled = true;
	btn.textContent = "送信中…";
	const t0 = performance.now();
	try {
		const res = await fetch(proxyPath());
		const data = await res.json();
		const ms = Math.round(performance.now() - t0);
		state.last = { data, ms };
		renderResult();
	} catch (err) {
		state.last = null;
		$("#tabs").hidden = true;
		setStatus(false, "リクエスト失敗");
		$("#out").innerHTML =
			'<div class="banner"><b>ローカルサーバーに接続できませんでした。</b><br>wrangler devが起動しているか確認してください。<br><code>' +
			esc(String(err)) +
			"</code></div>";
	} finally {
		btn.disabled = false;
		btn.textContent = "送信";
	}
}

function setStatus(ok, label, extra) {
	$("#statusinfo").innerHTML = '<span class="pill ' + (ok ? "ok" : "ng") + '">' + esc(label) + "</span>" + (extra || "");
}

function renderResult() {
	const { data, ms } = state.last;
	const meta = "<span>" + ms + " ms</span>";
	$("#tabs").hidden = false;
	setStatus(data.ok, data.ok ? "OK (status " + data.status + ")" : "ERROR (status " + data.status + ")", meta);

	const out = $("#out");
	out.innerHTML = "";

	if (!data.ok) {
		const b = el("div", "banner");
		b.innerHTML = "<b>" + esc(data.error) + "</b>";
		out.appendChild(b);
	}

	const body = el("div");
	if (state.tab === "raw" || !data.ok) {
		body.innerHTML = "<pre>" + highlight(JSON.stringify(data, null, 2)) + "</pre>";
	} else {
		body.innerHTML = renderBody(data.body);
	}
	out.appendChild(body);
}

$("#tabs").addEventListener("click", (e) => {
	const b = e.target.closest("button");
	if (!b) return;
	state.tab = b.dataset.tab;
	document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("on", x === b));
	if (state.last) renderResult();
});

/* ============================================================
   レスポンス全体（{results:{...}}）の整形。
   results直下のスカラー値（api_version, results_available等）はメタデータとして
   上部にまとめ、ネストしたオブジェクト/配列（shop, genre等の本体データ）を
   主要コンテンツとして表示する。エンドポイント固有のキー名には依存しない。
   ============================================================ */
function renderBody(body) {
	if (body === null || typeof body !== "object" || Array.isArray(body)) {
		return renderValue(body);
	}
	return Object.keys(body)
		.map((key) => renderTopLevelBlock(body[key]))
		.join("");
}

function renderTopLevelBlock(obj) {
	if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
		return renderValue(obj);
	}
	const metaEntries = [];
	const mainEntries = [];
	for (const key of Object.keys(obj)) {
		const v = obj[key];
		if (v !== null && typeof v === "object") {
			mainEntries.push([key, v]);
		} else {
			metaEntries.push([key, v]);
		}
	}

	let html = "";
	if (metaEntries.length) {
		html +=
			'<div class="meta-bar">' +
			metaEntries.map(([k, v]) => "<b>" + esc(k) + "</b> " + esc(v)).join("") +
			"</div>";
	}
	mainEntries.forEach(([key, v]) => {
		if (mainEntries.length > 1) {
			html += '<div class="section-title">' + esc(key) + "</div>";
		}
		html += renderValue(v);
	});
	if (!metaEntries.length && !mainEntries.length) {
		html += '<span class="null-value">(空オブジェクト)</span>';
	}
	return html;
}

/* ============================================================
   任意のJSON値をテーブル/リストに整形する汎用レンダラー。
   APIごとにレスポンス構造（gourmetはshop配列、master系はbudget/genre配列等）が
   異なるため、エンドポイント固有のテンプレートは作らずここで吸収する。
   ============================================================ */
function renderValue(value) {
	if (value === null || value === undefined) {
		return '<span class="null-value">(null)</span>';
	}
	if (Array.isArray(value)) {
		if (value.length === 0) return '<span class="null-value">(空配列)</span>';
		const allObjects = value.every((v) => v !== null && typeof v === "object" && !Array.isArray(v));
		if (allObjects) {
			const columns = [];
			for (const row of value) {
				for (const key of Object.keys(row)) {
					if (!columns.includes(key)) columns.push(key);
				}
			}
			let html = '<p class="count">' + value.length + "件</p>";
			html += '<table class="mst"><thead><tr>';
			for (const col of columns) html += "<th>" + esc(col) + "</th>";
			html += "</tr></thead><tbody>";
			for (const row of value) {
				html += "<tr>";
				for (const col of columns) {
					const isCode = col.endsWith("code") || col === "id";
					html += "<td" + (isCode ? ' class="code"' : "") + ">" + renderValue(row[col]) + "</td>";
				}
				html += "</tr>";
			}
			html += "</tbody></table>";
			return html;
		}
		return "<ul>" + value.map((v) => "<li>" + renderValue(v) + "</li>").join("") + "</ul>";
	}
	if (typeof value === "object") {
		const keys = Object.keys(value);
		if (keys.length === 0) return '<span class="null-value">(空オブジェクト)</span>';
		let html = '<table class="mst"><tbody>';
		for (const key of keys) {
			html += '<tr><td class="code">' + esc(key) + "</td><td>" + renderValue(value[key]) + "</td></tr>";
		}
		html += "</tbody></table>";
		return html;
	}
	return esc(value);
}

function highlight(s) {
	return esc(s).replace(
		/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
		(m) => {
			let cls = "j-num";
			if (/^"/.test(m)) cls = /:$/.test(m) ? "j-key" : "j-str";
			else if (/true|false/.test(m)) cls = "j-bool";
			else if (/null/.test(m)) cls = "j-null";
			return '<span class="' + cls + '">' + m + "</span>";
		},
	);
}

/* ============================================================
   初期化
   ============================================================ */
document.addEventListener("keydown", (e) => {
	if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
		e.preventDefault();
		run();
	}
});

async function init() {
	const res = await fetch("/console/api/_endpoints");
	ENDPOINTS = await res.json();
	ORDER = Object.keys(ENDPOINTS);
	renderRail();
	selectApi(ORDER[0]);
}

init();
