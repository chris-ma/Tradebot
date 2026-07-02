import { getServiceClient } from "../client";

export async function startIngestionRun(): Promise<string> {
  const { data, error } = await getServiceClient()
    .from("ingestion_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function finishIngestionRun(
  id: string,
  result: { pairsProcessed: number; candlesInserted: number; error?: string }
): Promise<void> {
  const { error } = await getServiceClient()
    .from("ingestion_runs")
    .update({
      finished_at: new Date().toISOString(),
      pairs_processed: result.pairsProcessed,
      candles_inserted: result.candlesInserted,
      status: result.error ? "failed" : "success",
      error: result.error ?? null,
    })
    .eq("id", id);

  if (error) throw error;
}
