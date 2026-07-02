import { IndicatorSnapshot } from "../signals/rules";

export type Granularity = "D" | "H4";
export type Direction = "long" | "short";

export interface PairRow {
  id: string;
  symbol: string;
  display_name: string;
  pip_position: number;
  is_active: boolean;
}

export interface CandleRow {
  id: number;
  pair_id: string;
  granularity: Granularity;
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
}

export type SignalStatus =
  | "active"
  | "target_hit"
  | "stopped_out"
  | "expired"
  | "suppressed_low_track_record";

export interface SignalInsert {
  pair_id: string;
  strategy_id: string;
  direction: Direction;
  signal_ts: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  risk_reward: number;
  indicator_snapshot: IndicatorSnapshot;
  confidence_score: number;
  status: SignalStatus;
}

export interface SignalRow extends SignalInsert {
  id: string;
  closed_at: string | null;
  closed_price: number | null;
  outcome: "win" | "loss" | "breakeven" | null;
  email_sent_at: string | null;
  created_at: string;
}

export interface BacktestRunInsert {
  strategy_id: string;
  pair_id: string;
  period_start: string;
  period_end: string;
  trade_count: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number | null;
  avg_risk_reward: number | null;
  expectancy_r: number | null;
  max_drawdown_pct: number | null;
  status: "running" | "completed" | "failed";
}

export interface BacktestRunRow extends BacktestRunInsert {
  id: string;
  run_at: string;
}

export interface BacktestTradeInsert {
  backtest_run_id: string;
  direction: Direction;
  entry_ts: string;
  exit_ts: string;
  entry_price: number;
  exit_price: number;
  stop_loss: number;
  take_profit: number;
  pnl_r: number;
  outcome: "win" | "loss";
  exit_reason: "stop" | "target" | "timeout";
}

export interface BacktestTradeRow extends BacktestTradeInsert {
  id: string;
}
