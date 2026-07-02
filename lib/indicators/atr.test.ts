import { describe, expect, it } from "vitest";
import { atr } from "./atr";

describe("atr", () => {
  it("converges to the constant true range for a series with no gaps", () => {
    // Every bar: high=101, low=99, close=100 -> true range is always
    // exactly high-low=2 (no prior-close gap), so ATR should settle at 2.
    const n = 20;
    const highs = Array(n).fill(101);
    const lows = Array(n).fill(99);
    const closes = Array(n).fill(100);
    const result = atr(highs, lows, closes, 5);
    expect(result[result.length - 1]).toBeCloseTo(2, 5);
  });

  it("aligns output length with input and pads the front with null", () => {
    const n = 20;
    const highs = Array(n).fill(101);
    const lows = Array(n).fill(99);
    const closes = Array(n).fill(100);
    const result = atr(highs, lows, closes, 5);
    expect(result.length).toBe(n);
    expect(result[0]).toBeNull();
  });
});
