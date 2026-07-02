import { getServiceClient } from "../client";
import {
  BacktestRunInsert,
  BacktestRunRow,
  BacktestTradeInsert,
} from "../types";

export async function insertBacktestRun(
  run: BacktestRunInsert
): Promise<BacktestRunRow> {
  const { data, error } = await getServiceClient()
    .from("backtest_runs")
    .insert(run)
    .select()
    .single();

  if (error) throw error;
  return data as BacktestRunRow;
}

export async function insertBacktestTrades(
  trades: BacktestTradeInsert[]
): Promise<void> {
  if (trades.length === 0) return;
  const { error } = await getServiceClient().from("backtest_trades").insert(trades);
  if (error) throw error;
}

/** Latest completed backtest run for a pair+strategy - used as the reliability gate. */
export async function getLatestBacktestRun(
  pairId: string,
  strategyId: string
): Promise<BacktestRunRow | null> {
  const { data, error } = await getServiceClient()
    .from("backtest_runs")
    .select("*")
    .eq("pair_id", pairId)
    .eq("strategy_id", strategyId)
    .eq("status", "completed")
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as BacktestRunRow) ?? null;
}

export async function listBacktestRuns(): Promise<BacktestRunRow[]> {
  const { data, error } = await getServiceClient()
    .from("backtest_runs")
    .select("*")
    .order("run_at", { ascending: false });

  if (error) throw error;
  return (data as BacktestRunRow[]) ?? [];
}
