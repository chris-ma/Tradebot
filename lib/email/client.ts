import { Resend } from "resend";
import { PairRow, SignalRow } from "../db/types";
import { buildSignalAlertEmail } from "./templates";

let cached: Resend | null = null;

function getResendClient(): Resend {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  cached = new Resend(apiKey);
  return cached;
}

const DEFAULT_FROM = "Tradebot <onboarding@resend.dev>";

/**
 * Sends the high-conviction signal alert email via Resend.
 * Recipient comes from ALERT_EMAIL_TO; the pair-detail link uses
 * APP_BASE_URL (falls back to localhost for dev).
 */
export async function sendSignalAlertEmail(
  signal: SignalRow,
  pair: PairRow
): Promise<void> {
  const to = process.env.ALERT_EMAIL_TO;
  if (!to) {
    throw new Error("ALERT_EMAIL_TO is not set");
  }
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const from = process.env.ALERT_EMAIL_FROM ?? DEFAULT_FROM;

  const { subject, html, text } = buildSignalAlertEmail({ signal, pair, baseUrl });

  const { error } = await getResendClient().emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
