import { ATR } from "technicalindicators";

/** ATR series aligned to `highs`/`lows`/`closes` by index (front-padded with null). */
export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): (number | null)[] {
  const values = ATR.calculate({ period, high: highs, low: lows, close: closes });
  const pad = closes.length - values.length;
  return [...Array(pad).fill(null), ...values];
}
