import { describe, expect, it } from "vitest";
import { runBacktest } from "./engine";
import { SimpleCandle, StrategyParams } from "../signals/rules";

const params: StrategyParams = {
  ema_fast: 50,
  ema_slow: 200,
  rsi_period: 14,
  rsi_long_trigger: 45,
  rsi_long_ceiling: 70,
  rsi_short_trigger: 55,
  rsi_short_floor: 30,
  macd_fast: 12,
  macd_slow: 26,
  macd_signal: 9,
  adx_period: 14,
  adx_threshold: 25,
  atr_period: 14,
  atr_stop_multiplier: 1.5,
  atr_target_multiplier: 2.5,
  confirmation_candles: 2,
};

function mkDailyUp(n: number): SimpleCandle[] {
  const candles: SimpleCandle[] = [];
  let close = 1.1;
  for (let i = 0; i < n; i++) {
    const open = close;
    close = open + 0.0006;
    const high = Math.max(open, close) + 0.0003;
    const low = Math.min(open, close) - 0.0003;
    candles.push({ ts: new Date(2020, 0, i).toISOString(), open, high, low, close });
  }
  return candles;
}

/**
 * Uptrend -> pullback -> resume (triggers a long signal) -> a sharp
 * continuation tail that reliably runs up through the take-profit level
 * within a few bars, so the simulated trade closes deterministically as a
 * target-hit win.
 */
function mkH4WithTargetHit(n: number): SimpleCandle[] {
  const pullbackLen = 10;
  const pullbackStep = 0.0005;
  const resumeLen = 8;
  const resumeStep = 0.0006;
  const upStep = 0.0002;
  const tailLen = 10;
  const tailStep = 0.001;
  const upLen = n - pullbackLen - resumeLen - tailLen;

  const candles: SimpleCandle[] = [];
  let close = 1.1;
  for (let i = 0; i < n; i++) {
    const open = close;
    let step: number;
    if (i < upLen) step = upStep;
    else if (i < upLen + pullbackLen) step = -pullbackStep;
    else if (i < upLen + pullbackLen + resumeLen) step = resumeStep;
    else step = tailStep;
    close = open + step;
    const high = Math.max(open, close) + 0.0002;
    const low = Math.min(open, close) - 0.0002;
    candles.push({ ts: new Date(2021, 0, 1, i * 4).toISOString(), open, high, low, close });
  }
  return candles;
}

describe("runBacktest", () => {
  it("simulates exactly one trade that hits take-profit for a confirmed long setup with a strong continuation", () => {
    const daily = mkDailyUp(260);
    const h4 = mkH4WithTargetHit(160);

    const trades = runBacktest({ dailyCandles: daily, h4Candles: h4, params });

    expect(trades.length).toBe(1);
    const trade = trades[0];
    expect(trade.direction).toBe("long");
    expect(trade.outcome).toBe("win");
    expect(trade.exitReason).toBe("target");
    expect(trade.exitPrice).toBeCloseTo(trade.takeProfit, 6);
    // R multiple should match the strategy's target/stop ratio.
    expect(trade.pnlR).toBeCloseTo(
      params.atr_target_multiplier / params.atr_stop_multiplier,
      2
    );
  });

  it("produces no trades when the series never satisfies the confluence rules", () => {
    const daily = mkDailyUp(260);
    // Flat H4 series: no momentum trigger ever fires.
    const flatH4: SimpleCandle[] = Array.from({ length: 160 }, (_, i) => ({
      ts: new Date(2021, 0, 1, i * 4).toISOString(),
      open: 1.1,
      high: 1.1002,
      low: 1.0998,
      close: 1.1,
    }));

    const trades = runBacktest({ dailyCandles: daily, h4Candles: flatH4, params });
    expect(trades.length).toBe(0);
  });
});
