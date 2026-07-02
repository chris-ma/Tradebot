import { describe, expect, it } from "vitest";
import { adx } from "./adx";

function trendingCandles(n: number) {
  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];
  let close = 100;
  for (let i = 0; i < n; i++) {
    close += 1;
    highs.push(close + 0.5);
    lows.push(close - 0.5);
    closes.push(close);
  }
  return { highs, lows, closes };
}

function choppyCandles(n: number) {
  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];
  let close = 100;
  for (let i = 0; i < n; i++) {
    // Deterministic pseudo-noise (no net trend) - avoids the perfectly
    // symmetric alternation that can degenerate ADX's DI ratio to 0/0.
    close += Math.sin(i * 1.7) * 1.5;
    highs.push(close + 0.5);
    lows.push(close - 0.5);
    closes.push(close);
  }
  return { highs, lows, closes };
}

describe("adx", () => {
  it("aligns output length with input and pads the front with nulls", () => {
    const { highs, lows, closes } = trendingCandles(40);
    const result = adx(highs, lows, closes, 14);
    expect(result.length).toBe(closes.length);
    expect(result[0]).toEqual({ adx: null, pdi: null, mdi: null });
  });

  it("reports a higher ADX for a strongly trending series than a choppy one", () => {
    const trending = trendingCandles(60);
    const choppy = choppyCandles(60);
    const trendingAdx = adx(trending.highs, trending.lows, trending.closes, 14).at(-1)!.adx;
    const choppyAdx = adx(choppy.highs, choppy.lows, choppy.closes, 14).at(-1)!.adx;
    expect(trendingAdx).not.toBeNull();
    expect(choppyAdx).not.toBeNull();
    expect(trendingAdx as number).toBeGreaterThan(choppyAdx as number);
  });
});
