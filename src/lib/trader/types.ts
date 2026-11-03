export type M5 = {
  day: string;
  startMin: number;
  o: number;
  h: number;
  l: number;
  c: number;
};

export type DailyBar = { day: string; close: number };

export type Chart = {
  symbol: string;
  price: number;
  volume: number;
  m5: M5[];
  daily: DailyBar[];
  error?: string;
};

export type SetupTag =
  | "breakout_20d"
  | "bull_flag"
  | "reclaim_ma20"
  | "oversold"
  | "oversold_bounce";

export type DailyHit = {
  symbol: string;
  price: number;
  setups: SetupTag[];
  rsi: number | null;
  dollarVol: number;
};

export type OrbHit = {
  symbol: string;
  price: number;
  atMin: number;
  barIndex: number;
  orHigh: number;
  orLow: number;
  pctOver: number;
  dollarVol: number;
  startMin: number;
  day: string;
};

export type Config = {
  budget: number;
  cashBufferPct: number;
  maxPositionPct: number;
  maxOrderUsd: number;
  minOrderUsd: number;
  maxLossPerTrade: number;
  maxDailyLoss: number;
  maxTradesPerDay: number;
  minRewardRisk: number;
  targetR: 1 | 2;
  symbols: string[];
};

export type Ticket = {
  id: string;
  symbol: string;
  qty: number;
  entry: number;
  stop: number;
  target: number;
  riskPerShare: number;
  maxLoss: number;
  rr: number;
  bound: string;
  orHigh: number;
  orLow: number;
  atMin: number;
  barIndex: number;
  pctOver: number;
  day: string;
  startMin: number;
};

export type Position = {
  id: string;
  symbol: string;
  qty: number;
  entry: number;
  stop: number;
  target: number;
  startMin: number;
  day: string;
  maxLoss: number;
};

export type ClosedTrade = {
  id: string;
  symbol: string;
  qty: number;
  entry: number;
  exit: number;
  reason: "stop" | "target" | "flat" | "scratch";
  pnl: number;
  day: string;
};

export type LogItem = { id: string; text: string };

export type Book = {
  cash: number;
  positions: Position[];
  closed: ClosedTrade[];
  tradesToday: number;
  riskUsed: number;
  bookDay: string;
  skipped: string[];
  log: LogItem[];
  seq: number;
};

export type TmReport = {
  symbol: string;
  sessions: number;
  replays: number;
  pTarget: number;
  pStop: number;
  pNeither: number;
  avgR: number;
  historyTriggered: number;
  historyTarget: number;
  historyStop: number;
  historyClose: number;
  verdict: string;
  note: string | null;
};
