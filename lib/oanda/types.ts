import { z } from "zod";

export const Granularity = z.enum(["D", "H4"]);
export type Granularity = z.infer<typeof Granularity>;

const OandaCandleSchema = z.object({
  time: z.string(),
  volume: z.number(),
  complete: z.boolean(),
  mid: z.object({
    o: z.string(),
    h: z.string(),
    l: z.string(),
    c: z.string(),
  }),
});

export const OandaCandlesResponseSchema = z.object({
  instrument: z.string(),
  granularity: z.string(),
  candles: z.array(OandaCandleSchema),
});

export type OandaCandle = z.infer<typeof OandaCandleSchema>;
export type OandaCandlesResponse = z.infer<typeof OandaCandlesResponseSchema>;

/** A parsed, numeric candle ready for storage/indicator computation. */
export interface Candle {
  ts: string; // ISO timestamp, candle open time as returned by OANDA
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
}

export function parseOandaCandle(raw: OandaCandle): Candle {
  return {
    ts: raw.time,
    open: Number(raw.mid.o),
    high: Number(raw.mid.h),
    low: Number(raw.mid.l),
    close: Number(raw.mid.c),
    volume: raw.volume,
    complete: raw.complete,
  };
}
