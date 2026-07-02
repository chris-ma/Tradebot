import {
  Candle,
  Granularity,
  OandaCandlesResponseSchema,
  parseOandaCandle,
} from "./types";

const PRACTICE_HOST = "https://api-fxpractice.oanda.com";
const LIVE_HOST = "https://api-fxtrade.oanda.com";

function getBaseUrl(): string {
  const configured = process.env.OANDA_API_BASE_URL;
  if (configured) return configured;
  return process.env.OANDA_ENV === "live" ? LIVE_HOST : PRACTICE_HOST;
}

function getToken(): string {
  const token = process.env.OANDA_API_TOKEN;
  if (!token) {
    throw new Error("OANDA_API_TOKEN is not set");
  }
  return token;
}

export interface FetchCandlesParams {
  instrument: string; // e.g. 'EUR_USD'
  granularity: Granularity;
  /** Max 5000, used for historical backfill. */
  count?: number;
  /** RFC3339, used for incremental polling from the last stored candle. */
  from?: string;
  to?: string;
}

const MAX_RETRIES = 3;

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500) {
        lastError = new Error(`OANDA server error: ${res.status}`);
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`OANDA request failed (${res.status}): ${body}`);
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt === MAX_RETRIES - 1) throw err;
      await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
    }
  }
  throw lastError;
}

/**
 * Fetches candles for one instrument/granularity from OANDA's v20 API.
 * Only complete candles are returned - the still-forming candle is filtered out.
 */
export async function fetchCandles(params: FetchCandlesParams): Promise<Candle[]> {
  const { instrument, granularity, count, from, to } = params;
  const url = new URL(`/v3/instruments/${instrument}/candles`, getBaseUrl());
  url.searchParams.set("granularity", granularity);
  url.searchParams.set("price", "M");
  if (count !== undefined) url.searchParams.set("count", String(count));
  if (from) url.searchParams.set("from", from);
  if (to) url.searchParams.set("to", to);

  const res = await fetchWithRetry(url.toString(), {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
  });

  const json = await res.json();
  const parsed = OandaCandlesResponseSchema.parse(json);
  return parsed.candles
    .filter((c) => c.complete)
    .map(parseOandaCandle);
}
