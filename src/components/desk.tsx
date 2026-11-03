import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  clockLabel,
  closeMin,
  isHoliday,
  isWeekday,
  nyNow,
  sessionOpen,
  type NyStamp,
} from "@/lib/trader/clock";
import {
  SETUP_LABEL,
  listDaily,
  listOrb,
  markOf,
  money,
  runCycle,
  sessionBars,
  sessionDays,
} from "@/lib/trader/engine";
import { loadTape, replayOdds } from "@/lib/trader/market";
import { useDesk } from "@/lib/trader/store";
import type { Chart, DailyHit, OrbHit, Ticket, TmReport } from "@/lib/trader/types";

function dataCutoff(charts: Chart[], day: string) {
  let max = 0;
  for (const chart of charts) {
    for (const bar of chart.m5) {
      if (bar.day === day) max = Math.max(max, bar.startMin + 5);
    }
  }
  return max ? Math.min(max, closeMin(day)) : 0;
}

function todayDone(now: NyStamp) {
  if (!isWeekday(now.key) || isHoliday(now.key)) return true;
  return now.minutes >= closeMin(now.key);
}

export function Desk() {
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

  const [stamp, setStamp] = useState<NyStamp | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [status, setStatus] = useState("The desk reads free Yahoo charts. They can lag.");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState("");
  const [reviewCutoff, setReviewCutoff] = useState(0);
  const [tapeCutoff, setTapeCutoff] = useState<number | null>(null);
  const [running, setRunning] = useState<"off" | "tape" | "live">("off");
  const [hits, setHits] = useState<OrbHit[]>([]);
  const [daily, setDaily] = useState<DailyHit[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [selected, setSelected] = useState("TSLA");
  const [tm, setTm] = useState<TmReport | { error: string } | null>(null);
  const [symbolText, setSymbolText] = useState(config.symbols.join(", "));

  const ticketRef = useRef<Ticket | null>(null);
  const chartsRef = useRef(charts);
  const dayRef = useRef(day);
  const maxRef = useRef(0);
  const cutoffRef = useRef<number | null>(null);
  ticketRef.current = ticket;
  chartsRef.current = charts;
  dayRef.current = day;
  cutoffRef.current = tapeCutoff;

  useEffect(() => {
    const tick = () => setStamp(nyNow());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      await useDesk.persist.rehydrate();
      if (cancel) return;
      const symbols = useDesk.getState().config.symbols;
      setSymbolText(symbols.join(", "));
      await readCharts(symbols);
    })();
    return () => {
      cancel = true;
    };
    // first paint only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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
        intent: "mark",
      });
      state.replaceBook(cycle.book);
      setTicket(cycle.ticket);
      setHits(cycle.hits);
      setTapeCutoff(next);
      if (cycle.banner) setBanner(cycle.banner);
      if (cycle.ticket) void loadOdds(cycle.ticket);
    }, 900);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
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
          intent: "mark",
        });
        state.replaceBook(cycle.book);
        setDay(now.key);
        setReviewCutoff(now.minutes);
        setHits(cycle.hits);
        setTicket(cycle.ticket);
        setStatus(`${loaded.fetched} of ${loaded.requested} charts · live session`);
        if (cycle.banner) setBanner(cycle.banner);
        if (cycle.ticket) void loadOdds(cycle.ticket);
      } catch (err) {
        if (!stop) setBanner(err instanceof Error ? err.message : "Live read failed.");
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 25000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [running]);

  async function readCharts(symbols: string[]) {
    setLoading(true);
    setError(null);
    setRunning("off");
    try {
      const loaded = await loadTape({ data: { symbols } });
      const now = nyNow();
      const days = sessionDays(loaded.charts);
      const live = sessionOpen(now.key, now.minutes) && days.some(([key]) => key === now.key);
      const picked = live ? now.key : (days[0]?.[0] ?? "");
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
      setStatus(
        `${loaded.fetched} of ${loaded.requested} charts · ${live ? "session is open" : "market closed, showing the last session"}`,
      );
      setSelected((cur) =>
        loaded.charts.some((chart) => chart.symbol === cur) ? cur : (loaded.charts.find((c) => !c.error)?.symbol ?? "TSLA"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read charts.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOdds(next: Ticket) {
    const report = await replayOdds({
      data: {
        symbol: next.symbol,
        day: next.day,
        barIndex: next.barIndex,
        entry: next.entry,
        stop: next.stop,
        target: next.target,
      },
    });
    setTm(report);
  }

  function startTape() {
    if (!day) return;
    const max = dataCutoff(charts, day);
    maxRef.current = max;
    if (max < 9 * 60 + 50) {
      setBanner("Not enough of that session to replay.");
      return;
    }
    useDesk.getState().beginSession(day);
    setTicket(null);
    cutoffRef.current = 9 * 60 + 45;
    setTapeCutoff(9 * 60 + 45);
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
      intent: "approve",
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
      intent: "reject",
    });
    state.replaceBook(cycle.book);
    setTicket(cycle.ticket);
    setHits(cycle.hits);
    if (cycle.banner) setBanner(cycle.banner);
  }

  const activeCutoff = running === "tape" && tapeCutoff != null ? tapeCutoff : reviewCutoff;
  const chart = charts.find((item) => item.symbol === selected);
  const bars = chart && day ? sessionBars(chart, day, activeCutoff || closeMin(day), closeMin(day)) : [];
  const chartRows = bars.map((bar) => ({
    time: clockLabel(bar.startMin + 5),
    close: Math.round(bar.c * 100) / 100,
  }));
  const focus = ticket?.symbol === selected ? ticket : positions.find((pos) => pos.symbol === selected);
  const realized = closed.reduce((sum, trade) => sum + trade.pnl, 0);
  const openPnl = positions.reduce((sum, pos) => {
    const mark = markOf(
      charts.find((item) => item.symbol === pos.symbol),
      day,
      activeCutoff || reviewCutoff,
      pos.entry,
    );
    return sum + (mark - pos.entry) * pos.qty;
  }, 0);
  const days = useMemo(() => sessionDays(charts), [charts]);
  const liveNow = stamp ? sessionOpen(stamp.key, stamp.minutes) : false;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-widest text-brass">PAPER DESK</p>
          <h1 className="text-3xl font-medium tracking-tight">PIT</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Scans opening-range breakouts, sets the stop before the entry, and can paper-fill on a loop. Not
            financial advice. No live broker.
          </p>
        </div>
        <div className="font-mono text-sm text-muted">
          <p>{stamp?.label ?? "New York clock"}</p>
          <p className={liveNow ? "text-up" : "text-ink"}>{liveNow ? "Session open" : "Session closed"}</p>
        </div>
      </header>

      <section className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" className="inline-flex h-11 items-center justify-center rounded-md bg-brass px-4 text-sm font-medium text-brass-ink disabled:opacity-40" onClick={startTape} disabled={!day || loading || running !== "off"}>
            {running === "tape" ? "Replaying" : "Run the tape"}
          </button>
          <button type="button" className="inline-flex h-11 items-center justify-center rounded-md border border-line bg-raised px-4 text-sm disabled:opacity-40" onClick={startLive} disabled={running !== "off" || loading}>
            {running === "live" ? "Following live" : "Follow live"}
          </button>
          <button type="button" className="inline-flex h-11 items-center justify-center rounded-md border border-line bg-raised px-4 text-sm disabled:opacity-40" onClick={() => setRunning("off")} disabled={running === "off"}>
            Stop
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={autopilot}
            onClick={() => setAutopilot(!autopilot)}
            className="inline-flex h-11 items-center justify-center rounded-md border border-line bg-raised px-4 text-sm"
          >
            Paper autopilot {autopilot ? "on" : "off"}
          </button>
        </div>
        <p className="text-sm text-muted">
          {status}
          {running === "tape" && tapeCutoff != null ? ` · tape ${clockLabel(tapeCutoff)}` : ""}
          {day ? ` · ${day}` : ""}
        </p>
        {banner ? <p className="text-sm text-ink">{banner}</p> : null}
        {error ? <p className="text-sm text-down">{error}</p> : null}
        <p className="text-xs text-muted">
          Autopilot fills a passing paper ticket by itself. Off, each ticket waits for your yes. The loop runs
          only while this page is open.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,280px)]">
        <section className="order-2 min-w-0 rounded-md border border-line bg-surface p-3 lg:order-1">
          <h2 className="text-sm font-medium">Opening range</h2>
          <p className="mt-1 text-xs text-muted">
            {hits.length
              ? `${hits.length} charts closed above the 15-minute range. A match is not a buy.`
              : loading
                ? "Reading the tape."
                : "No completed breakout at this clock yet."}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {hits.slice(0, 12).map((hit) => (
              <li key={`${hit.symbol}-${hit.atMin}`}>
                <button
                  type="button"
                  onClick={() => setSelected(hit.symbol)}
                  className={`flex w-full flex-col rounded-md border px-3 py-2 text-left ${selected === hit.symbol ? "border-brass bg-raised" : "border-line bg-bg"}`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-sm">{hit.symbol}</span>
                    <span className="font-mono text-sm">{money(hit.price)}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {clockLabel(hit.atMin)} · +{hit.pctOver.toFixed(2)}% over {money(hit.orHigh)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="order-1 min-w-0 flex flex-col gap-4 lg:order-2">
          <div className="rounded-md border border-line bg-surface p-3">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-mono text-sm">{selected || "Chart"}</h2>
              <p className="text-xs text-muted">{chart?.error ? chart.error : day ? `5-minute closes · ${day}` : "Waiting for bars"}</p>
            </div>
            <div className="h-56 w-full min-w-0">
              {chartRows.length > 2 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "var(--color-muted)", fontSize: 11 }} interval={Math.ceil(chartRows.length / 6)} axisLine={false} tickLine={false} />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: "var(--color-muted)", fontSize: 11 }} width={56} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--color-raised)", border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
                      formatter={(value) => [typeof value === "number" ? money(value) : String(value), "Close"]}
                    />
                    {focus ? <ReferenceLine y={focus.stop} stroke="var(--color-down)" strokeDasharray="3 3" /> : null}
                    {focus ? <ReferenceLine y={focus.target} stroke="var(--color-up)" strokeDasharray="3 3" /> : null}
                    <Line type="monotone" dataKey="close" stroke="var(--color-brass)" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="pt-16 text-center text-sm text-muted">{loading ? "Loading the session." : "No bars for this symbol yet."}</p>
              )}
            </div>
          </div>

          <div className="rounded-md border border-line bg-surface p-3">
            <h2 className="text-sm font-medium">Ticket</h2>
            {ticket ? (
              <div className="mt-2 flex flex-col gap-3">
                <p className="text-sm">
                  BUY {ticket.qty} {ticket.symbol}, paper, good for this replay. Entry {money(ticket.entry)} at{" "}
                  {clockLabel(ticket.atMin)}. Stop {money(ticket.stop)} at the range midpoint. Target {money(ticket.target)}{" "}
                  ({ticket.rr}R). Max loss at the stop {money(ticket.maxLoss)}, bound by {ticket.bound}.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" className="inline-flex h-11 items-center justify-center rounded-md bg-brass px-4 text-sm font-medium text-brass-ink" onClick={onApprove}>
                    Yes, paper fill
                  </button>
                  <button type="button" className="inline-flex h-11 items-center justify-center rounded-md border border-line bg-raised px-4 text-sm" onClick={onReject}>
                    Skip
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {autopilot
                  ? "No ticket waiting. Autopilot paper-fills the next one that passes the risk rules."
                  : "No ticket waiting. When a setup passes the rules, it stops here for a yes."}
              </p>
            )}
            {tm ? (
              <div className="mt-3 border-t border-line pt-3 text-sm">
                {"error" in tm ? (
                  <p className="text-muted">{tm.error}</p>
                ) : (
                  <>
                    <p>{tm.verdict}</p>
                    <p className="mt-1 text-xs text-muted">
                      {tm.replays.toLocaleString("en-US")} replays from {tm.sessions} sessions. The same rule fired{" "}
                      {tm.historyTriggered} times: {tm.historyTarget} target, {tm.historyStop} stop, {tm.historyClose} neither.
                      Average R {tm.avgR}. {tm.note}
                    </p>
                  </>
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-md border border-line bg-surface p-3">
            <h2 className="text-sm font-medium">Daily tags</h2>
            <p className="mt-1 text-xs text-muted">Close-only rules from the last six months. The bot does not trade these.</p>
            <ul className="mt-3 flex flex-col gap-2">
              {daily.slice(0, 6).map((hit) => (
                <li key={hit.symbol} className="flex items-baseline justify-between gap-3 text-sm">
                  <button type="button" className="font-mono" onClick={() => setSelected(hit.symbol)}>
                    {hit.symbol}
                  </button>
                  <span className="text-right text-xs text-muted">
                    {hit.setups.map((tag) => SETUP_LABEL[tag]).join(" · ")}
                  </span>
                </li>
              ))}
              {!daily.length ? <li className="text-sm text-muted">{loading ? "Checking daily closes." : "No daily rule matched this list."}</li> : null}
            </ul>
          </div>
        </section>

        <section className="order-3 min-w-0 flex flex-col gap-4">
          <div className="rounded-md border border-line bg-surface p-3">
            <h2 className="text-sm font-medium">Paper book</h2>
            <p className="mt-2 font-mono text-2xl">{money(cash)}</p>
            <p className="text-xs text-muted">
              Cash · paper P&L {money(realized + openPnl)} · {tradesToday} of {config.maxTradesPerDay} entries
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {positions.map((pos) => {
                const mark = markOf(
                  charts.find((item) => item.symbol === pos.symbol),
                  day,
                  activeCutoff || reviewCutoff,
                  pos.entry,
                );
                const pnl = (mark - pos.entry) * pos.qty;
                return (
                  <li key={pos.id} className="rounded-md border border-line bg-bg px-3 py-2 text-sm">
                    <span className="flex justify-between font-mono">
                      <span>{pos.qty} {pos.symbol}</span>
                      <span className={pnl >= 0 ? "text-up" : "text-down"}>{money(pnl)}</span>
                    </span>
                    <span className="text-xs text-muted">
                      {money(pos.entry)} · stop {money(pos.stop)} · target {money(pos.target)}
                    </span>
                  </li>
                );
              })}
              {!positions.length ? <li className="text-sm text-muted">Flat.</li> : null}
            </ul>
            {closed[0] ? (
              <p className="mt-3 text-xs text-muted">
                Last close {closed[0].symbol} {closed[0].reason} {money(closed[0].pnl)}
              </p>
            ) : null}
            <button type="button" className="mt-3 inline-flex h-11 items-center justify-center rounded-md border border-line px-4 text-sm" onClick={() => resetBook()}>
              Reset paper book
            </button>
          </div>

          <div className="rounded-md border border-line bg-surface p-3">
            <h2 className="text-sm font-medium">Tape</h2>
            <ul className="mt-2 flex max-h-64 flex-col gap-2 overflow-auto">
              {log.map((item) => (
                <li key={item.id} className="text-xs leading-relaxed text-muted">
                  {item.text}
                </li>
              ))}
              {!log.length ? <li className="text-xs text-muted">The bot writes each decision here.</li> : null}
            </ul>
          </div>
        </section>
      </div>

      <details className="rounded-md border border-line bg-surface p-3">
        <summary className="cursor-pointer text-sm font-medium">Rules</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Budget
            <input
              className="h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink"
              inputMode="decimal"
              value={config.budget}
              onChange={(event) => setConfig({ budget: Number(event.target.value) || 0 })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Max loss per trade
            <input
              className="h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink"
              inputMode="decimal"
              value={config.maxLossPerTrade}
              onChange={(event) => setConfig({ maxLossPerTrade: Number(event.target.value) || 0 })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Max planned loss per day
            <input
              className="h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink"
              inputMode="decimal"
              value={config.maxDailyLoss}
              onChange={(event) => setConfig({ maxDailyLoss: Number(event.target.value) || 0 })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Trades per day
            <input
              className="h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink"
              inputMode="numeric"
              value={config.maxTradesPerDay}
              onChange={(event) => setConfig({ maxTradesPerDay: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Target
            <select
              className="h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink"
              value={config.targetR}
              onChange={(event) => setConfig({ targetR: event.target.value === "2" ? 2 : 1 })}
            >
              <option value="1">1R</option>
              <option value="2">2R</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
            Tickers, up to 20
            <input
              className="h-11 rounded-md border border-line bg-bg px-3 text-sm text-ink"
              value={symbolText}
              onChange={(event) => setSymbolText(event.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">
          Cash buffer {config.cashBufferPct}%. Position cap {config.maxPositionPct}%. No new entries before 9:45 AM or
          after 3:30 PM ET. Flat by 3:55 PM. Long shares only.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-md bg-brass px-4 text-sm font-medium text-brass-ink"
            onClick={() => {
              const symbols = [
                ...new Set(
                  symbolText
                    .toUpperCase()
                    .split(/[^A-Z.]+/)
                    .map((s) => s.slice(0, 6))
                    .filter(Boolean),
                ),
              ].slice(0, 20);
              if (!symbols.length) return;
              setConfig({ symbols });
              void readCharts(symbols);
            }}
          >
            Save and reload
          </button>
          {days.length > 1 ? (
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-md border border-line px-4 text-sm"
              onClick={() => {
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
              }}
            >
              Show another session
            </button>
          ) : null}
        </div>
      </details>
    </main>
  );
}
