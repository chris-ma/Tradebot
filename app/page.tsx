import SignalCard from "@/components/dashboard/SignalCard";
import { getActiveSignals } from "@/lib/db/queries/signals";
import { listActivePairs } from "@/lib/db/queries/pairs";
import { listActiveStrategies, StrategyRow } from "@/lib/db/queries/strategies";
import { PairRow, SignalRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const DEFAULT_THRESHOLD = 70;

interface OverviewData {
  signals: SignalRow[];
  pairsById: Map<string, PairRow>;
  strategiesById: Map<string, StrategyRow>;
  error: string | null;
}

async function loadOverview(): Promise<OverviewData> {
  try {
    const [signals, pairs, strategies] = await Promise.all([
      getActiveSignals(),
      listActivePairs(),
      listActiveStrategies(),
    ]);
    return {
      signals,
      pairsById: new Map(pairs.map((p) => [p.id, p])),
      strategiesById: new Map(strategies.map((s) => [s.id, s])),
      error: null,
    };
  } catch (err) {
    return {
      signals: [],
      pairsById: new Map(),
      strategiesById: new Map(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function OverviewPage() {
  const { signals, pairsById, strategiesById, error } = await loadOverview();

  // getActiveSignals already orders by confidence desc; keep it explicit.
  const sorted = [...signals].sort(
    (a, b) => Number(b.confidence_score) - Number(a.confidence_score)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Active signals</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Confluence setups that cleared the backtest reliability gate, sorted by
          confidence.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-semibold">Could not reach the database.</p>
          <p className="mt-1">
            Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
            <span className="mt-1 block font-mono text-xs opacity-75">{error}</span>
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-lg font-medium text-zinc-700 dark:text-zinc-200">
            No high-conviction setups right now.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            This is by design: signals only surface when the daily trend regime,
            ADX, RSI, and MACD all align and the pair&apos;s backtested track
            record clears the reliability bar. Most days that means zero alerts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((signal) => {
            const pair = pairsById.get(signal.pair_id);
            if (!pair) return null;
            const threshold =
              strategiesById.get(signal.strategy_id)?.params
                .high_conviction_confidence_threshold ?? DEFAULT_THRESHOLD;
            return (
              <SignalCard
                key={signal.id}
                signal={signal}
                pair={pair}
                threshold={threshold}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
