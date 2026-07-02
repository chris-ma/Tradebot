import { DateTime } from "luxon";
import { getRecentCandles } from "../db/queries/candles";
import {
  getLastSignalForPairDirection,
  insertSignal,
  markEmailSent,
} from "../db/queries/signals";
import { getLatestBacktestRun } from "../db/queries/backtests";
import { getPairById } from "../db/queries/pairs";
import { StrategyRow } from "../db/queries/strategies";
import { SignalRow } from "../db/types";
import { sendSignalAlertEmail } from "../email/client";
import { evaluateSignal } from "./rules";

const DAILY_LOOKBACK = 260;
const H4_LOOKBACK = 300;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Number of weekday (Mon-Fri) calendar days between two ISO timestamps. */
function tradingDaysBetween(fromIso: string, toIso: string): number {
  let from = DateTime.fromISO(fromIso);
  const to = DateTime.fromISO(toIso);
  let count = 0;
  while (from < to) {
    from = from.plus({ days: 1 });
    if (from.weekday <= 5) count++;
  }
  return count;
}

export interface EngineResult {
  signal: SignalRow;
  isHighConviction: boolean;
}

/**
 * Evaluates one pair against a strategy and, if a candidate signal is found
 * and it clears the cooldown window, persists it (gated by backtested
 * reliability - low track-record signals are stored as suppressed rather
 * than surfaced). Returns null if no new signal was produced.
 */
export async function evaluateAndPersistSignal(
  pairId: string,
  strategy: StrategyRow
): Promise<EngineResult | null> {
  const [dailyRows, h4Rows] = await Promise.all([
    getRecentCandles(pairId, "D", DAILY_LOOKBACK),
    getRecentCandles(pairId, "H4", H4_LOOKBACK),
  ]);

  const candidate = evaluateSignal({
    dailyCandles: dailyRows,
    h4Candles: h4Rows,
    params: strategy.params,
  });
  if (!candidate) return null;

  const lastSameDirection = await getLastSignalForPairDirection(pairId, candidate.direction);
  if (lastSameDirection) {
    const daysSince = tradingDaysBetween(lastSameDirection.signal_ts, candidate.signalTs);
    if (daysSince < strategy.params.cooldown_trading_days) {
      return null;
    }
  }

  const backtestRun = await getLatestBacktestRun(pairId, strategy.id);
  const passesGate =
    backtestRun !== null &&
    backtestRun.trade_count >= strategy.params.min_backtest_trade_count &&
    backtestRun.win_rate >= strategy.params.min_backtest_win_rate &&
    (backtestRun.profit_factor ?? 0) >= strategy.params.min_backtest_profit_factor;

  const quality = backtestRun ? backtestRun.win_rate * (backtestRun.profit_factor ?? 0) : 0;
  const backtestQualityScore = clamp01(quality / 2.0) * 40;

  const confidenceScore =
    candidate.confluenceScore + candidate.regimeStabilityScore + backtestQualityScore;

  const status = passesGate ? "active" : "suppressed_low_track_record";
  const isHighConviction =
    status === "active" && confidenceScore >= strategy.params.high_conviction_confidence_threshold;

  const signal = await insertSignal({
    pair_id: pairId,
    strategy_id: strategy.id,
    direction: candidate.direction,
    signal_ts: candidate.signalTs,
    entry_price: candidate.entryPrice,
    stop_loss: candidate.stopLoss,
    take_profit: candidate.takeProfit,
    risk_reward: candidate.riskReward,
    indicator_snapshot: candidate.indicatorSnapshot,
    confidence_score: Math.round(confidenceScore * 100) / 100,
    status,
  });

  // Engine-level guarantee: every high-conviction (active, above-threshold)
  // signal triggers an email alert - suppressed/low-confidence signals never
  // do. Email failures are logged but never fail signal persistence.
  if (isHighConviction) {
    try {
      const pair = await getPairById(pairId);
      if (!pair) throw new Error(`Pair ${pairId} not found for alert email`);
      await sendSignalAlertEmail(signal, pair);
      await markEmailSent(signal.id);
    } catch (err) {
      console.error(`Alert email failed for signal ${signal.id}:`, err);
    }
  }

  return { signal, isHighConviction };
}
