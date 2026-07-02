import { describe, expect, it } from "vitest";
import { evaluateSignal, SimpleCandle, StrategyParams } from "./rules";

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

/** Steady uptrend: strong bullish regime (EMA50 > EMA200, ADX high). */
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

/** Steady downtrend: strong bearish regime (EMA50 < EMA200, ADX high). */
function mkDailyDown(n: number): SimpleCandle[] {
  const candles: SimpleCandle[] = [];
  let close = 1.3;
  for (let i = 0; i < n; i++) {
    const open = close;
    close = open - 0.0006;
    const high = Math.max(open, close) + 0.0003;
    const low = Math.min(open, close) - 0.0003;
    candles.push({ ts: new Date(2020, 0, i).toISOString(), open, high, low, close });
  }
  return candles;
}

/** Choppy/flat: no clear direction, low ADX. */
function mkDailyFlat(n: number): SimpleCandle[] {
  const candles: SimpleCandle[] = [];
  let close = 1.1;
  for (let i = 0; i < n; i++) {
    const open = close;
    close = open + (i % 2 === 0 ? 0.0002 : -0.0002);
    const high = Math.max(open, close) + 0.0003;
    const low = Math.min(open, close) - 0.0003;
    candles.push({ ts: new Date(2020, 0, i).toISOString(), open, high, low, close });
  }
  return candles;
}

/**
 * H4 series that mild-uptrends, pulls back, then resumes up for `resumeLen`
 * bars - tuned so RSI crosses up through the long trigger and MACD turns
 * bullish and both hold for the last two bars (two-candle confirmation).
 */
function mkH4Up(n: number, resumeLen = 8): SimpleCandle[] {
  const pullbackLen = 10;
  const pullbackStep = 0.0005;
  const resumeStep = 0.0006;
  const upStep = 0.0002;
  const candles: SimpleCandle[] = [];
  let close = 1.1;
  const upLen = n - pullbackLen - resumeLen;
  for (let i = 0; i < n; i++) {
    const open = close;
    let step: number;
    if (i < upLen) step = upStep;
    else if (i < upLen + pullbackLen) step = -pullbackStep;
    else step = resumeStep;
    close = open + step;
    const high = Math.max(open, close) + 0.0002;
    const low = Math.min(open, close) - 0.0002;
    candles.push({ ts: new Date(2021, 0, 1, i * 4).toISOString(), open, high, low, close });
  }
  return candles;
}

/** Mirror of mkH4Up for the short case: rallies then resumes down. */
function mkH4Down(n: number, resumeLen = 8): SimpleCandle[] {
  const rallyLen = 10;
  const rallyStep = 0.0005;
  const resumeStep = 0.0006;
  const downStep = 0.0002;
  const candles: SimpleCandle[] = [];
  let close = 1.3;
  const downLen = n - rallyLen - resumeLen;
  for (let i = 0; i < n; i++) {
    const open = close;
    let step: number;
    if (i < downLen) step = -downStep;
    else if (i < downLen + rallyLen) step = rallyStep;
    else step = -resumeStep;
    close = open + step;
    const high = Math.max(open, close) + 0.0002;
    const low = Math.min(open, close) - 0.0002;
    candles.push({ ts: new Date(2021, 0, 1, i * 4).toISOString(), open, high, low, close });
  }
  return candles;
}

describe("evaluateSignal", () => {
  it("returns null when there isn't enough daily history", () => {
    const result = evaluateSignal({
      dailyCandles: mkDailyUp(50),
      h4Candles: mkH4Up(150),
      params,
    });
    expect(result).toBeNull();
  });

  it("returns null when there isn't enough H4 history", () => {
    const result = evaluateSignal({
      dailyCandles: mkDailyUp(260),
      h4Candles: mkH4Up(20),
      params,
    });
    expect(result).toBeNull();
  });

  it("returns null when the daily regime is flat/choppy (ADX below threshold)", () => {
    const result = evaluateSignal({
      dailyCandles: mkDailyFlat(260),
      h4Candles: mkH4Up(150),
      params,
    });
    expect(result).toBeNull();
  });

  it("returns null when only the most recent H4 bar meets confluence (fails two-candle confirmation)", () => {
    const result = evaluateSignal({
      dailyCandles: mkDailyUp(260),
      h4Candles: mkH4Up(150, 1),
      params,
    });
    expect(result).toBeNull();
  });

  it("returns null when the H4 momentum contradicts the daily regime", () => {
    // Bullish daily regime, but H4 is set up for a bearish (short) trigger.
    const result = evaluateSignal({
      dailyCandles: mkDailyUp(260),
      h4Candles: mkH4Down(150),
      params,
    });
    expect(result).toBeNull();
  });

  it("fires a long signal when trend, momentum, and confirmation all align", () => {
    const result = evaluateSignal({
      dailyCandles: mkDailyUp(260),
      h4Candles: mkH4Up(150),
      params,
    });
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("long");
    expect(result!.stopLoss).toBeLessThan(result!.entryPrice);
    expect(result!.takeProfit).toBeGreaterThan(result!.entryPrice);
    expect(result!.riskReward).toBeCloseTo(
      params.atr_target_multiplier / params.atr_stop_multiplier,
      5
    );
    expect(result!.confluenceScore).toBeGreaterThan(0);
    expect(result!.confluenceScore).toBeLessThanOrEqual(40);
    expect(result!.regimeStabilityScore).toBeGreaterThan(0);
    expect(result!.regimeStabilityScore).toBeLessThanOrEqual(20);
  });

  it("fires a short signal when trend, momentum, and confirmation all align (mirror case)", () => {
    const result = evaluateSignal({
      dailyCandles: mkDailyDown(260),
      h4Candles: mkH4Down(150),
      params,
    });
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("short");
    expect(result!.stopLoss).toBeGreaterThan(result!.entryPrice);
    expect(result!.takeProfit).toBeLessThan(result!.entryPrice);
    expect(result!.riskReward).toBeCloseTo(
      params.atr_target_multiplier / params.atr_stop_multiplier,
      5
    );
  });
});
