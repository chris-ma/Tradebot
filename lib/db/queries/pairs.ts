import { getServiceClient } from "../client";
import { PairRow } from "../types";

export async function listActivePairs(): Promise<PairRow[]> {
  const { data, error } = await getServiceClient()
    .from("pairs")
    .select("*")
    .eq("is_active", true)
    .order("symbol", { ascending: true });

  if (error) throw error;
  return (data as PairRow[]) ?? [];
}
