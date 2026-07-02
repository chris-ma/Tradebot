import { getServiceClient } from "../client";
import { Direction, SignalInsert, SignalRow } from "../types";

export async function insertSignal(signal: SignalInsert): Promise<SignalRow> {
  const { data, error } = await getServiceClient()
    .from("signals")
    .insert(signal)
    .select()
    .single();

  if (error) throw error;
  return data as SignalRow;
}

/**
 * Most recent signal for this pair+direction, used for cooldown enforcement.
 * Only considers surfaced signals (active/closed), not suppressed ones.
 */
export async function getLastSignalForPairDirection(
  pairId: string,
  direction: Direction
): Promise<SignalRow | null> {
  const { data, error } = await getServiceClient()
    .from("signals")
    .select("*")
    .eq("pair_id", pairId)
    .eq("direction", direction)
    .neq("status", "suppressed_low_track_record")
    .order("signal_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as SignalRow) ?? null;
}

export async function getActiveSignals(): Promise<SignalRow[]> {
  const { data, error } = await getServiceClient()
    .from("signals")
    .select("*")
    .eq("status", "active")
    .order("confidence_score", { ascending: false });

  if (error) throw error;
  return (data as SignalRow[]) ?? [];
}

export async function markEmailSent(signalId: string): Promise<void> {
  const { error } = await getServiceClient()
    .from("signals")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", signalId);

  if (error) throw error;
}
