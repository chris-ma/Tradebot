import { fetchCandles } from "@/lib/oanda/client";
import { getLatestCandleTs, upsertCandles } from "@/lib/db/queries/candles";
import { finishIngestionRun, startIngestionRun } from "@/lib/db/queries/ingestion";
import { listActivePairs } from "@/lib/db/queries/pairs";
import { listActiveStrategies } from "@/lib/db/queries/strategies";
import { Granularity } from "@/lib/db/types";
import { evaluateAndPersistSignal } from "@/lib/signals/engine";

export const dynamic = "force-dynamic";

/** Initial backfill depth when a pair has no stored candles yet. */
const BOOTSTRAP_CANDLE_COUNT = 500;
const GRANULARITIES: Granularity[] = ["D", "H4"];

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

interface SignalSummary {
  pair: string;
  strategy: string;
  direction: string;
  status: string;
  confidenceScore: number;
  isHighConviction: boolean;
}

/**
 * Vercel-cron entry point: pulls the latest complete D/H4 candles from OANDA
 * for every active pair, then re-evaluates the signal engine for each pair
 * that received new H4 data.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const ingestionRunId = await startIngestionRun();
  let pairsProcessed = 0;
  let candlesInserted = 0;
  const signals: SignalSummary[] = [];
  const errors: string[] = [];

  try {
    const [pairs, strategies] = await Promise.all([
      listActivePairs(),
      listActiveStrategies(),
    ]);

    for (const pair of pairs) {
      let newH4Candles = 0;

      for (const granularity of GRANULARITIES) {
        const lastTs = await getLatestCandleTs(pair.id, granularity);
        const fetched = await fetchCandles({
          instrument: pair.symbol,
          granularity,
          ...(lastTs ? { from: lastTs } : { count: BOOTSTRAP_CANDLE_COUNT }),
        });
        // OANDA's `from` is inclusive, so drop the already-stored candle.
        const fresh = lastTs
          ? fetched.filter((c) => new Date(c.ts).getTime() > new Date(lastTs).getTime())
          : fetched;
        const inserted = await upsertCandles(pair.id, granularity, fresh);
        candlesInserted += inserted;
        if (granularity === "H4") newH4Candles = inserted;
      }
      pairsProcessed++;

      if (newH4Candles > 0) {
        for (const strategy of strategies) {
          try {
            const result = await evaluateAndPersistSignal(pair.id, strategy);
            if (result) {
              signals.push({
                pair: pair.symbol,
                strategy: `${strategy.name} v${strategy.version}`,
                direction: result.signal.direction,
                status: result.signal.status,
                confidenceScore: result.signal.confidence_score,
                isHighConviction: result.isHighConviction,
              });
            }
          } catch (err) {
            errors.push(`signal ${pair.symbol}/${strategy.name}: ${String(err)}`);
          }
        }
      }
    }

    await finishIngestionRun(ingestionRunId, {
      pairsProcessed,
      candlesInserted,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    });

    return Response.json({
      ok: true,
      pairsProcessed,
      candlesInserted,
      signals,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishIngestionRun(ingestionRunId, {
      pairsProcessed,
      candlesInserted,
      error: message,
    }).catch(() => {});
    return Response.json(
      { ok: false, pairsProcessed, candlesInserted, error: message },
      { status: 500 }
    );
  }
}
