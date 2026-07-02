# Tradebot

Tradebot is a forex swing-trading **advisory** web app. It ingests Daily and H4 candles for ten major pairs and crosses from OANDA, evaluates a two-timeframe confluence strategy (Daily EMA50/EMA200 regime + ADX trend-strength gate, H4 RSI trigger + MACD confirmation, ATR-sized stop/target), and surfaces the resulting buy/sell signals on a Tailwind-styled dashboard with email alerts for high-conviction setups. It never places orders - every signal is a recommendation backed by visible analysis and a backtested track record.

## The "low temperature" design

Signals are deliberately rare. A candidate only fires when **all four** confluence conditions align on closed candles (with two-consecutive-H4-candle confirmation), a 5-trading-day cooldown suppresses repeats, and - crucially - a signal only surfaces on the dashboard if the exact same rule-set, replayed over the pair's full candle history by the backtester, shows at least 30 trades with a win rate of 45%+ and a profit factor of 1.5+. Live engine and backtester share one pure rule function (`lib/signals/rules.ts`), so the win rate shown next to a signal is guaranteed to come from the same logic that produced it. Each surfaced signal carries a 0-100 confidence score (confluence strength + backtest quality + regime stability); only scores at or above the strategy threshold (70) count as "High Conviction" and trigger an email. **An empty dashboard most days is the feature, not a bug.**

## Requirements

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is fine)
- An [OANDA](https://www.oanda.com) v20 API token - create a free **practice** account, then generate a personal access token under Manage API Access
- A [Resend](https://resend.com) API key for email alerts (free tier is fine)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.local.example .env.local
   ```

   | Variable | Where to get it |
   | --- | --- |
   | `OANDA_API_TOKEN` | OANDA practice account, Manage API Access |
   | `OANDA_API_BASE_URL` | `https://api-fxpractice.oanda.com` (practice) or `https://api-fxtrade.oanda.com` (live) |
   | `SUPABASE_URL` | Supabase dashboard, Project Settings, API |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same page - the **service role** key (server-only; never expose it to the browser) |
   | `RESEND_API_KEY` | Resend dashboard, API Keys |
   | `ALERT_EMAIL_TO` | The address that should receive signal alerts |
   | `ALERT_EMAIL_FROM` | Optional verified sender; defaults to Resend's onboarding sender |
   | `APP_BASE_URL` | Deployed origin, used for links in alert emails |
   | `CRON_SECRET` | Any random string; Vercel Cron sends it as `Authorization: Bearer <secret>` |

3. **Run migrations**

   Apply the SQL files in `supabase/migrations/` in order (schema, pair seeds, strategy seed). Either paste them into the Supabase SQL editor, or with the Supabase CLI linked to your project:

   ```bash
   supabase db push
   ```

4. **Backfill candle history** (~5 years of Daily + H4 candles per pair)

   ```bash
   npm run backfill
   ```

5. **Build the initial track records** - signals stay suppressed until a pair has a backtest run, so trigger one for each pair (or hit `/api/cron/rebacktest` once):

   ```bash
   curl -X POST http://localhost:3000/api/admin/backtest/run \
     -H "Authorization: Bearer $CRON_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"pairId":"<uuid>","strategyId":"<uuid>"}'
   ```

## Running

```bash
npm run dev     # dashboard at http://localhost:3000
npm run build   # production build
npm test        # offline unit tests (indicators, rules, backtester, email templates)
npm run lint
```

## Scheduled jobs

`vercel.json` schedules two crons (both protected by `CRON_SECRET`):

- `GET /api/cron/ingest-candles` - every 4 hours: pulls new complete candles from OANDA, then re-evaluates the signal engine for pairs with fresh H4 data. High-conviction signals send a Resend email as an engine-level guarantee.
- `GET /api/cron/rebacktest` - monthly: re-runs the full-history backtest for every active pair x strategy so track records (and the reliability gate) stay current.

Self-hosting instead of Vercel? Hit those two routes on the same cadence with any scheduler, passing the bearer secret.
