import { getAllCandles } from "../db/queries/candles";
import { insertBacktestRun, insertBacktestTrades } from "../db/queries/backtests";
import { StrategyRow } from "../db/queries/strategies";
import { BacktestTradeInsert, PairRow } from "../db/types";
import { runBacktest } from "./engine";
import { computeMetrics } from "./metrics";

export interface BacktestRunSummary {
  runId: string;
  pair: string;
  strategy: string;
  tradeCount: number;
  winRate: number;
  profitFactor: number | null;
  expectancyR: number;
}

/**
 * Loads the full candle history for a pair, replays it through the shared
 * rule-set via `runBacktest`, and persists the aggregate run plus every
 * simulated trade. Returns null when there is no candle history to test.
 *
 * Shared by the monthly rebacktest cron and the on-demand admin route so
 * both persist identically.
 */
export async function runAndPersistBacktest(
  pair: PairRow,
  strategy: StrategyRow
): Promise<BacktestRunSummary | null> {
  const [dailyCandles, h4Candles] = await Promise.all([
    getAllCandles(pair.id, "D"),
    getAllCandles(pair.id, "H4"),
  ]);
  if (dailyCandles.length === 0 || h4Candles.length === 0) return null;

  const trades = runBacktest({ dailyCandles, h4Candles, params: strategy.params });
  const metrics = computeMetrics(trades);

  const run = await insertBacktestRun({
    strategy_id: strategy.id,
    pair_id: pair.id,
    period_start: dailyCandles[0].ts,
    period_end: h4Candles[h4Candles.length - 1].ts,
    trade_count: metrics.tradeCount,
    wins: metrics.wins,
    losses: metrics.losses,
    win_rate: metrics.winRate,
    profit_factor: metrics.profitFactor,
    avg_risk_reward: metrics.avgRiskReward,
    expectancy_r: metrics.expectancyR,
    max_drawdown_pct: metrics.maxDrawdownPct,
    status: "completed",
  });

  const tradeRows: BacktestTradeInsert[] = trades.map((t) => ({
    backtest_run_id: run.id,
    direction: t.direction,
    entry_ts: t.entryTs,
    exit_ts: t.exitTs,
    entry_price: t.entryPrice,
    exit_price: t.exitPrice,
    stop_loss: t.stopLoss,
    take_profit: t.takeProfit,
    pnl_r: t.pnlR,
    outcome: t.outcome,
    exit_reason: t.exitReason,
  }));
  await insertBacktestTrades(tradeRows);

  return {
    runId: run.id,
    pair: pair.symbol,
    strategy: `${strategy.name} v${strategy.version}`,
    tradeCount: metrics.tradeCount,
    winRate: metrics.winRate,
    profitFactor: metrics.profitFactor,
    expectancyR: metrics.expectancyR,
  };
}
