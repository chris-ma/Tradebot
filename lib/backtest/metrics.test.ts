import { describe, expect, it } from "vitest";
import {
  avgRiskReward,
  computeMetrics,
  expectancyR,
  maxDrawdownPct,
  profitFactor,
  TradeResult,
  winRate,
} from "./metrics";

// 3 wins of +2R, 2 losses of -1R -> win rate 60%, gross profit 6R, gross loss 2R.
const trades: TradeResult[] = [
  { pnlR: 2, outcome: "win" },
  { pnlR: 2, outcome: "win" },
  { pnlR: 2, outcome: "win" },
  { pnlR: -1, outcome: "loss" },
  { pnlR: -1, outcome: "loss" },
];

describe("backtest metrics", () => {
  it("computes win rate", () => {
    expect(winRate(trades)).toBeCloseTo(0.6, 5);
    expect(winRate([])).toBe(0);
  });

  it("computes profit factor as gross profit / gross loss", () => {
    expect(profitFactor(trades)).toBeCloseTo(6 / 2, 5);
  });

  it("computes average R multiple on winning trades", () => {
    expect(avgRiskReward(trades)).toBeCloseTo(2, 5);
    expect(avgRiskReward([{ pnlR: -1, outcome: "loss" }])).toBeNull();
  });

  it("computes expectancy as mean R across all trades", () => {
    // (2+2+2-1-1)/5 = 0.8
    expect(expectancyR(trades)).toBeCloseTo(0.8, 5);
  });

  it("computes max drawdown from the equity curve", () => {
    // Losses immediately after a win create the drawdown; verify it's positive
    // and bounded by a plausible range given 1% risk per trade.
    const losingStreak: TradeResult[] = [
      { pnlR: 1, outcome: "win" },
      { pnlR: -1, outcome: "loss" },
      { pnlR: -1, outcome: "loss" },
    ];
    const dd = maxDrawdownPct(losingStreak);
    expect(dd).toBeGreaterThan(0);
    expect(dd).toBeLessThan(10);
  });

  it("computeMetrics aggregates all of the above consistently", () => {
    const metrics = computeMetrics(trades);
    expect(metrics.tradeCount).toBe(5);
    expect(metrics.wins).toBe(3);
    expect(metrics.losses).toBe(2);
    expect(metrics.winRate).toBeCloseTo(0.6, 5);
    expect(metrics.profitFactor).toBeCloseTo(3, 5);
    expect(metrics.expectancyR).toBeCloseTo(0.8, 5);
  });
});
