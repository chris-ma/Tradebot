import { IndicatorSnapshot } from "../signals/rules";
import { PairRow, SignalRow } from "../db/types";

export interface SignalAlertEmail {
  subject: string;
  html: string;
  text: string;
}

/** Prices are shown with one digit beyond the pip (OANDA-style precision). */
function formatPrice(price: number, pair: PairRow): string {
  return price.toFixed(pair.pip_position + 1);
}

function round1(x: number): string {
  return (Math.round(x * 10) / 10).toString();
}

/**
 * Plain-language rendering of the confluence rationale captured in the
 * signal's indicator snapshot - one line per condition, in both the text
 * and HTML bodies.
 */
export function buildRationaleLines(
  snapshot: IndicatorSnapshot,
  direction: "long" | "short"
): string[] {
  const trendWord = direction === "long" ? "bullish" : "bearish";
  const emaComparator = direction === "long" ? ">" : "<";
  const macdRelation = direction === "long" ? "above" : "below";
  return [
    `Daily trend regime is ${trendWord}: EMA50 ${snapshot.ema_fast.toFixed(5)} ${emaComparator} EMA200 ${snapshot.ema_slow.toFixed(5)}`,
    `Daily ADX ${round1(snapshot.adx_daily)} confirms a trending market (threshold 25)`,
    `H4 RSI ${round1(snapshot.rsi_h4)} is in the ${direction} entry zone`,
    `H4 MACD ${snapshot.macd_h4.toFixed(5)} is ${macdRelation} its signal line ${snapshot.macd_signal_h4.toFixed(5)}`,
    `H4 ATR ${snapshot.atr_h4.toFixed(5)} sizes the stop and target`,
  ];
}

export interface BuildSignalAlertEmailInput {
  signal: SignalRow;
  pair: PairRow;
  /** Origin of the deployed app, e.g. https://tradebot.example.com */
  baseUrl: string;
}

export function buildSignalAlertEmail({
  signal,
  pair,
  baseUrl,
}: BuildSignalAlertEmailInput): SignalAlertEmail {
  const directionLabel = signal.direction === "long" ? "BUY" : "SELL";
  const entry = formatPrice(signal.entry_price, pair);
  const stop = formatPrice(signal.stop_loss, pair);
  const target = formatPrice(signal.take_profit, pair);
  const confidence = round1(signal.confidence_score);
  const rationale = buildRationaleLines(signal.indicator_snapshot, signal.direction);
  const pairUrl = `${baseUrl.replace(/\/$/, "")}/pairs/${pair.symbol}`;

  const subject = `Tradebot: ${directionLabel} ${pair.display_name} - high conviction (${confidence}/100)`;

  const text = [
    `High-conviction ${signal.direction.toUpperCase()} signal on ${pair.display_name} (${pair.symbol}).`,
    ``,
    `Direction:  ${directionLabel}`,
    `Entry:      ${entry}`,
    `Stop loss:  ${stop}`,
    `Target:     ${target}`,
    `Risk/Rew:   ${signal.risk_reward.toFixed(2)}R`,
    `Confidence: ${confidence}/100`,
    `Signal at:  ${signal.signal_ts}`,
    ``,
    `Why this signal fired:`,
    ...rationale.map((line) => `- ${line}`),
    ``,
    `Full chart and track record: ${pairUrl}`,
    ``,
    `This is an advisory signal, not an order. Tradebot never trades on your behalf.`,
  ].join("\n");

  const rationaleHtml = rationale
    .map((line) => `<li style="margin-bottom:4px;">${line}</li>`)
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0b0f17;color:#e5e7eb;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:12px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:1px;color:#9ca3af;text-transform:uppercase;">Tradebot high-conviction signal</p>
      <h1 style="margin:0 0 16px;font-size:22px;color:${signal.direction === "long" ? "#34d399" : "#f87171"};">
        ${directionLabel} ${pair.display_name}
      </h1>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#9ca3af;">Entry</td><td style="padding:6px 0;text-align:right;font-family:monospace;">${entry}</td></tr>
        <tr><td style="padding:6px 0;color:#9ca3af;">Stop loss</td><td style="padding:6px 0;text-align:right;font-family:monospace;">${stop}</td></tr>
        <tr><td style="padding:6px 0;color:#9ca3af;">Target</td><td style="padding:6px 0;text-align:right;font-family:monospace;">${target}</td></tr>
        <tr><td style="padding:6px 0;color:#9ca3af;">Risk/reward</td><td style="padding:6px 0;text-align:right;font-family:monospace;">${signal.risk_reward.toFixed(2)}R</td></tr>
        <tr><td style="padding:6px 0;color:#9ca3af;">Confidence</td><td style="padding:6px 0;text-align:right;font-family:monospace;">${confidence}/100</td></tr>
        <tr><td style="padding:6px 0;color:#9ca3af;">Signal time</td><td style="padding:6px 0;text-align:right;font-family:monospace;">${signal.signal_ts}</td></tr>
      </table>
      <h2 style="margin:20px 0 8px;font-size:14px;color:#e5e7eb;">Why this signal fired</h2>
      <ul style="margin:0 0 20px;padding-left:20px;font-size:13px;color:#d1d5db;">${rationaleHtml}</ul>
      <a href="${pairUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;">View chart &amp; track record</a>
      <p style="margin:20px 0 0;font-size:11px;color:#6b7280;">Advisory only - Tradebot never places orders. Signals are gated by backtested reliability for this pair and strategy.</p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}
