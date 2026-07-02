import { adx, atr, ema, macd, rsi } from "../indicators";

export interface SimpleCandle {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type Direction = "long" | "short";

export interface StrategyParams {
  ema_fast: number;
  ema_slow: number;
  rsi_period: number;
  rsi_long_trigger: number;
  rsi_long_ceiling: number;
  rsi_short_trigger: number;
  rsi_short_floor: number;
  macd_fast: number;
  macd_slow: number;
  macd_signal: number;
  adx_period: number;
  adx_threshold: number;
  atr_period: number;
  atr_stop_multiplier: number;
  atr_target_multiplier: number;
  confirmation_candles: number;
  [key: string]: number;
}

export interface IndicatorSnapshot {
  ema_fast: number;
  ema_slow: number;
  adx_daily: number;
  rsi_h4: number;
  macd_h4: number;
  macd_signal_h4: number;
  atr_h4: number;
}

export interface CandidateSignal {
  direction: Direction;
  signalTs: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  indicatorSnapshot: IndicatorSnapshot;
  /** 0-40: how strongly the confluence conditions are met, beyond a bare pass/fail. */
  confluenceScore: number;
  /** 0-20: how many consecutive daily bars the trend regime has held. */
  regimeStabilityScore: number;
}

interface DailyContext {
  emaFast: (number | null)[];
  emaSlow: (number | null)[];
  adxSeries: { adx: number | null }[];
  candles: SimpleCandle[];
}

function buildDailyContext(dailyCandles: SimpleCandle[], params: StrategyParams): DailyContext {
  const closes = dailyCandles.map((c) => c.close);
  const highs = dailyCandles.map((c) => c.high);
  const lows = dailyCandles.map((c) => c.low);
  return {
    emaFast: ema(closes, params.ema_fast),
    emaSlow: ema(closes, params.ema_slow),
    adxSeries: adx(highs, lows, closes, params.adx_period),
    candles: dailyCandles,
  };
}

/** Bullish=long regime, bearish=short regime, null if neither (flat/insufficient data). */
function dailyRegime(ctx: DailyContext, i: number, params: StrategyParams): Direction | null {
  const fast = ctx.emaFast[i];
  const slow = ctx.emaSlow[i];
  const adxVal = ctx.adxSeries[i]?.adx ?? null;
  if (fast === null || slow === null || adxVal === null || Number.isNaN(adxVal)) return null;
  if (adxVal < params.adx_threshold) return null;
  if (fast > slow) return "long";
  if (fast < slow) return "short";
  return null;
}

/** Consecutive trailing daily bars (ending at `i`) where the regime matches `direction`. */
function regimeStabilityDays(ctx: DailyContext, i: number, direction: Direction, params: StrategyParams): number {
  let count = 0;
  for (let idx = i; idx >= 0; idx--) {
    if (dailyRegime(ctx, idx, params) === direction) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function confluenceScore(
  direction: Direction,
  rsiVal: number,
  histogram: number,
  atrH4: number,
  adxVal: number,
  emaFastDaily: number,
  emaSlowDaily: number,
  params: StrategyParams
): number {
  const rsiTrigger = direction === "long" ? params.rsi_long_trigger : params.rsi_short_trigger;
  const rsiCeiling = direction === "long" ? params.rsi_long_ceiling : params.rsi_short_floor;
  const rsiMargin = clamp01(Math.abs(rsiVal - rsiTrigger) / Math.abs(rsiCeiling - rsiTrigger)) * 10;

  const macdScore = clamp01((Math.abs(histogram) / atrH4) * 20) * 10;

  const adxScore = clamp01((adxVal - params.adx_threshold) / 25) * 10;

  const emaSeparationPct = Math.abs(emaFastDaily - emaSlowDaily) / emaSlowDaily;
  const emaScore = clamp01(emaSeparationPct / 0.02) * 10;

  return rsiMargin + macdScore + adxScore + emaScore;
}

/**
 * Confluence conditions evaluated at a single H4 index, using the latest daily
 * regime/ADX values (daily indicators only change once/day so they're constant
 * across the H4 bars within a session).
 */
function h4ConditionsMet(
  direction: Direction,
  rsiVal: number | null,
  macdPoint: { macd: number | null; signal: number | null; histogram: number | null },
  params: StrategyParams
): boolean {
  if (rsiVal === null || macdPoint.macd === null || macdPoint.signal === null || macdPoint.histogram === null) {
    return false;
  }
  if (direction === "long") {
    const rsiOk = rsiVal > params.rsi_long_trigger && rsiVal < params.rsi_long_ceiling;
    const macdOk = macdPoint.macd > macdPoint.signal && macdPoint.histogram > 0;
    return rsiOk && macdOk;
  }
  const rsiOk = rsiVal < params.rsi_short_trigger && rsiVal > params.rsi_short_floor;
  const macdOk = macdPoint.macd < macdPoint.signal && macdPoint.histogram < 0;
  return rsiOk && macdOk;
}

export interface EvaluateSignalInput {
  dailyCandles: SimpleCandle[];
  h4Candles: SimpleCandle[];
  params: StrategyParams;
}

/**
 * Pure confluence rule evaluation - no I/O. Used identically by the live
 * signal engine and the backtester so a displayed signal's math always
 * matches its backtested track record.
 *
 * Evaluates the confluence at the last H4 candle; requires the same
 * direction's conditions to also hold at the second-to-last H4 candle
 * (two-candle confirmation, per params.confirmation_candles) to filter
 * single-bar noise.
 */
export function evaluateSignal(input: EvaluateSignalInput): CandidateSignal | null {
  const { dailyCandles, h4Candles, params } = input;

  const minDaily = params.ema_slow + params.adx_period + 1;
  if (dailyCandles.length < minDaily) return null;

  const minH4 = params.macd_slow + params.macd_signal + params.confirmation_candles;
  if (h4Candles.length < minH4) return null;

  const dailyCtx = buildDailyContext(dailyCandles, params);
  const lastDailyIdx = dailyCandles.length - 1;
  const direction = dailyRegime(dailyCtx, lastDailyIdx, params);
  if (direction === null) return null;

  const h4Closes = h4Candles.map((c) => c.close);
  const h4Highs = h4Candles.map((c) => c.high);
  const h4Lows = h4Candles.map((c) => c.low);
  const rsiSeries = rsi(h4Closes, params.rsi_period);
  const macdSeries = macd(h4Closes, params.macd_fast, params.macd_slow, params.macd_signal);
  const atrSeries = atr(h4Highs, h4Lows, h4Closes, params.atr_period);

  const lastH4Idx = h4Candles.length - 1;
  const confirmBars = Math.max(1, params.confirmation_candles);

  for (let offset = 0; offset < confirmBars; offset++) {
    const idx = lastH4Idx - offset;
    if (idx < 0) return null;
    if (!h4ConditionsMet(direction, rsiSeries[idx], macdSeries[idx], params)) {
      return null;
    }
  }

  const rsiVal = rsiSeries[lastH4Idx];
  const macdPoint = macdSeries[lastH4Idx];
  const atrVal = atrSeries[lastH4Idx];
  const emaFastDaily = dailyCtx.emaFast[lastDailyIdx];
  const emaSlowDaily = dailyCtx.emaSlow[lastDailyIdx];
  const adxVal = dailyCtx.adxSeries[lastDailyIdx]?.adx ?? null;

  if (
    rsiVal === null ||
    macdPoint.macd === null ||
    macdPoint.signal === null ||
    atrVal === null ||
    emaFastDaily === null ||
    emaSlowDaily === null ||
    adxVal === null
  ) {
    return null;
  }

  const entryPrice = h4Candles[lastH4Idx].close;
  const stopDistance = atrVal * params.atr_stop_multiplier;
  const targetDistance = atrVal * params.atr_target_multiplier;

  const stopLoss = direction === "long" ? entryPrice - stopDistance : entryPrice + stopDistance;
  const takeProfit = direction === "long" ? entryPrice + targetDistance : entryPrice - targetDistance;
  const riskReward = targetDistance / stopDistance;

  const cScore = confluenceScore(
    direction,
    rsiVal,
    macdPoint.histogram ?? 0,
    atrVal,
    adxVal,
    emaFastDaily,
    emaSlowDaily,
    params
  );
  const stabilityDays = regimeStabilityDays(dailyCtx, lastDailyIdx, direction, params);
  const regimeStabilityScore = clamp01(stabilityDays / 60) * 20;

  return {
    direction,
    signalTs: h4Candles[lastH4Idx].ts,
    entryPrice,
    stopLoss,
    takeProfit,
    riskReward,
    indicatorSnapshot: {
      ema_fast: emaFastDaily,
      ema_slow: emaSlowDaily,
      adx_daily: adxVal,
      rsi_h4: rsiVal,
      macd_h4: macdPoint.macd,
      macd_signal_h4: macdPoint.signal,
      atr_h4: atrVal,
    },
    confluenceScore: cScore,
    regimeStabilityScore,
  };
}
