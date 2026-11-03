//#region node_modules/.nitro/vite/services/ssr/assets/engine-LGhOn8mn.js
var HOLIDAYS = /* @__PURE__ */ new Set([
	"2026-01-01",
	"2026-01-19",
	"2026-02-16",
	"2026-04-03",
	"2026-05-25",
	"2026-06-19",
	"2026-07-03",
	"2026-09-07",
	"2026-11-26",
	"2026-12-25",
	"2027-01-01",
	"2027-01-18",
	"2027-02-15",
	"2027-03-26",
	"2027-05-31",
	"2027-06-18",
	"2027-07-05",
	"2027-09-06",
	"2027-11-25",
	"2027-12-24"
]);
var EARLY = /* @__PURE__ */ new Set([
	"2026-11-27",
	"2026-12-24",
	"2027-11-26"
]);
function nyNow(date = /* @__PURE__ */ new Date()) {
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/New_York",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		weekday: "short",
		hourCycle: "h23"
	});
	const bag = {};
	for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
	let hour = Number(bag.hour);
	if (hour === 24) hour = 0;
	const minute = Number(bag.minute);
	return {
		key: `${bag.year}-${bag.month}-${bag.day}`,
		minutes: hour * 60 + minute,
		weekday: bag.weekday ?? "",
		label: `${bag.weekday} ${bag.month}/${bag.day} ${pad(hour)}:${pad(minute)} ET`
	};
}
function pad(n) {
	return String(n).padStart(2, "0");
}
function clockLabel(minutes) {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	const suffix = h >= 12 ? "PM" : "AM";
	return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${suffix}`;
}
function isHoliday(day) {
	return HOLIDAYS.has(day);
}
function closeMin(day) {
	return EARLY.has(day) ? 780 : 960;
}
function flatMin(day) {
	return EARLY.has(day) ? 775 : 955;
}
function entryUntil(day) {
	return EARLY.has(day) ? 750 : 930;
}
function isWeekday(day) {
	const [y, m, d] = day.split("-").map(Number);
	const utc = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 17, 0, 0));
	const wd = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/New_York",
		weekday: "short"
	}).format(utc);
	return wd !== "Sat" && wd !== "Sun";
}
function sessionOpen(day, minutes) {
	if (!isWeekday(day) || isHoliday(day)) return false;
	return minutes >= 570 && minutes < closeMin(day);
}
function dayFromUnix(sec) {
	return nyNow(/* @__PURE__ */ new Date(sec * 1e3));
}
var DEFAULT_SYMBOLS = [
	"AAPL",
	"MSFT",
	"NVDA",
	"AMZN",
	"GOOGL",
	"META",
	"TSLA",
	"AMD",
	"AVGO",
	"JPM",
	"XOM",
	"UNH",
	"COST",
	"WMT",
	"CRM",
	"BA"
];
var SETUP_LABEL = {
	breakout_20d: "20-day closing high",
	bull_flag: "Bull flag",
	reclaim_ma20: "Reclaimed the 20-day average",
	oversold: "RSI under 30",
	oversold_bounce: "Oversold bounce"
};
function defaultConfig() {
	return {
		budget: 5e3,
		cashBufferPct: 10,
		maxPositionPct: 75,
		maxOrderUsd: 4e3,
		minOrderUsd: 5,
		maxLossPerTrade: 50,
		maxDailyLoss: 150,
		maxTradesPerDay: 3,
		minRewardRisk: 1,
		targetR: 1,
		symbols: [...DEFAULT_SYMBOLS]
	};
}
function freshBook(budget = 5e3) {
	return {
		cash: budget,
		positions: [],
		closed: [],
		tradesToday: 0,
		riskUsed: 0,
		bookDay: "",
		skipped: [],
		log: [],
		seq: 1
	};
}
function money(n) {
	return n.toLocaleString("en-US", {
		style: "currency",
		currency: "USD"
	});
}
function cents(n) {
	return Math.round(n * 100);
}
function fromCents(c) {
	return c / 100;
}
function rsi(closes, n = 14) {
	if (closes.length < n + 1) return null;
	const gains = [];
	const losses = [];
	for (let i = 1; i < closes.length; i++) {
		const delta = closes[i] - closes[i - 1];
		gains.push(Math.max(0, delta));
		losses.push(Math.max(0, -delta));
	}
	let avgGain = 0;
	let avgLoss = 0;
	for (let i = 0; i < n; i++) {
		avgGain += gains[i] ?? 0;
		avgLoss += losses[i] ?? 0;
	}
	avgGain /= n;
	avgLoss /= n;
	for (let i = n; i < gains.length; i++) {
		avgGain = (avgGain * (n - 1) + (gains[i] ?? 0)) / n;
		avgLoss = (avgLoss * (n - 1) + (losses[i] ?? 0)) / n;
	}
	if (!avgLoss) return 100;
	return 100 - 100 / (1 + avgGain / avgLoss);
}
function findSetups(closes) {
	if (closes.length < 30) return {
		tags: [],
		rsi: null
	};
	const last = closes[closes.length - 1] ?? 0;
	const prev = closes[closes.length - 2] ?? last;
	const window = closes.slice(-21, -1);
	const hi20 = Math.max(...window);
	const ma20 = closes.slice(-20).reduce((s, v) => s + v, 0) / 20;
	const ma20Prev = window.reduce((s, v) => s + v, 0) / 20;
	const c6 = closes[closes.length - 6] ?? last;
	const c16 = closes[closes.length - 16] ?? last;
	const run = c16 ? c6 / c16 - 1 : 0;
	const last5 = closes.slice(-5);
	const rng5 = last ? (Math.max(...last5) - Math.min(...last5)) / last : 1;
	const r = rsi(closes);
	const rPrev = rsi(closes.slice(0, -1));
	const tags = [];
	if (last > hi20) tags.push("breakout_20d");
	if (run > .1 && rng5 < .05) tags.push("bull_flag");
	if (prev < ma20Prev && last > ma20) tags.push("reclaim_ma20");
	if (r != null && r < 30) tags.push("oversold");
	if (rPrev != null && rPrev < 30 && last > prev) tags.push("oversold_bounce");
	return {
		tags,
		rsi: r
	};
}
function sessionBars(chart, day, cutoffMin, sessionClose) {
	const byStart = /* @__PURE__ */ new Map();
	for (const bar of chart.m5) {
		if (bar.day !== day) continue;
		if (bar.startMin % 5 !== 0) continue;
		if (bar.startMin < 570 || bar.startMin >= sessionClose) continue;
		if (bar.startMin + 5 > cutoffMin) continue;
		byStart.set(bar.startMin, bar);
	}
	const want = Math.floor((Math.min(cutoffMin, sessionClose) - 570) / 5);
	if (want < 3) return [];
	const out = [];
	for (let i = 0; i < want; i++) {
		const bar = byStart.get(570 + i * 5);
		if (!bar) return [];
		out.push(bar);
	}
	return out;
}
function orbOn(chart, day, cutoffMin) {
	const bars = sessionBars(chart, day, cutoffMin, closeMin(day));
	if (bars.length <= 3) return null;
	const range = bars.slice(0, 3);
	const orHigh = Math.max(...range.map((b) => b.h));
	const orLow = Math.min(...range.map((b) => b.l));
	for (let k = 3; k < bars.length; k++) {
		const bar = bars[k];
		if (!bar) continue;
		if (bar.c > orHigh) {
			const price = fromCents(cents(bar.c));
			return {
				symbol: chart.symbol,
				price,
				atMin: bar.startMin + 5,
				barIndex: k,
				orHigh: fromCents(cents(orHigh)),
				orLow: fromCents(cents(orLow)),
				pctOver: orHigh ? (bar.c / orHigh - 1) * 100 : 0,
				dollarVol: chart.price * chart.volume,
				startMin: bar.startMin
			};
		}
	}
	return null;
}
function listOrb(charts, day, cutoffMin) {
	const hits = [];
	for (const chart of charts) {
		if (chart.error || !chart.m5.length) continue;
		const hit = orbOn(chart, day, cutoffMin);
		if (hit) hits.push({
			...hit,
			day
		});
	}
	hits.sort((a, b) => b.dollarVol - a.dollarVol || a.symbol.localeCompare(b.symbol));
	return hits;
}
function listDaily(charts, today, todayDone) {
	const hits = [];
	for (const chart of charts) {
		if (!chart.daily.length) continue;
		const closes = [];
		for (const bar of chart.daily) if (bar.day < today || bar.day === today && todayDone) closes.push(bar.close);
		const found = findSetups(closes);
		if (!found.tags.length) continue;
		const price = closes[closes.length - 1] ?? chart.price;
		hits.push({
			symbol: chart.symbol,
			price,
			setups: found.tags,
			rsi: found.rsi == null ? null : Math.round(found.rsi * 10) / 10,
			dollarVol: price * chart.volume
		});
	}
	hits.sort((a, b) => b.dollarVol - a.dollarVol || a.symbol.localeCompare(b.symbol));
	return hits;
}
function sizeFromRange(entry, orHigh, orLow, config, cash) {
	const entryC = cents(entry);
	const stopC = Math.floor((orHigh + orLow) / 2 * 100 + 1e-6);
	const riskC = entryC - stopC;
	if (riskC <= 0) return {
		ok: false,
		reason: "Stop is not under the entry."
	};
	const risk = fromCents(riskC);
	if (risk < entry * 5e-4) return {
		ok: false,
		reason: "Stop is too tight to survive the spread."
	};
	const target = fromCents(entryC + config.targetR * riskC);
	const rr = config.targetR;
	if (rr < config.minRewardRisk) return {
		ok: false,
		reason: "Reward to risk is under your minimum."
	};
	const lossCap = Math.floor(config.maxLossPerTrade * 100 / riskC);
	const posCap = Math.floor(config.budget * config.maxPositionPct / 100 / entry);
	const orderCap = Math.floor(config.maxOrderUsd / entry);
	const buffer = config.budget * config.cashBufferPct / 100;
	const spendable = Math.max(0, Math.min(cash, config.budget) - buffer);
	const cashCap = Math.floor(spendable / entry);
	const bound = [
		{
			qty: lossCap,
			name: `your ${money(config.maxLossPerTrade)} max loss`
		},
		{
			qty: posCap,
			name: "the position cap"
		},
		{
			qty: orderCap,
			name: "the max order"
		},
		{
			qty: cashCap,
			name: "cash after the buffer"
		}
	].reduce((a, b) => b.qty < a.qty ? b : a);
	const qty = Math.max(0, bound.qty);
	if (qty < 1) return {
		ok: false,
		reason: `No whole share fits inside ${bound.name}. One share risks ${money(risk)}.`
	};
	const notional = fromCents(qty * entryC);
	if (notional < config.minOrderUsd) return {
		ok: false,
		reason: "Order is under the minimum size."
	};
	const maxLoss = fromCents(qty * riskC);
	return {
		ok: true,
		sized: {
			qty,
			entry: fromCents(entryC),
			stop: fromCents(stopC),
			target,
			riskPerShare: risk,
			maxLoss,
			rr,
			bound: bound.name,
			notional
		}
	};
}
function pushLog(book, text) {
	const item = {
		id: String(book.seq),
		text
	};
	book.seq += 1;
	book.log = [item, ...book.log].slice(0, 40);
	return item;
}
function rollDay(book, day) {
	if (book.bookDay === day) return;
	if (book.positions.length) {
		for (const pos of book.positions) {
			book.cash = fromCents(cents(book.cash) + pos.qty * cents(pos.entry));
			book.closed = [{
				id: pos.id,
				symbol: pos.symbol,
				qty: pos.qty,
				entry: pos.entry,
				exit: pos.entry,
				reason: "scratch",
				pnl: 0,
				day: pos.day
			}, ...book.closed].slice(0, 30);
		}
		pushLog(book, "Scratched leftover paper shares before the new session. Nothing was sent to a broker.");
		book.positions = [];
	}
	book.bookDay = day;
	book.tradesToday = 0;
	book.riskUsed = 0;
	book.skipped = [];
}
function exitPosition(book, pos, price, reason) {
	const pnl = fromCents(pos.qty * (cents(price) - cents(pos.entry)));
	book.cash = fromCents(cents(book.cash) + pos.qty * cents(price));
	book.positions = book.positions.filter((p) => p.id !== pos.id);
	book.closed = [{
		id: pos.id,
		symbol: pos.symbol,
		qty: pos.qty,
		entry: pos.entry,
		exit: price,
		reason,
		pnl,
		day: pos.day
	}, ...book.closed].slice(0, 30);
	pushLog(book, `${reason === "stop" ? "Stop" : reason === "target" ? "Target" : reason === "flat" ? "Flat by the close" : "Scratch"} · ${pos.symbol} paper ${pos.qty} out at ${money(price)}. Paper P&L ${money(pnl)}. A stop can fill worse than this in a fast market.`);
}
function manage(book, charts, day, cutoffMin) {
	const flatAt = flatMin(day);
	for (const pos of [...book.positions]) {
		const chart = charts.find((c) => c.symbol === pos.symbol);
		if (!chart) continue;
		const bars = sessionBars(chart, day, cutoffMin, closeMin(day));
		for (const bar of bars) {
			if (bar.startMin <= pos.startMin) continue;
			if (bar.l <= pos.stop) {
				exitPosition(book, pos, pos.stop, "stop");
				break;
			}
			if (bar.h >= pos.target) {
				exitPosition(book, pos, pos.target, "target");
				break;
			}
			if (bar.startMin + 5 >= flatAt) {
				exitPosition(book, pos, fromCents(cents(bar.c)), "flat");
				break;
			}
		}
	}
}
function tradedToday(book, symbol) {
	return book.positions.some((p) => p.symbol === symbol) || book.closed.some((t) => t.symbol === symbol && t.day === book.bookDay && t.reason !== "scratch");
}
function fillTicket(book, ticket) {
	const next = {
		...book,
		positions: [...book.positions],
		closed: [...book.closed],
		log: [...book.log],
		skipped: [...book.skipped]
	};
	next.cash = fromCents(cents(next.cash) - ticket.qty * cents(ticket.entry));
	next.positions = [...next.positions, {
		id: ticket.id,
		symbol: ticket.symbol,
		qty: ticket.qty,
		entry: ticket.entry,
		stop: ticket.stop,
		target: ticket.target,
		startMin: ticket.startMin,
		day: ticket.day,
		maxLoss: ticket.maxLoss
	}];
	next.tradesToday += 1;
	next.riskUsed = fromCents(cents(next.riskUsed) + cents(ticket.maxLoss));
	pushLog(next, `Paper fill · BUY ${ticket.qty} ${ticket.symbol} at ${money(ticket.entry)}, stop ${money(ticket.stop)}, target ${money(ticket.target)}. Max loss at the stop ${money(ticket.maxLoss)}.`);
	return next;
}
function propose(book, hit, config) {
	if (hit.atMin < 585 || hit.atMin > entryUntil(hit.day)) return {
		ok: false,
		reason: "Outside the entry window, 9:45 AM to 3:30 PM ET.",
		halt: false
	};
	if (book.tradesToday >= config.maxTradesPerDay) return {
		ok: false,
		reason: `Already at ${config.maxTradesPerDay} paper entries today.`,
		halt: true
	};
	const sized = sizeFromRange(hit.price, hit.orHigh, hit.orLow, config, book.cash);
	if (!sized.ok) return {
		ok: false,
		reason: sized.reason,
		halt: false
	};
	const lossAfter = book.riskUsed + sized.sized.maxLoss;
	if (lossAfter > config.maxDailyLoss + .001) return {
		ok: false,
		reason: `This would put today's planned loss at ${money(lossAfter)}, over ${money(config.maxDailyLoss)}.`,
		halt: true
	};
	return {
		ok: true,
		ticket: {
			id: `${hit.symbol}-${hit.day}-${hit.atMin}`,
			symbol: hit.symbol,
			qty: sized.sized.qty,
			entry: sized.sized.entry,
			stop: sized.sized.stop,
			target: sized.sized.target,
			riskPerShare: sized.sized.riskPerShare,
			maxLoss: sized.sized.maxLoss,
			rr: sized.sized.rr,
			bound: sized.sized.bound,
			orHigh: hit.orHigh,
			orLow: hit.orLow,
			atMin: hit.atMin,
			barIndex: hit.barIndex,
			pctOver: Math.round(hit.pctOver * 100) / 100,
			day: hit.day,
			startMin: hit.startMin
		}
	};
}
function runCycle(args) {
	const book = {
		...args.book,
		positions: [...args.book.positions],
		closed: [...args.book.closed],
		log: [...args.book.log],
		skipped: [...args.book.skipped]
	};
	rollDay(book, args.day);
	manage(book, args.charts, args.day, args.cutoffMin);
	const hits = listOrb(args.charts, args.day, args.cutoffMin);
	let ticket = args.pending && args.pending.day === args.day ? args.pending : null;
	let banner = null;
	if (args.intent === "reject" && ticket) {
		book.skipped = [...book.skipped, ticket.symbol];
		pushLog(book, `Skipped ${ticket.symbol}. Nothing was placed.`);
		banner = `Skipped ${ticket.symbol}.`;
		ticket = null;
	}
	if (args.intent === "approve" && ticket) {
		const still = hits.find((h) => h.symbol === ticket?.symbol && h.atMin === ticket.atMin);
		if (!still) {
			pushLog(book, `${ticket.symbol} is no longer the triggered bar. Nothing was placed.`);
			ticket = null;
		} else {
			const again = propose(book, still, args.config);
			if (!again.ok) {
				pushLog(book, `Blocked ${ticket.symbol}. ${again.reason}`);
				banner = again.reason;
				ticket = null;
			} else return {
				book: fillTicket(book, again.ticket),
				ticket: null,
				hits,
				banner: `Paper fill ${again.ticket.symbol}.`
			};
		}
	}
	if (ticket && args.autopilot && args.intent === "mark") return {
		book: fillTicket(book, ticket),
		ticket: null,
		hits,
		banner: `Autopilot paper fill ${ticket.symbol}.`
	};
	if (!ticket) {
		const flatAt = flatMin(args.day);
		if (args.cutoffMin < flatAt && args.cutoffMin <= closeMin(args.day)) for (const hit of hits) {
			if (book.skipped.includes(hit.symbol) || tradedToday(book, hit.symbol)) continue;
			if (hit.atMin > entryUntil(args.day)) continue;
			const next = propose(book, hit, args.config);
			if (!next.ok) {
				if (next.halt) {
					if (book.log[0]?.text !== next.reason) pushLog(book, next.reason);
					break;
				}
				book.skipped = [...book.skipped, hit.symbol];
				pushLog(book, `Passed on ${hit.symbol}. ${next.reason}`);
				continue;
			}
			ticket = next.ticket;
			pushLog(book, `Ready · ${ticket.symbol} opening-range breakout at ${clockLabel(ticket.atMin)}, ${money(ticket.entry)}. ${ticket.qty} shares, bound by ${ticket.bound}. Max loss ${money(ticket.maxLoss)}. ${args.autopilot ? "Autopilot will paper-fill it." : "Waiting for your yes."}`);
			banner = `${ticket.symbol} triggered at ${clockLabel(ticket.atMin)}.`;
			if (args.autopilot) return {
				book: fillTicket(book, ticket),
				ticket: null,
				hits,
				banner: `Autopilot paper fill ${ticket.symbol}.`
			};
			break;
		}
	}
	return {
		book,
		ticket,
		hits,
		banner
	};
}
var SESSION_BARS = 78;
var COIN_FLIP = .05;
var STRONG = .15;
var MANY_NEITHER = .4;
function groupSessions(bars) {
	const days = /* @__PURE__ */ new Map();
	for (const bar of bars) {
		if (bar.startMin < 570 || bar.startMin >= 960) continue;
		if (bar.startMin % 5 !== 0) continue;
		const slot = (bar.startMin - 570) / 5;
		if (slot < 0 || slot >= SESSION_BARS) continue;
		let day = days.get(bar.day);
		if (!day) {
			day = /* @__PURE__ */ new Map();
			days.set(bar.day, day);
		}
		day.set(slot, bar);
	}
	const full = [];
	for (const day of [...days.keys()].sort()) {
		const slots = days.get(day);
		if (!slots || slots.size !== SESSION_BARS) continue;
		const row = [];
		let ok = true;
		for (let i = 0; i < SESSION_BARS; i++) {
			const bar = slots.get(i);
			if (!bar) {
				ok = false;
				break;
			}
			row.push(bar);
		}
		if (ok) full.push({
			day,
			bars: row
		});
	}
	return full;
}
function timeMachine(args) {
	const replays = args.replays ?? 1e4;
	const sessions = groupSessions(args.bars).filter((s) => s.day < args.day);
	if (sessions.length < 3) return { error: `Only ${sessions.length} full sessions in the tape. Not enough to replay.` };
	const pool = Array.from({ length: SESSION_BARS }, () => []);
	for (const session of sessions) for (let i = 1; i < SESSION_BARS; i++) {
		const prev = session.bars[i - 1];
		const bar = session.bars[i];
		if (!prev || !bar || !prev.c) continue;
		pool[i]?.push([
			bar.o / prev.c,
			bar.h / prev.c,
			bar.l / prev.c,
			bar.c / prev.c
		]);
	}
	const last = 76;
	const k = args.barIndex;
	if (k >= last) return { error: "No bars left after the entry." };
	const risk = args.entry - args.stop;
	if (risk <= 0) return { error: "Stop is not under the entry." };
	const rTarget = (args.target - args.entry) / risk;
	function slot(rng, i) {
		const jitter = Math.floor(rng() * 5) - 2;
		return Math.min(77, Math.max(1, i + jitter));
	}
	let seed = 19;
	const rng = () => {
		seed = seed * 1664525 + 1013904223 >>> 0;
		return seed / 4294967296;
	};
	const outcomes = [];
	const closes = [];
	for (let n = 0; n < replays; n++) {
		let price = args.entry;
		let outcome = null;
		for (let i = k + 1; i <= last; i++) {
			const draw = pool[slot(rng, i)];
			if (!draw?.length) continue;
			const pick = draw[Math.floor(rng() * draw.length)];
			if (!pick) continue;
			const hi = price * pick[1];
			const lo = price * pick[2];
			const cl = price * pick[3];
			if (!outcome) {
				if (lo <= args.stop) outcome = "stop";
				else if (hi >= args.target) outcome = "target";
			}
			price = cl;
		}
		outcomes.push(outcome ?? "close");
		closes.push(price);
	}
	const count = (name) => outcomes.filter((o) => o === name).length;
	const pTarget = count("target") / replays;
	const pStop = count("stop") / replays;
	const pNeither = count("close") / replays;
	let rSum = 0;
	for (let i = 0; i < outcomes.length; i++) {
		const outcome = outcomes[i];
		const close = closes[i] ?? args.entry;
		if (outcome === "target") rSum += rTarget;
		else if (outcome === "stop") rSum += -1;
		else rSum += (close - args.entry) / risk;
	}
	const avgR = rSum / replays;
	let historyTarget = 0;
	let historyStop = 0;
	let historyClose = 0;
	for (const session of sessions) {
		const range = session.bars.slice(0, 3);
		const orHigh = Math.max(...range.map((b) => b.h));
		const orLow = Math.min(...range.map((b) => b.l));
		let kk = -1;
		for (let i = 3; i <= last; i++) {
			const bar = session.bars[i];
			if (bar && bar.c > orHigh) {
				kk = i;
				break;
			}
		}
		if (kk < 0) continue;
		const entry = session.bars[kk]?.c ?? 0;
		const stop = Math.floor((orHigh + orLow) / 2 * 100) / 100;
		const riskH = entry - stop;
		if (riskH <= 0) continue;
		const target = Math.round((entry + rTarget * riskH) * 100) / 100;
		let outcome = null;
		for (let i = kk + 1; i <= last; i++) {
			const bar = session.bars[i];
			if (!bar) continue;
			if (bar.l <= stop) {
				outcome = "stop";
				break;
			}
			if (bar.h >= target) {
				outcome = "target";
				break;
			}
		}
		if (outcome === "target") historyTarget += 1;
		else if (outcome === "stop") historyStop += 1;
		else historyClose += 1;
	}
	const triggered = historyTarget + historyStop + historyClose;
	let verdict;
	const side = pTarget + pStop;
	if (side <= 0) verdict = "No replay reached the target or the stop by 3:55 PM.";
	else {
		const gap = pTarget / side - 1 / (1 + rTarget);
		verdict = `${Math.abs(gap) < COIN_FLIP ? "Close to a coin flip" : Math.abs(gap) < STRONG ? gap > 0 ? "Leans toward the target" : "Leans toward the stop" : gap > 0 ? "Strongly toward the target" : "Strongly toward the stop"}: target first ${(pTarget * 100).toFixed(1)}% vs stop first ${(pStop * 100).toFixed(1)}%.`;
	}
	const note = pNeither > MANY_NEITHER ? `${(pNeither * 100).toFixed(1)}% of the replays hit neither by 3:55 PM. That is a simulation, not a prediction.` : "A simulation from this stock's own recent bars, not a prediction.";
	return {
		symbol: args.symbol,
		sessions: sessions.length,
		replays,
		pTarget,
		pStop,
		pNeither,
		avgR: Math.round(avgR * 1e3) / 1e3,
		historyTriggered: triggered,
		historyTarget,
		historyStop,
		historyClose,
		verdict,
		note
	};
}
function markOf(chart, day, cutoffMin, fallback) {
	if (!chart) return fallback;
	const bars = sessionBars(chart, day, cutoffMin, closeMin(day));
	const last = bars[bars.length - 1];
	return last ? fromCents(cents(last.c)) : fallback;
}
function sessionDays(charts) {
	const counts = /* @__PURE__ */ new Map();
	for (const chart of charts) {
		const seen = /* @__PURE__ */ new Set();
		for (const bar of chart.m5) if (bar.startMin === 570) seen.add(bar.day);
		for (const day of seen) counts.set(day, (counts.get(day) ?? 0) + 1);
	}
	return [...counts.entries()].sort((a, b) => a[0] < b[0] ? 1 : -1);
}
//#endregion
export { sessionBars as _, dayFromUnix as a, timeMachine as b, fromCents as c, listDaily as d, listOrb as f, runCycle as g, nyNow as h, closeMin as i, isHoliday as l, money as m, cents as n, defaultConfig as o, markOf as p, clockLabel as r, freshBook as s, SETUP_LABEL as t, isWeekday as u, sessionDays as v, sessionOpen as y };
