/**
 * One-off historical backfill: pulls ~5 years of Daily and H4 candles for
 * every active pair from OANDA and upserts them into the `candles` table.
 * Requires OANDA_API_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env.
 *
 * Usage: npx tsx scripts/backfill-candles.ts
 */
import { fetchCandles } from "../lib/oanda/client";
import { upsertCandles } from "../lib/db/queries/candles";
import { listActivePairs } from "../lib/db/queries/pairs";
import { startIngestionRun, finishIngestionRun } from "../lib/db/queries/ingestion";
import { Granularity } from "../lib/oanda/types";

const GRANULARITIES: Granularity[] = ["D", "H4"];
const MAX_COUNT_PER_REQUEST = 5000;
// ~5 years of history: ~1300 daily bars, ~7800 H4 bars.
const TARGET_CANDLE_COUNT: Record<Granularity, number> = { D: 1300, H4: 7800 };

/** Pages backwards from "now" using `to`, upserting each page as it arrives. */
async function backfillPairGranularity(
  pairId: string,
  instrument: string,
  granularity: Granularity
): Promise<number> {
  let inserted = 0;
  let to: string | undefined;
  let remaining = TARGET_CANDLE_COUNT[granularity];

  while (remaining > 0) {
    const count = Math.min(MAX_COUNT_PER_REQUEST, remaining);
    const candles = await fetchCandles({ instrument, granularity, count, to });
    if (candles.length === 0) break;

    inserted += await upsertCandles(pairId, granularity, candles);
    to = candles[0].ts; // page further back in time on the next request
    remaining -= candles.length;

    if (candles.length < count) break; // ran out of available history
  }

  return inserted;
}

async function main() {
  const pairs = await listActivePairs();
  const runId = await startIngestionRun();
  let totalInserted = 0;

  try {
    for (const pair of pairs) {
      for (const granularity of GRANULARITIES) {
        console.log(`Backfilling ${pair.symbol} ${granularity}...`);
        const inserted = await backfillPairGranularity(pair.id, pair.symbol, granularity);
        console.log(`  upserted ${inserted} candles`);
        totalInserted += inserted;
      }
    }

    await finishIngestionRun(runId, { pairsProcessed: pairs.length, candlesInserted: totalInserted });
    console.log(`Backfill complete: ${totalInserted} candles across ${pairs.length} pairs.`);
  } catch (err) {
    await finishIngestionRun(runId, {
      pairsProcessed: pairs.length,
      candlesInserted: totalInserted,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
