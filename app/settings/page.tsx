import { listActiveStrategies, StrategyRow } from "@/lib/db/queries/strategies";

export const dynamic = "force-dynamic";

async function loadStrategies(): Promise<{
  strategies: StrategyRow[];
  error: string | null;
}> {
  try {
    return { strategies: await listActiveStrategies(), error: null };
  } catch (err) {
    return {
      strategies: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const PARAM_LABELS: Record<string, string> = {
  ema_fast: "Fast EMA period (Daily regime)",
  ema_slow: "Slow EMA period (Daily regime)",
  rsi_period: "RSI period (H4 trigger)",
  rsi_long_trigger: "RSI long trigger",
  rsi_long_ceiling: "RSI long ceiling",
  rsi_short_trigger: "RSI short trigger",
  rsi_short_floor: "RSI short floor",
  macd_fast: "MACD fast period",
  macd_slow: "MACD slow period",
  macd_signal: "MACD signal period",
  adx_period: "ADX period (Daily)",
  adx_threshold: "ADX trend-strength threshold",
  atr_period: "ATR period (H4)",
  atr_stop_multiplier: "Stop = entry - ATR x",
  atr_target_multiplier: "Target = entry + ATR x",
  cooldown_trading_days: "Cooldown (trading days)",
  confirmation_candles: "H4 confirmation candles",
  min_backtest_trade_count: "Gate: min backtested trades",
  min_backtest_win_rate: "Gate: min win rate",
  min_backtest_profit_factor: "Gate: min profit factor",
  high_conviction_confidence_threshold: "High-conviction threshold (0-100)",
};

export default async function SettingsPage() {
  const { strategies, error } = await loadStrategies();
  const alertEmail = process.env.ALERT_EMAIL_TO;
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Strategy parameters are read-only here - changing them creates a new
          versioned strategy row rather than mutating history.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Email alerts
        </h2>
        <dl className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="flex items-center justify-between py-2 text-sm">
            <dt className="text-zinc-600 dark:text-zinc-400">Alert recipient (ALERT_EMAIL_TO)</dt>
            <dd className="font-mono text-zinc-900 dark:text-zinc-100">
              {alertEmail ?? "not configured"}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <dt className="text-zinc-600 dark:text-zinc-400">Resend API key</dt>
            <dd
              className={`font-mono ${
                resendConfigured
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {resendConfigured ? "configured" : "missing"}
            </dd>
          </div>
          <div className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
            Only high-conviction signals (active status and confidence at or
            above the threshold below) send email. Suppressed or moderate
            signals never do.
          </div>
        </dl>
      </section>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-semibold">Could not load strategies from the database.</p>
          <p className="mt-1 font-mono text-xs opacity-75">{error}</p>
        </div>
      ) : (
        strategies.map((strategy) => (
          <section
            key={strategy.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Strategy: {strategy.name} v{strategy.version}
            </h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {Object.entries(strategy.params).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b border-zinc-100 py-2 text-sm dark:border-zinc-800"
                >
                  <dt className="text-zinc-600 dark:text-zinc-400">
                    {PARAM_LABELS[key] ?? key}
                  </dt>
                  <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))
      )}
    </div>
  );
}
