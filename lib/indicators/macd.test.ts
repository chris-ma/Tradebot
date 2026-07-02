import { describe, expect, it } from "vitest";
import { macd } from "./macd";

describe("macd", () => {
  it("aligns output length with input and pads the front with nulls", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + i * 0.1);
    const result = macd(closes, 12, 26, 9);
    expect(result.length).toBe(closes.length);
    expect(result[0]).toEqual({ macd: null, signal: null, histogram: null });
  });

  it("shows a positive MACD line for a sustained uptrend (fast EMA above slow EMA)", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.2);
    const result = macd(closes, 12, 26, 9);
    const last = result[result.length - 1];
    expect(last.macd).not.toBeNull();
    expect(last.macd as number).toBeGreaterThan(0);
  });

  it("shows a negative MACD line for a sustained downtrend", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 200 - i * 0.2);
    const result = macd(closes, 12, 26, 9);
    const last = result[result.length - 1];
    expect(last.macd).not.toBeNull();
    expect(last.macd as number).toBeLessThan(0);
  });
});
