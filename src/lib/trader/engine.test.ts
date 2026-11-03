import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultConfig, freshBook, runCycle, sizeFromRange } from "./engine.ts";
import type { Chart, M5 } from "./types.ts";

describe("sizeFromRange", () => {
  it("matches the TSLA reel: 8 shares, stop 358.32, target 370.04, loss 46.88", () => {
    const sized = sizeFromRange(364.18, 362.18, 354.47, defaultConfig(), 5000);
    assert.equal(sized.ok, true);
    if (!sized.ok) return;
    assert.equal(sized.sized.qty, 8);
    assert.equal(sized.sized.stop, 358.32);
    assert.equal(sized.sized.target, 370.04);
    assert.equal(sized.sized.riskPerShare, 5.86);
    assert.equal(sized.sized.maxLoss, 46.88);
  });
});

function bar(startMin: number, o: number, h: number, l: number, c: number): M5 {
  return { day: "2026-10-19", startMin, o, h, l, c };
}

describe("runCycle", () => {
  it("paper-fills a breakout on autopilot and stops out on the next bar", () => {
    const bars: M5[] = [];
    for (let i = 0; i < 6; i++) {
      const start = 9 * 60 + 30 + i * 5;
      if (i < 3) bars.push(bar(start, 100, 100.4, 99.2, 99.8));
      else if (i === 3) bars.push(bar(start, 100.2, 101.4, 100.1, 101));
      else bars.push(bar(start, 100.6, 100.8, 99, 99.4));
    }
    const chart: Chart = {
      symbol: "DEMO",
      price: 101,
      volume: 2_000_000,
      m5: bars,
      daily: [],
    };
    const config = { ...defaultConfig(), symbols: ["DEMO"], maxLossPerTrade: 50 };
    const first = runCycle({
      book: freshBook(),
      charts: [chart],
      day: "2026-10-19",
      cutoffMin: 9 * 60 + 50,
      config,
      autopilot: true,
      pending: null,
      intent: "mark",
    });
    assert.equal(first.book.positions.length, 1);
    assert.equal(first.book.positions[0]?.symbol, "DEMO");
    assert.equal(first.book.positions[0]?.entry, 101);
    assert.equal(first.book.positions[0]?.stop, 99.8);
    const second = runCycle({
      book: first.book,
      charts: [chart],
      day: "2026-10-19",
      cutoffMin: 9 * 60 + 55,
      config,
      autopilot: true,
      pending: null,
      intent: "mark",
    });
    assert.equal(second.book.positions.length, 0);
    assert.equal(second.book.closed[0]?.reason, "stop");
    assert.equal(second.book.closed[0]?.exit, 99.8);
  });
});
