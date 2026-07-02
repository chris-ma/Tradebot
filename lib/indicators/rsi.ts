import { RSI } from "technicalindicators";

/** RSI series aligned to `closes` by index (front-padded with null). */
export function rsi(closes: number[], period: number): (number | null)[] {
  const values = RSI.calculate({ period, values: closes });
  const pad = closes.length - values.length;
  return [...Array(pad).fill(null), ...values];
}
