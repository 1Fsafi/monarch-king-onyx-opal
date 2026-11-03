import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { _ as sessionBars, c as fromCents, d as listDaily, f as listOrb, g as runCycle, h as nyNow, i as closeMin, l as isHoliday, m as money, n as cents, o as defaultConfig, p as markOf, r as clockLabel, s as freshBook, t as SETUP_LABEL, u as isWeekday, v as sessionDays, y as sessionOpen } from "./engine-LGhOn8mn.mjs";
import { a as CartesianGrid, c as Tooltip, i as Line, n as YAxis, o as ReferenceLine, r as XAxis, s as ResponsiveContainer, t as LineChart } from "../_libs/recharts+[...].mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-46qysGj6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function cleanSymbol(raw) {
	return raw.toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 6);
}
var loadTape = createServerFn({ method: "POST" }).validator((input) => {
	const symbols = [...new Set((input?.symbols ?? []).map(cleanSymbol).filter((s) => s.length >= 1))].slice(0, 20);
	if (!symbols.length) throw new Error("Add at least one ticker.");
	return { symbols };
}).handler(createSsrRpc("a8415ce3df0b2dae01bf52341ea6dfd7e6db87998e2baf285f2719a737c544d3"));
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
}).handler(createSsrRpc("dbd76fe5643a89b2cd11ad52b82e64ef16e2ad191b2b03719adcc23dde3de9ba"));
var useDesk = create()(persist((set) => ({
	...freshBook(),
	config: defaultConfig(),
	autopilot: false,
	setConfig: (patch) => set((state) => ({ config: {
		...state.config,
		...patch
	} })),
	setAutopilot: (autopilot) => set({ autopilot }),
	replaceBook: (book) => set(book),
	beginSession: (day) => set((state) => {
		let cash = cents(state.cash);
		const closed = [...state.closed];
		for (const pos of state.positions) {
			cash += pos.qty * cents(pos.entry);
			closed.unshift({
				id: pos.id,
				symbol: pos.symbol,
				qty: pos.qty,
				entry: pos.entry,
				exit: pos.entry,
				reason: "scratch",
				pnl: 0,
				day: pos.day
			});
		}
		return {
			cash: fromCents(cash),
			positions: [],
			closed: closed.slice(0, 30),
			tradesToday: 0,
			riskUsed: 0,
			skipped: [],
			bookDay: day
		};
	}),
	resetBook: () => set((state) => ({
		...freshBook(state.config.budget),
		config: state.config,
		autopilot: state.autopilot
	}))
}), {
	name: "pit-paper-desk",
	skipHydration: true,
	partialize: (state) => ({
		cash: state.cash,
		positions: state.positions,
		closed: state.closed,
		tradesToday: state.tradesToday,
		riskUsed: state.riskUsed,
		bookDay: state.bookDay,
		skipped: state.skipped,
		log: state.log,
		seq: state.seq,
		config: state.config,
		autopilot: state.autopilot
	}),
	merge: (persisted, current) => {
		const saved = persisted ?? {};
		return {
			...current,
			...saved,
			config: {
				...current.config,
				...saved.config,
				symbols: saved.config?.symbols?.length ? saved.config.symbols : current.config.symbols
			},
			positions: saved.positions ?? [],
			closed: saved.closed ?? [],
			log: saved.log ?? [],
			skipped: saved.skipped ?? []
		};
	}
}));
function dataCutoff(charts, day) {
	let max = 0;
	for (const chart of charts) for (const bar of chart.m5) if (bar.day === day) max = Math.max(max, bar.startMin + 5);
	return max ? Math.min(max, closeMin(day)) : 0;
}
function todayDone(now) {
	if (!isWeekday(now.key) || isHoliday(now.key)) return true;
	return now.minutes >= closeMin(now.key);
}
function Desk() {
	const config = useDesk((s) => s.config);
	const autopilot = useDesk((s) => s.autopilot);
	const cash = useDesk((s) => s.cash);
	const positions = useDesk((s) => s.positions);
	const closed = useDesk((s) => s.closed);
	const tradesToday = useDesk((s) => s.tradesToday);
	const log = useDesk((s) => s.log);
	const setConfig = useDesk((s) => s.setConfig);
	const setAutopilot = useDesk((s) => s.setAutopilot);
	const resetBook = useDesk((s) => s.resetBook);
	const [stamp, setStamp] = (0, import_react.useState)(null);
	const [charts, setCharts] = (0, import_react.useState)([]);
	const [status, setStatus] = (0, import_react.useState)("The desk reads free Yahoo charts. They can lag.");
	const [error, setError] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [day, setDay] = (0, import_react.useState)("");
	const [reviewCutoff, setReviewCutoff] = (0, import_react.useState)(0);
	const [tapeCutoff, setTapeCutoff] = (0, import_react.useState)(null);
	const [running, setRunning] = (0, import_react.useState)("off");
	const [hits, setHits] = (0, import_react.useState)([]);
	const [daily, setDaily] = (0, import_react.useState)([]);
	const [ticket, setTicket] = (0, import_react.useState)(null);
	const [banner, setBanner] = (0, import_react.useState)(null);
	const [selected, setSelected] = (0, import_react.useState)("TSLA");
	const [tm, setTm] = (0, import_react.useState)(null);
	const [symbolText, setSymbolText] = (0, import_react.useState)(config.symbols.join(", "));
	const ticketRef = (0, import_react.useRef)(null);
	const chartsRef = (0, import_react.useRef)(charts);
	const dayRef = (0, import_react.useRef)(day);
	const maxRef = (0, import_react.useRef)(0);
	const cutoffRef = (0, import_react.useRef)(null);
	ticketRef.current = ticket;
	chartsRef.current = charts;
	dayRef.current = day;
	cutoffRef.current = tapeCutoff;
	(0, import_react.useEffect)(() => {
		const tick = () => setStamp(nyNow());
		tick();
		const id = setInterval(tick, 1e3);
		return () => clearInterval(id);
	}, []);
	(0, import_react.useEffect)(() => {
		let cancel = false;
		(async () => {
			await useDesk.persist.rehydrate();
			if (cancel) return;
			const symbols = useDesk.getState().config.symbols;
			setSymbolText(symbols.join(", "));
			await readCharts(symbols);
		})();
		return () => {
			cancel = true;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (running !== "tape") return;
		const id = setInterval(() => {
			const currentDay = dayRef.current;
			const max = maxRef.current;
			const cutoff = cutoffRef.current;
			if (cutoff == null) return;
			if (cutoff >= max) {
				setRunning("off");
				setBanner("Tape caught up. Nothing here is a live order.");
				return;
			}
			const next = Math.min(max, cutoff + 5);
			cutoffRef.current = next;
			const state = useDesk.getState();
			const cycle = runCycle({
				book: state,
				charts: chartsRef.current,
				day: currentDay,
				cutoffMin: next,
				config: state.config,
				autopilot: state.autopilot,
				pending: ticketRef.current,
				intent: "mark"
			});
			state.replaceBook(cycle.book);
			setTicket(cycle.ticket);
			setHits(cycle.hits);
			setTapeCutoff(next);
			if (cycle.banner) setBanner(cycle.banner);
			if (cycle.ticket) loadOdds(cycle.ticket);
		}, 900);
		return () => clearInterval(id);
	}, [running]);
	(0, import_react.useEffect)(() => {
		if (running !== "live") return;
		let stop = false;
		const tick = async () => {
			const now = nyNow();
			if (!sessionOpen(now.key, now.minutes)) {
				if (!stop) {
					setRunning("off");
					setBanner("The market is closed, so the live loop stopped.");
				}
				return;
			}
			try {
				const symbols = useDesk.getState().config.symbols;
				const loaded = await loadTape({ data: { symbols } });
				if (stop) return;
				setCharts(loaded.charts);
				const state = useDesk.getState();
				const cycle = runCycle({
					book: state,
					charts: loaded.charts,
					day: now.key,
					cutoffMin: now.minutes,
					config: state.config,
					autopilot: state.autopilot,
					pending: ticketRef.current,
					intent: "mark"
				});
				state.replaceBook(cycle.book);
				setDay(now.key);
				setReviewCutoff(now.minutes);
				setHits(cycle.hits);
				setTicket(cycle.ticket);
				setStatus(`${loaded.fetched} of ${loaded.requested} charts · live session`);
				if (cycle.banner) setBanner(cycle.banner);
				if (cycle.ticket) loadOdds(cycle.ticket);
			} catch (err) {
				if (!stop) setBanner(err instanceof Error ? err.message : "Live read failed.");
			}
		};
		tick();
		const id = setInterval(() => void tick(), 25e3);
		return () => {
			stop = true;
			clearInterval(id);
		};
	}, [running]);
	async function readCharts(symbols) {
		setLoading(true);
		setError(null);
		setRunning("off");
		try {
			const loaded = await loadTape({ data: { symbols } });
			const now = nyNow();
			const days = sessionDays(loaded.charts);
			const live = sessionOpen(now.key, now.minutes) && days.some(([key]) => key === now.key);
			const picked = live ? now.key : days[0]?.[0] ?? "";
			if (!picked) {
				setError("No session bars came back.");
				setCharts(loaded.charts);
				return;
			}
			const cutoff = live ? now.minutes : dataCutoff(loaded.charts, picked);
			setCharts(loaded.charts);
			setDay(picked);
			setReviewCutoff(cutoff);
			setTapeCutoff(null);
			setTicket(null);
			setHits(listOrb(loaded.charts, picked, cutoff));
			setDaily(listDaily(loaded.charts, now.key, todayDone(now)));
			setStatus(`${loaded.fetched} of ${loaded.requested} charts · ${live ? "session is open" : "market closed, showing the last session"}`);
			setSelected((cur) => loaded.charts.some((chart) => chart.symbol === cur) ? cur : loaded.charts.find((c) => !c.error)?.symbol ?? "TSLA");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not read charts.");
		} finally {
			setLoading(false);
		}
	}
	async function loadOdds(next) {
		const report = await replayOdds({ data: {
			symbol: next.symbol,
			day: next.day,
			barIndex: next.barIndex,
			entry: next.entry,
			stop: next.stop,
			target: next.target
		} });
		setTm(report);
	}
	function startTape() {
		if (!day) return;
		const max = dataCutoff(charts, day);
		maxRef.current = max;
		if (max < 590) {
			setBanner("Not enough of that session to replay.");
			return;
		}
		useDesk.getState().beginSession(day);
		setTicket(null);
		cutoffRef.current = 585;
		setTapeCutoff(585);
		setHits([]);
		setRunning("tape");
		setBanner(`Replaying ${day} from 9:45 AM ET. Paper book only.`);
	}
	function startLive() {
		const now = nyNow();
		if (!sessionOpen(now.key, now.minutes)) {
			setBanner("The live loop only runs while the New York session is open. Replay the tape instead.");
			return;
		}
		setRunning("live");
		setBanner("Following the live session. Paper only, and only while this page stays open.");
	}
	function onApprove() {
		if (!ticket || !day) return;
		const cutoff = running === "tape" && tapeCutoff != null ? tapeCutoff : reviewCutoff;
		const state = useDesk.getState();
		const cycle = runCycle({
			book: state,
			charts,
			day,
			cutoffMin: cutoff,
			config: state.config,
			autopilot: false,
			pending: ticket,
			intent: "approve"
		});
		state.replaceBook(cycle.book);
		setTicket(cycle.ticket);
		setHits(cycle.hits);
		if (cycle.banner) setBanner(cycle.banner);
	}
	function onReject() {
		if (!ticket || !day) return;
		const cutoff = running === "tape" && tapeCutoff != null ? tapeCutoff : reviewCutoff;
		const state = useDesk.getState();
		const cycle = runCycle({
			book: state,
			charts,
			day,
			cutoffMin: cutoff,
			config: state.config,
			autopilot: false,
			pending: ticket,
			intent: "reject"
		});
		state.replaceBook(cycle.book);
		setTicket(cycle.ticket);
		setHits(cycle.hits);
		if (cycle.banner) setBanner(cycle.banner);
	}
	const activeCutoff = running === "tape" && tapeCutoff != null ? tapeCutoff : reviewCutoff;
	const chart = charts.find((item) => item.symbol === selected);
	const chartRows = (chart && day ? sessionBars(chart, day, activeCutoff || closeMin(day), closeMin(day)) : []).map((bar) => ({
		time: clockLabel(bar.startMin + 5),
		close: Math.round(bar.c * 100) / 100
	}));
	const focus = ticket?.symbol === selected ? ticket : positions.find((pos) => pos.symbol === selected);
	const realized = closed.reduce((sum, trade) => sum + trade.pnl, 0);
	const openPnl = positions.reduce((sum, pos) => {
		return sum + (markOf(charts.find((item) => item.symbol === pos.symbol), day, activeCutoff || reviewCutoff, pos.entry) - pos.entry) * pos.qty;
	}, 0);
	const days = (0, import_react.useMemo)(() => sessionDays(charts), [charts]);
	const liveNow = stamp ? sessionOpen(stamp.key, stamp.minutes) : false;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-xs tracking-widest text-brass",
						children: "PAPER DESK"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-3xl font-medium tracking-tight",
						children: "PIT"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 max-w-xl text-sm text-muted",
						children: "Scans opening-range breakouts, sets the stop before the entry, and can paper-fill on a loop. Not financial advice. No live broker."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "font-mono text-sm text-muted",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: stamp?.label ?? "New York clock" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: liveNow ? "text-up" : "text-ink",
						children: liveNow ? "Session open" : "Session closed"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-3 rounded-md border border-line bg-surface p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2 sm:flex-row sm:flex-wrap",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "inline-flex h-11 items-center justify-center rounded-md bg-brass px-4 text-sm font-medium text-brass-ink disabled:opacity-40",
								onClick: startTape,
								disabled: !day || loading || running !== "off",
								children: running === "tape" ? "Replaying" : "Run the tape"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "inline-flex h-11 items-center justify-center rounded-md border border-line bg-raised px-4 text-sm disabled:opacity-40",
								onClick: startLive,
								disabled: running !== "off" || loading,
								children: running === "live" ? "Following live" : "Follow live"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "inline-flex h-11 items-center justify-center rounded-md border border-line bg-raised px-4 text-sm disabled:opacity-40",
								onClick: () => setRunning("off"),
								disabled: running === "off",
								children: "Stop"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "switch",
								"aria-checked": autopilot,
								onClick: () => setAutopilot(!autopilot),
								className: "inline-flex h-11 items-center justify-center rounded-md border border-line bg-raised px-4 text-sm",
								children: ["Paper autopilot ", autopilot ? "on" : "off"]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							status,
							running === "tape" && tapeCutoff != null ? ` · tape ${clockLabel(tapeCutoff)}` : "",
							day ? ` · ${day}` : ""
						]
					}),
					banner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-ink",
						children: banner
					}) : null,
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-down",
						children: error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Autopilot fills a passing paper ticket by itself. Off, each ticket waits for your yes. The loop runs only while this page is open."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,280px)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "order-2 min-w-0 rounded-md border border-line bg-surface p-3 lg:order-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-medium",
								children: "Opening range"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted",
								children: hits.length ? `${hits.length} charts closed above the 15-minute range. A match is not a buy.` : loading ? "Reading the tape." : "No completed breakout at this clock yet."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-3 flex flex-col gap-2",
								children: hits.slice(0, 12).map((hit) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setSelected(hit.symbol),
									className: `flex w-full flex-col rounded-md border px-3 py-2 text-left ${selected === hit.symbol ? "border-brass bg-raised" : "border-line bg-bg"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex items-baseline justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono text-sm",
											children: hit.symbol
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono text-sm",
											children: money(hit.price)
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-xs text-muted",
										children: [
											clockLabel(hit.atMin),
											" · +",
											hit.pctOver.toFixed(2),
											"% over ",
											money(hit.orHigh)
										]
									})]
								}) }, `${hit.symbol}-${hit.atMin}`))
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "order-1 min-w-0 flex flex-col gap-4 lg:order-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-md border border-line bg-surface p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-2 flex items-baseline justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "font-mono text-sm",
										children: selected || "Chart"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted",
										children: chart?.error ? chart.error : day ? `5-minute closes · ${day}` : "Waiting for bars"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-56 w-full min-w-0",
									children: chartRows.length > 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
										width: "100%",
										height: "100%",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(LineChart, {
											data: chartRows,
											margin: {
												top: 8,
												right: 8,
												left: 0,
												bottom: 0
											},
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
													stroke: "var(--color-line)",
													vertical: false
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
													dataKey: "time",
													tick: {
														fill: "var(--color-muted)",
														fontSize: 11
													},
													interval: Math.ceil(chartRows.length / 6),
													axisLine: false,
													tickLine: false
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
													domain: ["auto", "auto"],
													tick: {
														fill: "var(--color-muted)",
														fontSize: 11
													},
													width: 56,
													axisLine: false,
													tickLine: false
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
													contentStyle: {
														background: "var(--color-raised)",
														border: "1px solid var(--color-line)",
														color: "var(--color-ink)"
													},
													formatter: (value) => [typeof value === "number" ? money(value) : String(value), "Close"]
												}),
												focus ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferenceLine, {
													y: focus.stop,
													stroke: "var(--color-down)",
													strokeDasharray: "3 3"
												}) : null,
												focus ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferenceLine, {
													y: focus.target,
													stroke: "var(--color-up)",
													strokeDasharray: "3 3"
												}) : null,
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
													type: "monotone",
													dataKey: "close",
													stroke: "var(--color-brass)",
													dot: false,
													strokeWidth: 2
												})
											]
										})
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "pt-16 text-center text-sm text-muted",
										children: loading ? "Loading the session." : "No bars for this symbol yet."
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-md border border-line bg-surface p-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-sm font-medium",
										children: "Ticket"
									}),
									ticket ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2 flex flex-col gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-sm",
											children: [
												"BUY ",
												ticket.qty,
												" ",
												ticket.symbol,
												", paper, good for this replay. Entry ",
												money(ticket.entry),
												" at",
												" ",
												clockLabel(ticket.atMin),
												". Stop ",
												money(ticket.stop),
												" at the range midpoint. Target ",
												money(ticket.target),
												" ",
												"(",
												ticket.rr,
												"R). Max loss at the stop ",
												money(ticket.maxLoss),
												", bound by ",
												ticket.bound,
												"."
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-2 sm:flex-row",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "inline-flex h-11 items-center justify-center rounded-md bg-brass px-4 text-sm font-medium text-brass-ink",
												onClick: onApprove,
												children: "Yes, paper fill"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "inline-flex h-11 items-center justify-center rounded-md border border-line bg-raised px-4 text-sm",
												onClick: onReject,
												children: "Skip"
											})]
										})]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-sm text-muted",
										children: autopilot ? "No ticket waiting. Autopilot paper-fills the next one that passes the risk rules." : "No ticket waiting. When a setup passes the rules, it stops here for a yes."
									}),
									tm ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-3 border-t border-line pt-3 text-sm",
										children: "error" in tm ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-muted",
											children: tm.error
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: tm.verdict }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mt-1 text-xs text-muted",
											children: [
												tm.replays.toLocaleString("en-US"),
												" replays from ",
												tm.sessions,
												" sessions. The same rule fired",
												" ",
												tm.historyTriggered,
												" times: ",
												tm.historyTarget,
												" target, ",
												tm.historyStop,
												" stop, ",
												tm.historyClose,
												" neither. Average R ",
												tm.avgR,
												". ",
												tm.note
											]
										})] })
									}) : null
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-md border border-line bg-surface p-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-sm font-medium",
										children: "Daily tags"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-xs text-muted",
										children: "Close-only rules from the last six months. The bot does not trade these."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
										className: "mt-3 flex flex-col gap-2",
										children: [daily.slice(0, 6).map((hit) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex items-baseline justify-between gap-3 text-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "font-mono",
												onClick: () => setSelected(hit.symbol),
												children: hit.symbol
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-right text-xs text-muted",
												children: hit.setups.map((tag) => SETUP_LABEL[tag]).join(" · ")
											})]
										}, hit.symbol)), !daily.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
											className: "text-sm text-muted",
											children: loading ? "Checking daily closes." : "No daily rule matched this list."
										}) : null]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "order-3 min-w-0 flex flex-col gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-md border border-line bg-surface p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-sm font-medium",
									children: "Paper book"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 font-mono text-2xl",
									children: money(cash)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-muted",
									children: [
										"Cash · paper P&L ",
										money(realized + openPnl),
										" · ",
										tradesToday,
										" of ",
										config.maxTradesPerDay,
										" entries"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
									className: "mt-3 flex flex-col gap-2",
									children: [positions.map((pos) => {
										const pnl = (markOf(charts.find((item) => item.symbol === pos.symbol), day, activeCutoff || reviewCutoff, pos.entry) - pos.entry) * pos.qty;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "rounded-md border border-line bg-bg px-3 py-2 text-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "flex justify-between font-mono",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
													pos.qty,
													" ",
													pos.symbol
												] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: pnl >= 0 ? "text-up" : "text-down",
													children: money(pnl)
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-xs text-muted",
												children: [
													money(pos.entry),
													" · stop ",
													money(pos.stop),
													" · target ",
													money(pos.target)
												]
											})]
										}, pos.id);
									}), !positions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
										className: "text-sm text-muted",
										children: "Flat."
									}) : null]
								}),
								closed[0] ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-3 text-xs text-muted",
									children: [
										"Last close ",
										closed[0].symbol,
										" ",
										closed[0].reason,
										" ",
										money(closed[0].pnl)
									]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "mt-3 inline-flex h-11 items-center justify-center rounded-md border border-line px-4 text-sm",
									onClick: () => resetBook(),
									children: "Reset paper book"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-md border border-line bg-surface p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-medium",
								children: "Tape"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "mt-2 flex max-h-64 flex-col gap-2 overflow-auto",
								children: [log.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "text-xs leading-relaxed text-muted",
									children: item.text
								}, item.id)), !log.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "text-xs text-muted",
									children: "The bot writes each decision here."
								}) : null]
							})]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "rounded-md border border-line bg-surface p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
						className: "cursor-pointer text-sm font-medium",
						children: "Rules"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex flex-col gap-1 text-xs text-muted",
								children: ["Budget", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink",
									inputMode: "decimal",
									value: config.budget,
									onChange: (event) => setConfig({ budget: Number(event.target.value) || 0 })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex flex-col gap-1 text-xs text-muted",
								children: ["Max loss per trade", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink",
									inputMode: "decimal",
									value: config.maxLossPerTrade,
									onChange: (event) => setConfig({ maxLossPerTrade: Number(event.target.value) || 0 })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex flex-col gap-1 text-xs text-muted",
								children: ["Max planned loss per day", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink",
									inputMode: "decimal",
									value: config.maxDailyLoss,
									onChange: (event) => setConfig({ maxDailyLoss: Number(event.target.value) || 0 })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex flex-col gap-1 text-xs text-muted",
								children: ["Trades per day", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink",
									inputMode: "numeric",
									value: config.maxTradesPerDay,
									onChange: (event) => setConfig({ maxTradesPerDay: Math.max(1, Math.floor(Number(event.target.value) || 1)) })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex flex-col gap-1 text-xs text-muted",
								children: ["Target", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									className: "h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink",
									value: config.targetR,
									onChange: (event) => setConfig({ targetR: event.target.value === "2" ? 2 : 1 }),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "1",
										children: "1R"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "2",
										children: "2R"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex flex-col gap-1 text-xs text-muted sm:col-span-2",
								children: ["Tickers, up to 20", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink",
									value: symbolText,
									onChange: (event) => setSymbolText(event.target.value)
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-xs text-muted",
						children: [
							"Cash buffer ",
							config.cashBufferPct,
							"%. Position cap ",
							config.maxPositionPct,
							"%. No new entries before 9:45 AM or after 3:30 PM ET. Flat by 3:55 PM. Long shares only."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-col gap-2 sm:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "inline-flex h-11 items-center justify-center rounded-md bg-brass px-4 text-sm font-medium text-brass-ink",
							onClick: () => {
								const symbols = [...new Set(symbolText.toUpperCase().split(/[^A-Z.]+/).map((s) => s.slice(0, 6)).filter(Boolean))].slice(0, 20);
								if (!symbols.length) return;
								setConfig({ symbols });
								readCharts(symbols);
							},
							children: "Save and reload"
						}), days.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "inline-flex h-11 items-center justify-center rounded-md border border-line px-4 text-sm",
							onClick: () => {
								const index = days.findIndex(([key]) => key === day);
								const prior = days[index + 1] ?? days[0];
								if (!prior) return;
								setRunning("off");
								setDay(prior[0]);
								const cutoff = dataCutoff(charts, prior[0]);
								setReviewCutoff(cutoff);
								setHits(listOrb(charts, prior[0], cutoff));
								setTicket(null);
								setTapeCutoff(null);
							},
							children: "Show another session"
						}) : null]
					})
				]
			})
		]
	});
}
var SplitComponent = Desk;
//#endregion
export { SplitComponent as component };
