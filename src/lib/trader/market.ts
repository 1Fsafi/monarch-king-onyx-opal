import { createServerFn } from "@tanstack/react-start";
import { dayFromUnix } from "./clock.ts";
import { timeMachine } from "./engine.ts";
import type { Chart, DailyBar, M5, TmReport } from "./types.ts";

const UA = "Mozilla/5.0 (compatible; PITPaperDesk/1.0)";

function cleanSymbol(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 6);
}

function yahooSymbol(symbol: string) {
  return symbol.replace(".", "-");
}

async function yahoo(url: string) {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  let last = "no response";
  for (const host of hosts) {
    const full = url.replace("query1.finance.yahoo.com", host);
    try {
      const res = await fetch(full, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(12000),
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
      return (await res.json()) as unknown;
    } catch (error) {
      last = error instanceof Error ? error.message : "fetch failed";
    }
  }
  throw new Error(last);
}

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseDaily(json: unknown, symbol: string): DailyBar[] {
  const root = json as { spark?: { result?: { symbol?: string; response?: unknown[] }[] } };
  const row = root.spark?.result?.find((item) => item.symbol === symbol) ?? root.spark?.result?.[0];
  const response = row?.response?.[0] as
    | { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }
    | undefined;
  const stamps = response?.timestamp ?? [];
  const closes = response?.indicators?.quote?.[0]?.close ?? [];
  const byDay = new Map<string, number>();
  for (let i = 0; i < stamps.length; i++) {
    const close = num(closes[i]);
    const stamp = stamps[i];
    if (close == null || stamp == null) continue;
    byDay.set(dayFromUnix(stamp).key, close);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, close]) => ({ day, close }));
}

function parseIntraday(json: unknown): { price: number; volume: number; m5: M5[] } | null {
  const root = json as {
    chart?: {
      result?: {
        meta?: { regularMarketPrice?: number; regularMarketVolume?: number };
        timestamp?: number[];
        indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[] };
      }[];
    };
  };
  const result = root.chart?.result?.[0];
  if (!result?.timestamp) return null;
  const quote = result.indicators?.quote?.[0];
  const m5: M5[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const stamp = result.timestamp[i];
    const close = num(quote?.close?.[i]);
    const high = num(quote?.high?.[i]);
    const low = num(quote?.low?.[i]);
    const open = num(quote?.open?.[i]);
    if (stamp == null || close == null || high == null || low == null || open == null) continue;
    const ny = dayFromUnix(stamp);
    m5.push({ day: ny.key, startMin: ny.minutes, o: open, h: high, l: low, c: close });
  }
  return {
    price: result.meta?.regularMarketPrice ?? m5[m5.length - 1]?.c ?? 0,
    volume: result.meta?.regularMarketVolume ?? 0,
    m5,
  };
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>) {
  const out: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
  return out;
}

export const loadTape = createServerFn({ method: "POST" })
  .validator((input: { symbols?: string[] }) => {
    const symbols = [...new Set((input?.symbols ?? []).map(cleanSymbol).filter((s) => s.length >= 1))].slice(0, 20);
    if (!symbols.length) throw new Error("Add at least one ticker.");
    return { symbols };
  })
  .handler(async ({ data }) => {
    const symbols = data.symbols;
    let daily = new Map<string, DailyBar[]>();
    try {
      const spark = await yahoo(
        `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${symbols.map(yahooSymbol).join(",")}&range=6mo&interval=1d`,
      );
      daily = new Map(symbols.map((symbol) => [symbol, parseDaily(spark, yahooSymbol(symbol))]));
    } catch {
      daily = new Map();
    }

    const charts = await mapPool(symbols, 4, async (symbol) => {
      try {
        const json = await yahoo(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?range=5d&interval=5m&includePrePost=false`,
        );
        const intra = parseIntraday(json);
        if (!intra || !intra.m5.length) {
          return { symbol, price: 0, volume: 0, m5: [], daily: daily.get(symbol) ?? [], error: "No bars" } satisfies Chart;
        }
        return {
          symbol,
          price: intra.price,
          volume: intra.volume,
          m5: intra.m5,
          daily: daily.get(symbol) ?? [],
        } satisfies Chart;
      } catch (error) {
        return {
          symbol,
          price: 0,
          volume: 0,
          m5: [],
          daily: daily.get(symbol) ?? [],
          error: error instanceof Error ? error.message : "Failed",
        } satisfies Chart;
      }
    });

    const ok = charts.filter((chart) => !chart.error).length;
    if (!ok) throw new Error("Could not read any charts. Yahoo may be rate-limiting. Try again in a minute.");
    return { charts, fetched: ok, requested: symbols.length };
  });

export const replayOdds = createServerFn({ method: "POST" })
  .validator(
    (input: {
      symbol?: string;
      day?: string;
      barIndex?: number;
      entry?: number;
      stop?: number;
      target?: number;
    }) => {
      const symbol = cleanSymbol(input?.symbol ?? "");
      const day = input?.day ?? "";
      const barIndex = Number(input?.barIndex);
      const entry = Number(input?.entry);
      const stop = Number(input?.stop);
      const target = Number(input?.target);
      if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Bad replay request.");
      if (![barIndex, entry, stop, target].every((n) => Number.isFinite(n))) throw new Error("Bad prices.");
      return { symbol, day, barIndex, entry, stop, target };
    },
  )
  .handler(async ({ data }): Promise<TmReport | { error: string }> => {
    try {
      const json = await yahoo(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(data.symbol))}?range=60d&interval=5m&includePrePost=false`,
      );
      const intra = parseIntraday(json);
      if (!intra) return { error: "No 60-day tape for the time machine." };
      return timeMachine({
        symbol: data.symbol,
        bars: intra.m5,
        day: data.day,
        barIndex: data.barIndex,
        entry: data.entry,
        stop: data.stop,
        target: data.target,
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Time machine failed." };
    }
  });
