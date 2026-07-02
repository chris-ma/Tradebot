import Link from "next/link";
import { PairRow, SignalRow } from "@/lib/db/types";
import ConfidenceBadge from "./ConfidenceBadge";

interface SignalCardProps {
  signal: SignalRow;
  pair: PairRow;
  /** The strategy's high_conviction_confidence_threshold param. */
  threshold: number;
}

function price(value: number, pair: PairRow): string {
  return Number(value).toFixed(pair.pip_position + 1);
}

export default function SignalCard({ signal, pair, threshold }: SignalCardProps) {
  const isLong = signal.direction === "long";
  const snapshot = signal.indicator_snapshot;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/pairs/${pair.symbol}`}
            className="text-lg font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            {pair.display_name}
          </Link>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {new Date(signal.signal_ts).toUTCString()}
          </p>
        </div>
        <span
          className={`rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${
            isLong
              ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
              : "bg-rose-600 text-white dark:bg-rose-500 dark:text-rose-950"
          }`}
        >
          {isLong ? "Buy / Long" : "Sell / Short"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Entry</dt>
          <dd className="font-mono text-zinc-900 dark:text-zinc-100">
            {price(signal.entry_price, pair)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Stop</dt>
          <dd className="font-mono text-rose-600 dark:text-rose-400">
            {price(signal.stop_loss, pair)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Target</dt>
          <dd className="font-mono text-emerald-600 dark:text-emerald-400">
            {price(signal.take_profit, pair)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <ConfidenceBadge score={signal.confidence_score} threshold={threshold} />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {Number(signal.risk_reward).toFixed(2)}R &middot; ADX{" "}
          {Number(snapshot.adx_daily).toFixed(1)} &middot; RSI{" "}
          {Number(snapshot.rsi_h4).toFixed(1)}
        </span>
      </div>
    </div>
  );
}
