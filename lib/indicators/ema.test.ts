import { describe, expect, it } from "vitest";
import { ema } from "./ema";

describe("ema", () => {
  it("matches a hand-computed EMA for a simple ascending series", () => {
    // period=3 SMA seed: (1+2+3)/3=2, multiplier=2/(3+1)=0.5
    // EMA[3]=(4-2)*0.5+2=3, EMA[4]=(5-3)*0.5+3=4, EMA[5]=(6-4)*0.5+4=5
    const closes = [1, 2, 3, 4, 5, 6];
    expect(ema(closes, 3)).toEqual([null, null, 2, 3, 4, 5]);
  });

  it("front-pads with null so the output aligns with the input by index", () => {
    const closes = [10, 20, 30, 40, 50];
    const result = ema(closes, 2);
    expect(result.length).toBe(closes.length);
    expect(result[0]).toBeNull();
    expect(result[result.length - 1]).not.toBeNull();
  });
});
