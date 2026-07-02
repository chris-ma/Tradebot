import { getServiceClient } from "../client";
import { Candle } from "../../oanda/types";
import { CandleRow, Granularity } from "../types";

/**
 * Idempotently upserts candles for a pair/granularity.
 * Relies on the unique (pair_id, granularity, ts) constraint.
 */
export async function upsertCandles(
  pairId: string,
  granularity: Granularity,
  candles: Candle[]
): Promise<number> {
  if (candles.length === 0) return 0;

  const rows = candles.map((c) => ({
    pair_id: pairId,
    granularity,
    ts: c.ts,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    complete: c.complete,
  }));

  const { error, count } = await getServiceClient()
    .from("candles")
    .upsert(rows, { onConflict: "pair_id,granularity,ts", count: "exact" });

  if (error) throw error;
  return count ?? rows.length;
}

/** Returns the most recent `limit` complete candles, oldest first. */
export async function getRecentCandles(
  pairId: string,
  granularity: Granularity,
  limit: number
): Promise<CandleRow[]> {
  const { data, error } = await getServiceClient()
    .from("candles")
    .select("*")
    .eq("pair_id", pairId)
    .eq("granularity", granularity)
    .eq("complete", true)
    .order("ts", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).reverse();
}

/** Returns the ts of the most recently stored candle for incremental polling. */
export async function getLatestCandleTs(
  pairId: string,
  granularity: Granularity
): Promise<string | null> {
  const { data, error } = await getServiceClient()
    .from("candles")
    .select("ts")
    .eq("pair_id", pairId)
    .eq("granularity", granularity)
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.ts ?? null;
}

/** Returns full ordered candle history for a pair/granularity (used by the backtester). */
export async function getAllCandles(
  pairId: string,
  granularity: Granularity
): Promise<CandleRow[]> {
  const { data, error } = await getServiceClient()
    .from("candles")
    .select("*")
    .eq("pair_id", pairId)
    .eq("granularity", granularity)
    .eq("complete", true)
    .order("ts", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
