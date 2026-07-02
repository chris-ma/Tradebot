import { describe, expect, it } from "vitest";
import { rsi } from "./rsi";

describe("rsi", () => {
  it("aligns output length with input and pads the front with null", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = rsi(closes, 14);
    expect(result.length).toBe(closes.length);
    expect(result[0]).toBeNull();
  });

  it("approaches 100 for a strictly increasing series (no losses)", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const result = rsi(closes, 14);
    const last = result[result.length - 1];
    expect(last).not.toBeNull();
    expect(last as number).toBeGreaterThan(95);
  });

  it("approaches 0 for a strictly decreasing series (no gains)", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 200 - i);
    const result = rsi(closes, 14);
    const last = result[result.length - 1];
    expect(last).not.toBeNull();
    expect(last as number).toBeLessThan(5);
  });
});
