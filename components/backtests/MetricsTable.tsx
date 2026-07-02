import Link from "next/link";
import { BacktestRunRow } from "@/lib/db/types";

export interface MetricsTableRow {
  run: BacktestRunRow;
  pairLabel: string;
  strategyLabel: string;
}

function pct(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function num(value: number | null, digits = 2): string {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(digits);
}

const thClass =
  "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
const tdClass = "px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300";

export default function MetricsTable({ rows }: { rows: MetricsTableRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead>
          <tr>
            <th className={thClass}>Pair</th>
            <th className={thClass}>Strategy</th>
            <th className={thClass}>Run at</th>
            <th className={thClass}>Trades</th>
            <th className={thClass}>Win rate</th>
            <th className={thClass}>Profit factor</th>
            <th className={thClass}>Expectancy</th>
            <th className={thClass}>Max DD</th>
            <th className={thClass}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map(({ run, pairLabel, strategyLabel }) => (
            <tr key={run.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              <td className={`${tdClass} font-medium text-zinc-900 dark:text-zinc-100`}>
                {pairLabel}
              </td>
              <td className={tdClass}>{strategyLabel}</td>
              <td className={tdClass}>{new Date(run.run_at).toISOString().slice(0, 10)}</td>
              <td className={`${tdClass} font-mono`}>{run.trade_count}</td>
              <td className={`${tdClass} font-mono`}>{pct(run.win_rate)}</td>
              <td className={`${tdClass} font-mono`}>{num(run.profit_factor)}</td>
              <td className={`${tdClass} font-mono`}>{num(run.expectancy_r)}R</td>
              <td className={`${tdClass} font-mono`}>{num(run.max_drawdown_pct, 1)}%</td>
              <td className={tdClass}>
                <Link
                  href={`/backtests/${run.id}`}
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Trades
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
