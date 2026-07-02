import { describe, expect, it } from "vitest";
import { buildRationaleLines, buildSignalAlertEmail } from "./templates";
import { PairRow, SignalRow } from "../db/types";

const pair: PairRow = {
  id: "pair-1",
  symbol: "EUR_USD",
  display_name: "EUR/USD",
  pip_position: 4,
  is_active: true,
};

const signal: SignalRow = {
  id: "sig-1",
  pair_id: "pair-1",
  strategy_id: "strat-1",
  direction: "long",
  signal_ts: "2026-07-01T12:00:00Z",
  entry_price: 1.08425,
  stop_loss: 1.07825,
  take_profit: 1.09425,
  risk_reward: 1.667,
  indicator_snapshot: {
    ema_fast: 1.081,
    ema_slow: 1.072,
    adx_daily: 31.4,
    rsi_h4: 56.2,
    macd_h4: 0.0012,
    macd_signal_h4: 0.0008,
    atr_h4: 0.004,
  },
  confidence_score: 82.5,
  status: "active",
  closed_at: null,
  closed_price: null,
  outcome: null,
  email_sent_at: null,
  created_at: "2026-07-01T12:01:00Z",
};

describe("buildSignalAlertEmail", () => {
  const email = buildSignalAlertEmail({
    signal,
    pair,
    baseUrl: "https://tradebot.example.com/",
  });

  it("puts direction, pair, and confidence in the subject", () => {
    expect(email.subject).toContain("BUY");
    expect(email.subject).toContain("EUR/USD");
    expect(email.subject).toContain("82.5");
  });

  it("renders entry/stop/target at pip precision in both bodies", () => {
    // pip_position 4 -> 5 decimal places
    for (const body of [email.text, email.html]) {
      expect(body).toContain("1.08425");
      expect(body).toContain("1.07825");
      expect(body).toContain("1.09425");
    }
  });

  it("includes confidence score and risk/reward", () => {
    expect(email.text).toContain("82.5/100");
    expect(email.text).toContain("1.67R");
  });

  it("links back to the pair detail page without a double slash", () => {
    expect(email.text).toContain("https://tradebot.example.com/pairs/EUR_USD");
    expect(email.html).toContain("https://tradebot.example.com/pairs/EUR_USD");
    expect(email.html).not.toContain("example.com//pairs");
  });

  it("renders the confluence rationale from the indicator snapshot", () => {
    expect(email.text).toContain("Why this signal fired");
    expect(email.text).toContain("bullish");
    expect(email.text).toContain("ADX 31.4");
    expect(email.text).toContain("RSI 56.2");
  });

  it("mirrors the wording for short signals", () => {
    const shortEmail = buildSignalAlertEmail({
      signal: { ...signal, direction: "short" },
      pair,
      baseUrl: "https://tradebot.example.com",
    });
    expect(shortEmail.subject).toContain("SELL");
    expect(shortEmail.text).toContain("bearish");
  });
});

describe("buildRationaleLines", () => {
  it("produces one line per confluence condition", () => {
    const lines = buildRationaleLines(signal.indicator_snapshot, "long");
    expect(lines).toHaveLength(5);
    expect(lines.join("\n")).toContain("EMA50");
    expect(lines.join("\n")).toContain("MACD");
    expect(lines.join("\n")).toContain("ATR");
  });
});
