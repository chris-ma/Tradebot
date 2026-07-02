import { ADX } from "technicalindicators";

export interface AdxPoint {
  adx: number | null;
  pdi: number | null;
  mdi: number | null;
}

/** ADX series aligned to `highs`/`lows`/`closes` by index (front-padded with nulls). */
export function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): AdxPoint[] {
  const values = ADX.calculate({ period, high: highs, low: lows, close: closes });
  const pad = closes.length - values.length;
  const padded: AdxPoint[] = Array(pad).fill({ adx: null, pdi: null, mdi: null });

  const mapped: AdxPoint[] = values.map((v) => ({
    adx: v.adx ?? null,
    pdi: v.pdi ?? null,
    mdi: v.mdi ?? null,
  }));

  return [...padded, ...mapped];
}
