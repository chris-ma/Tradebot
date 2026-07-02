import Link from "next/link";
import { listActivePairs } from "@/lib/db/queries/pairs";
import { PairRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

async function loadPairs(): Promise<{ pairs: PairRow[]; error: string | null }> {
  try {
    return { pairs: await listActivePairs(), error: null };
  } catch (err) {
    return { pairs: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function PairsPage() {
  const { pairs, error } = await loadPairs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pairs</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Active instruments monitored by the signal engine.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-semibold">Could not reach the database.</p>
          <p className="mt-1 font-mono text-xs opacity-75">{error}</p>
        </div>
      ) : pairs.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No active pairs found - run the seed migrations first.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pairs.map((pair) => (
            <Link
              key={pair.id}
              href={`/pairs/${pair.symbol}`}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-500"
            >
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {pair.display_name}
              </p>
              <p className="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {pair.symbol}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
