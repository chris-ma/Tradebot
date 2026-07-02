import { evaluateSignal, SimpleCandle, StrategyParams } from "../signals/rules";
import { TradeResult } from "./metrics";

const DAILY_WINDOW = 260;
const H4_WINDOW = 300;
const TIMEOUT_H4_BARS = 60; // ~10 trading days, caps how long a swing trade is held

export type ExitReason = "stop" | "target" | "timeout";

export interface BacktestTrade {
  direction: "long" | "short";
  entryTs: string;
  exitTs: string;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnlR: number;
  outcome: "win" | "loss";
  exitReason: ExitReason;
}

export interface RunBacktestInput {
  dailyCandles: SimpleCandle[];
  h4Candles: SimpleCandle[];
  params: StrategyParams;
}

/**
 * Event-driven replay over H4 candles, reusing the exact same `evaluateSignal`
 * rule function the live engine uses (via bounded sliding windows for O(n)
 * performance), so backtested metrics are guaranteed to reflect the same logic
 * that produces live signals. Trades are simulated sequentially - no
 * overlapping positions - and on a bar that touches both stop and target,
 * the stop is conservatively assumed to have been hit first.
 */
export function runBacktest(input: RunBacktestInput): BacktestTrade[] {
  const { dailyCandles, h4Candles, params } = input;
  const trades: BacktestTrade[] = [];

  const dailyIdxForH4: number[] = new Array(h4Candles.length).fill(-1);
  let dPtr = 0;
  for (let i = 0; i < h4Candles.length; i++) {
    while (dPtr + 1 < dailyCandles.length && dailyCandles[dPtr + 1].ts <= h4Candles[i].ts) {
      dPtr++;
    }
    dailyIdxForH4[i] = dailyCandles[dPtr] && dailyCandles[dPtr].ts <= h4Candles[i].ts ? dPtr : -1;
  }

  let i = 0;
  while (i < h4Candles.length) {
    const dIdx = dailyIdxForH4[i];
    if (dIdx < 0 || i + 1 >= h4Candles.length) {
      i++;
      continue;
    }

    const dailyWindow = dailyCandles.slice(Math.max(0, dIdx - DAILY_WINDOW + 1), dIdx + 1);
    const h4Window = h4Candles.slice(Math.max(0, i - H4_WINDOW + 1), i + 1);

    const candidate = evaluateSignal({ dailyCandles: dailyWindow, h4Candles: h4Window, params });
    if (!candidate) {
      i++;
      continue;
    }

    const maxJ = Math.min(h4Candles.length, i + 1 + TIMEOUT_H4_BARS);
    let exit: { ts: string; price: number; reason: ExitReason } | null = null;
    let j = i + 1;
    for (; j < maxJ; j++) {
      const bar = h4Candles[j];
      const hitStop =
        candidate.direction === "long" ? bar.low <= candidate.stopLoss : bar.high >= candidate.stopLoss;
      const hitTarget =
        candidate.direction === "long" ? bar.high >= candidate.takeProfit : bar.low <= candidate.takeProfit;

      if (hitStop) {
        // Covers the ambiguous case where both stop and target fall inside the same bar.
        exit = { ts: bar.ts, price: candidate.stopLoss, reason: "stop" };
        break;
      }
      if (hitTarget) {
        exit = { ts: bar.ts, price: candidate.takeProfit, reason: "target" };
        break;
      }
    }

    if (!exit) {
      const last = h4Candles[maxJ - 1];
      exit = { ts: last.ts, price: last.close, reason: "timeout" };
      j = maxJ;
    }

    const riskDistance = Math.abs(candidate.entryPrice - candidate.stopLoss);
    const rawPnl =
      candidate.direction === "long"
        ? exit.price - candidate.entryPrice
        : candidate.entryPrice - exit.price;
    const pnlR = riskDistance === 0 ? 0 : rawPnl / riskDistance;

    trades.push({
      direction: candidate.direction,
      entryTs: candidate.signalTs,
      exitTs: exit.ts,
      entryPrice: candidate.entryPrice,
      exitPrice: exit.price,
      stopLoss: candidate.stopLoss,
      takeProfit: candidate.takeProfit,
      pnlR,
      outcome: pnlR >= 0 ? "win" : "loss",
      exitReason: exit.reason,
    });

    i = j; // resume scanning after this trade closes - no overlapping positions
  }

  return trades;
}

export function tradesToResults(trades: BacktestTrade[]): TradeResult[] {
  return trades.map((t) => ({ pnlR: t.pnlR, outcome: t.outcome }));
}
