import { EMA } from "technicalindicators";

/**
 * Returns an EMA series aligned to `closes` by index (front-padded with
 * null for the warmup bars technicalindicators doesn't emit a value for).
 */
export function ema(closes: number[], period: number): (number | null)[] {
  const values = EMA.calculate({ period, values: closes });
  const pad = closes.length - values.length;
  return [...Array(pad).fill(null), ...values];
}
