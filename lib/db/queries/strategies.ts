import { getServiceClient } from "../client";
import { StrategyParams } from "../../signals/rules";

export interface StrategyRow {
  id: string;
  name: string;
  version: number;
  params: StrategyParams;
  is_active: boolean;
}

export async function getActiveStrategy(name: string): Promise<StrategyRow | null> {
  const { data, error } = await getServiceClient()
    .from("strategies")
    .select("*")
    .eq("name", name)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as StrategyRow) ?? null;
}

export async function listActiveStrategies(): Promise<StrategyRow[]> {
  const { data, error } = await getServiceClient()
    .from("strategies")
    .select("*")
    .eq("is_active", true);

  if (error) throw error;
  return (data as StrategyRow[]) ?? [];
}
