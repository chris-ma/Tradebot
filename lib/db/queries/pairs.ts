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

export async function getPairBySymbol(symbol: string): Promise<PairRow | null> {
  const { data, error } = await getServiceClient()
    .from("pairs")
    .select("*")
    .eq("symbol", symbol)
    .maybeSingle();

  if (error) throw error;
  return (data as PairRow) ?? null;
}

export async function getPairById(id: string): Promise<PairRow | null> {
  const { data, error } = await getServiceClient()
    .from("pairs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as PairRow) ?? null;
}
