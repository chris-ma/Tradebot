import { runAndPersistBacktest, BacktestRunSummary } from "@/lib/backtest/persist";
import { listActivePairs } from "@/lib/db/queries/pairs";
import { listActiveStrategies } from "@/lib/db/queries/strategies";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Monthly cron: re-runs the full-history backtest for every active
 * pair x strategy combination so the reliability gate and the track
 * records shown next to live signals stay current.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const runs: BacktestRunSummary[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  try {
    const [pairs, strategies] = await Promise.all([
      listActivePairs(),
      listActiveStrategies(),
    ]);

    for (const pair of pairs) {
      for (const strategy of strategies) {
        try {
          const summary = await runAndPersistBacktest(pair, strategy);
          if (summary) {
            runs.push(summary);
          } else {
            skipped.push(`${pair.symbol} (no candle history)`);
          }
        } catch (err) {
          errors.push(`${pair.symbol}/${strategy.name}: ${String(err)}`);
        }
      }
    }

    return Response.json({ ok: errors.length === 0, runs, skipped, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, runs, error: message }, { status: 500 });
  }
}
