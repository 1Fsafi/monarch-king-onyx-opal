import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { a as dayFromUnix, b as timeMachine } from "./engine-LGhOn8mn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/market-w4nTVvZ1.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var UA = "Mozilla/5.0 (compatible; PITPaperDesk/1.0)";
function cleanSymbol(raw) {
	return raw.toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 6);
}
function yahooSymbol(symbol) {
	return symbol.replace(".", "-");
}
async function yahoo(url) {
	const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
	let last = "no response";
	for (const host of hosts) {
		const full = url.replace("query1.finance.yahoo.com", host);
		try {
			const res = await fetch(full, {
				headers: {
					"user-agent": UA,
					accept: "application/json"
				},
				signal: AbortSignal.timeout(12e3)
			});
			if (res.status === 429 || res.status >= 500) {
				last = `HTTP ${res.status}`;
				await new Promise((r) => setTimeout(r, 400));
				continue;
			}
			if (!res.ok) {
				last = `HTTP ${res.status}`;
				continue;
			}
			return await res.json();
		} catch (error) {
			last = error instanceof Error ? error.message : "fetch failed";
		}
	}
	throw new Error(last);
}
function num(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function parseDaily(json, symbol) {
	const root = json;
	const response = (root.spark?.result?.find((item) => item.symbol === symbol) ?? root.spark?.result?.[0])?.response?.[0];
	const stamps = response?.timestamp ?? [];
	const closes = response?.indicators?.quote?.[0]?.close ?? [];
	const byDay = /* @__PURE__ */ new Map();
	for (let i = 0; i < stamps.length; i++) {
		const close = num(closes[i]);
		const stamp = stamps[i];
		if (close == null || stamp == null) continue;
		byDay.set(dayFromUnix(stamp).key, close);
	}
	return [...byDay.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([day, close]) => ({
		day,
		close
	}));
}
function parseIntraday(json) {
	const result = json.chart?.result?.[0];
	if (!result?.timestamp) return null;
	const quote = result.indicators?.quote?.[0];
	const m5 = [];
	for (let i = 0; i < result.timestamp.length; i++) {
		const stamp = result.timestamp[i];
		const close = num(quote?.close?.[i]);
		const high = num(quote?.high?.[i]);
		const low = num(quote?.low?.[i]);
		const open = num(quote?.open?.[i]);
		if (stamp == null || close == null || high == null || low == null || open == null) continue;
		const ny = dayFromUnix(stamp);
		m5.push({
			day: ny.key,
			startMin: ny.minutes,
			o: open,
			h: high,
			l: low,
			c: close
		});
	}
	return {
		price: result.meta?.regularMarketPrice ?? m5[m5.length - 1]?.c ?? 0,
		volume: result.meta?.regularMarketVolume ?? 0,
		m5
	};
}
async function mapPool(items, size, fn) {
	const out = [];
	let cursor = 0;
	async function worker() {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			out[index] = await fn(items[index]);
		}
	}
	await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
	return out;
}
var loadTape_createServerFn_handler = createServerRpc({
	id: "a8415ce3df0b2dae01bf52341ea6dfd7e6db87998e2baf285f2719a737c544d3",
	name: "loadTape",
	filename: "src/lib/trader/market.ts"
}, (opts) => loadTape.__executeServer(opts));
var loadTape = createServerFn({ method: "POST" }).validator((input) => {
	const symbols = [...new Set((input?.symbols ?? []).map(cleanSymbol).filter((s) => s.length >= 1))].slice(0, 20);
	if (!symbols.length) throw new Error("Add at least one ticker.");
	return { symbols };
}).handler(loadTape_createServerFn_handler, async ({ data }) => {
	const symbols = data.symbols;
	let daily = /* @__PURE__ */ new Map();
	try {
		const spark = await yahoo(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${symbols.map(yahooSymbol).join(",")}&range=6mo&interval=1d`);
		daily = new Map(symbols.map((symbol) => [symbol, parseDaily(spark, yahooSymbol(symbol))]));
	} catch {
		daily = /* @__PURE__ */ new Map();
	}
	const charts = await mapPool(symbols, 4, async (symbol) => {
		try {
			const intra = parseIntraday(await yahoo(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?range=5d&interval=5m&includePrePost=false`));
			if (!intra || !intra.m5.length) return {
				symbol,
				price: 0,
				volume: 0,
				m5: [],
				daily: daily.get(symbol) ?? [],
				error: "No bars"
			};
			return {
				symbol,
				price: intra.price,
				volume: intra.volume,
				m5: intra.m5,
				daily: daily.get(symbol) ?? []
			};
		} catch (error) {
			return {
				symbol,
				price: 0,
				volume: 0,
				m5: [],
				daily: daily.get(symbol) ?? [],
				error: error instanceof Error ? error.message : "Failed"
			};
		}
	});
	const ok = charts.filter((chart) => !chart.error).length;
	if (!ok) throw new Error("Could not read any charts. Yahoo may be rate-limiting. Try again in a minute.");
	return {
		charts,
		fetched: ok,
		requested: symbols.length
	};
});
var replayOdds_createServerFn_handler = createServerRpc({
	id: "dbd76fe5643a89b2cd11ad52b82e64ef16e2ad191b2b03719adcc23dde3de9ba",
	name: "replayOdds",
	filename: "src/lib/trader/market.ts"
}, (opts) => replayOdds.__executeServer(opts));
var replayOdds = createServerFn({ method: "POST" }).validator((input) => {
	const symbol = cleanSymbol(input?.symbol ?? "");
	const day = input?.day ?? "";
	const barIndex = Number(input?.barIndex);
	const entry = Number(input?.entry);
	const stop = Number(input?.stop);
	const target = Number(input?.target);
	if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Bad replay request.");
	if (![
		barIndex,
		entry,
		stop,
		target
	].every((n) => Number.isFinite(n))) throw new Error("Bad prices.");
	return {
		symbol,
		day,
		barIndex,
		entry,
		stop,
		target
	};
}).handler(replayOdds_createServerFn_handler, async ({ data }) => {
	try {
		const intra = parseIntraday(await yahoo(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(data.symbol))}?range=60d&interval=5m&includePrePost=false`));
		if (!intra) return { error: "No 60-day tape for the time machine." };
		return timeMachine({
			symbol: data.symbol,
			bars: intra.m5,
			day: data.day,
			barIndex: data.barIndex,
			entry: data.entry,
			stop: data.stop,
			target: data.target
		});
	} catch (error) {
		return { error: error instanceof Error ? error.message : "Time machine failed." };
	}
});
//#endregion
export { loadTape_createServerFn_handler, replayOdds_createServerFn_handler };
