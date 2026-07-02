import { MACD } from "technicalindicators";

export interface MacdPoint {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

/** MACD series aligned to `closes` by index (front-padded with nulls). */
export function macd(
  closes: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): MacdPoint[] {
  const values = MACD.calculate({
    values: closes,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const pad = closes.length - values.length;
  const padded: MacdPoint[] = Array(pad).fill({
    macd: null,
    signal: null,
    histogram: null,
  });

  const mapped: MacdPoint[] = values.map((v) => ({
    macd: v.MACD ?? null,
    signal: v.signal ?? null,
    histogram: v.histogram ?? null,
  }));

  return [...padded, ...mapped];
}
