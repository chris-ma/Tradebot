import Link from "next/link";
import { notFound } from "next/navigation";
import { getBacktestRun, getBacktestTrades } from "@/lib/db/queries/backtests";
import { getPairById } from "@/lib/db/queries/pairs";
import { getStrategyById } from "@/lib/db/queries/strategies";
import { BacktestRunRow, BacktestTradeRow, PairRow } from "@/lib/db/types";
import { StrategyRow } from "@/lib/db/queries/strategies";

export const dynamic = "force-dynamic";

interface RunPageData {
  run: BacktestRunRow | null;
  trades: BacktestTradeRow[];
  pair: PairRow | null;
  strategy: StrategyRow | null;
  error: string | null;
}

async function loadRun(runId: string): Promise<RunPageData> {
  const empty: RunPageData = { run: null, trades: [], pair: null, strategy: null, error: null };
  try {
    const run = await getBacktestRun(runId);
    if (!run) return empty;
    const [trades, pair, strategy] = await Promise.all([
      getBacktestTrades(run.id),
      getPairById(run.pair_id),
      getStrategyById(run.strategy_id),
    ]);
    return { run, trades, pair, strategy, error: null };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}

function fmt(value: number | null, digits = 2): string {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(digits);
}

export default async function BacktestRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const data = await loadRun(runId);

  if (data.error) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <p className="font-semibold">Could not reach the database.</p>
        <p className="mt-1 font-mono text-xs opacity-75">{data.error}</p>
      </div>
    );
  }
  if (!data.run) notFound();

  const { run, trades, pair, strategy } = data;
  const precision = (pair?.pip_position ?? 4) + 1;

  const summary: { label: string; value: string }[] = [
    { label: "Trades", value: String(run.trade_count) },
    { label: "Win rate", value: `${(Number(run.win_rate) * 100).toFixed(1)}%` },
    { label: "Profit factor", value: fmt(run.profit_factor) },
    { label: "Avg win (R)", value: fmt(run.avg_risk_reward) },
    { label: "Expectancy", value: `${fmt(run.expectancy_r)}R` },
    { label: "Max drawdown", value: `${fmt(run.max_drawdown_pct, 1)}%` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/backtests"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          &larr; All backtest runs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {pair?.display_name ?? run.pair_id}{" "}
          <span className="text-zinc-500 dark:text-zinc-400">
            &middot; {strategy ? `${strategy.name} v${strategy.version}` : run.strategy_id}
          </span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {new Date(run.period_start).toISOString().slice(0, 10)} to{" "}
          {new Date(run.period_end).toISOString().slice(0, 10)} &middot; run{" "}
          {new Date(run.run_at).toISOString().slice(0, 10)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summary.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
            <p className="mt-1 font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Direction</th>
              <th className="px-3 py-2">Entry time</th>
              <th className="px-3 py-2">Exit time</th>
              <th className="px-3 py-2">Entry</th>
              <th className="px-3 py-2">Exit</th>
              <th className="px-3 py-2">P&amp;L (R)</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">Exit reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {trades.map((t, i) => (
              <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{i + 1}</td>
                <td
                  className={`px-3 py-2 font-semibold uppercase ${
                    t.direction === "long"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {t.direction}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(t.entry_ts).toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(t.exit_ts).toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-3 py-2 font-mono">{fmt(t.entry_price, precision)}</td>
                <td className="px-3 py-2 font-mono">{fmt(t.exit_price, precision)}</td>
                <td
                  className={`px-3 py-2 font-mono ${
                    Number(t.pnl_r) >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {Number(t.pnl_r) >= 0 ? "+" : ""}
                  {fmt(t.pnl_r)}
                </td>
                <td className="px-3 py-2">{t.outcome}</td>
                <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{t.exit_reason}</td>
              </tr>
            ))}
            {trades.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  This run produced no trades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
