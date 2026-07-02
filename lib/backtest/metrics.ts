export interface TradeResult {
  pnlR: number; // P&L expressed in multiples of initial risk (R)
  outcome: "win" | "loss";
}

export interface BacktestMetrics {
  tradeCount: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number | null;
  avgRiskReward: number | null;
  expectancyR: number;
  maxDrawdownPct: number;
}

/** Assumed fixed risk-per-trade used to translate R-multiples into an equity curve for drawdown. */
const RISK_PER_TRADE_PCT = 1;
const STARTING_EQUITY = 100;

export function winRate(trades: TradeResult[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter((t) => t.outcome === "win").length;
  return wins / trades.length;
}

export function profitFactor(trades: TradeResult[]): number | null {
  const grossProfit = trades.filter((t) => t.pnlR > 0).reduce((s, t) => s + t.pnlR, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.pnlR < 0).reduce((s, t) => s + t.pnlR, 0));
  if (grossLoss === 0) return grossProfit > 0 ? null : 0;
  return grossProfit / grossLoss;
}

/** Average R multiple achieved on winning trades. */
export function avgRiskReward(trades: TradeResult[]): number | null {
  const wins = trades.filter((t) => t.outcome === "win");
  if (wins.length === 0) return null;
  return wins.reduce((s, t) => s + t.pnlR, 0) / wins.length;
}

export function expectancyR(trades: TradeResult[]): number {
  if (trades.length === 0) return 0;
  return trades.reduce((s, t) => s + t.pnlR, 0) / trades.length;
}

/**
 * Max peak-to-trough drawdown, expressed as a percentage of equity, simulating
 * a fixed RISK_PER_TRADE_PCT risk per trade against a STARTING_EQUITY base.
 */
export function maxDrawdownPct(trades: TradeResult[]): number {
  let equity = STARTING_EQUITY;
  let peak = STARTING_EQUITY;
  let maxDrawdown = 0;

  for (const trade of trades) {
    equity += trade.pnlR * RISK_PER_TRADE_PCT;
    peak = Math.max(peak, equity);
    const drawdown = ((peak - equity) / peak) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  return maxDrawdown;
}

export function computeMetrics(trades: TradeResult[]): BacktestMetrics {
  const wins = trades.filter((t) => t.outcome === "win").length;
  return {
    tradeCount: trades.length,
    wins,
    losses: trades.length - wins,
    winRate: winRate(trades),
    profitFactor: profitFactor(trades),
    avgRiskReward: avgRiskReward(trades),
    expectancyR: expectancyR(trades),
    maxDrawdownPct: maxDrawdownPct(trades),
  };
}
