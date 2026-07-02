import MetricsTable, { MetricsTableRow } from "@/components/backtests/MetricsTable";
import { listBacktestRuns } from "@/lib/db/queries/backtests";
import { listActivePairs } from "@/lib/db/queries/pairs";
import { listStrategies } from "@/lib/db/queries/strategies";

export const dynamic = "force-dynamic";

async function loadRuns(): Promise<{ rows: MetricsTableRow[]; error: string | null }> {
  try {
    const [runs, pairs, strategies] = await Promise.all([
      listBacktestRuns(),
      listActivePairs(),
      listStrategies(),
    ]);
    const pairsById = new Map(pairs.map((p) => [p.id, p]));
    const strategiesById = new Map(strategies.map((s) => [s.id, s]));
    const rows = runs.map((run) => {
      const strategy = strategiesById.get(run.strategy_id);
      return {
        run,
        pairLabel: pairsById.get(run.pair_id)?.display_name ?? run.pair_id.slice(0, 8),
        strategyLabel: strategy
          ? `${strategy.name} v${strategy.version}`
          : run.strategy_id.slice(0, 8),
      };
    });
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function BacktestsPage() {
  const { rows, error } = await loadRuns();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Backtest runs</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Full-history replays of the exact rule-set the live engine uses. These
          numbers gate which live signals are allowed to surface.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-semibold">Could not reach the database.</p>
          <p className="mt-1 font-mono text-xs opacity-75">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          No backtest runs yet. Trigger one via POST /api/admin/backtest/run or
          the monthly rebacktest cron.
        </div>
      ) : (
        <MetricsTable rows={rows} />
      )}
    </div>
  );
}
