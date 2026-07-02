import { notFound } from "next/navigation";
import CandleChart, {
  ChartCandle,
  ChartLinePoint,
} from "@/components/charts/CandleChart";
import ConfidenceBadge from "@/components/dashboard/ConfidenceBadge";
import { getRecentCandles } from "@/lib/db/queries/candles";
import { getLatestBacktestRun } from "@/lib/db/queries/backtests";
import { getPairBySymbol } from "@/lib/db/queries/pairs";
import { listSignalsForPair } from "@/lib/db/queries/signals";
import { listActiveStrategies, StrategyRow } from "@/lib/db/queries/strategies";
import { BacktestRunRow, CandleRow, PairRow, SignalRow } from "@/lib/db/types";
import { adx, atr, ema, macd, rsi } from "@/lib/indicators";

export const dynamic = "force-dynamic";

const DAILY_CHART_CANDLES = 260;
const H4_LOOKBACK = 300;

interface PairPageData {
  pair: PairRow | null;
  dailyCandles: CandleRow[];
  h4Candles: CandleRow[];
  signals: SignalRow[];
  strategy: StrategyRow | null;
  backtestRun: BacktestRunRow | null;
  error: string | null;
}

async function loadPairData(symbol: string): Promise<PairPageData> {
  const empty: PairPageData = {
    pair: null,
    dailyCandles: [],
    h4Candles: [],
    signals: [],
    strategy: null,
    backtestRun: null,
    error: null,
  };
  try {
    const pair = await getPairBySymbol(symbol);
    if (!pair) return empty;

    const [dailyCandles, h4Candles, signals, strategies] = await Promise.all([
      getRecentCandles(pair.id, "D", DAILY_CHART_CANDLES),
      getRecentCandles(pair.id, "H4", H4_LOOKBACK),
      listSignalsForPair(pair.id, 25),
      listActiveStrategies(),
    ]);
    const strategy = strategies[0] ?? null;
    const backtestRun = strategy
      ? await getLatestBacktestRun(pair.id, strategy.id)
      : null;

    return { pair, dailyCandles, h4Candles, signals, strategy, backtestRun, error: null };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}

function toUnixSeconds(ts: string): number {
  return Math.floor(new Date(ts).getTime() / 1000);
}

function buildLine(
  candles: CandleRow[],
  series: (number | null)[]
): ChartLinePoint[] {
  const points: ChartLinePoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const value = series[i];
    if (value !== null) points.push({ time: toUnixSeconds(candles[i].ts), value });
  }
  return points;
}

function fmt(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(digits);
}

const STATUS_STYLES: Record<string, string> = {
  active: "text-emerald-600 dark:text-emerald-400",
  target_hit: "text-emerald-600 dark:text-emerald-400",
  stopped_out: "text-rose-600 dark:text-rose-400",
  expired: "text-zinc-500 dark:text-zinc-400",
  suppressed_low_track_record: "text-amber-600 dark:text-amber-400",
};

export default async function PairDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const data = await loadPairData(symbol);

  if (data.error) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <p className="font-semibold">Could not reach the database.</p>
        <p className="mt-1 font-mono text-xs opacity-75">{data.error}</p>
      </div>
    );
  }
  if (!data.pair) notFound();

  const { pair, dailyCandles, h4Candles, signals, strategy, backtestRun } = data;
  const precision = pair.pip_position + 1;

  // Indicator series computed on demand from the same lib the engine uses.
  const p = strategy?.params;
  const dailyCloses = dailyCandles.map((c) => Number(c.close));
  const emaFastSeries = ema(dailyCloses, p?.ema_fast ?? 50);
  const emaSlowSeries = ema(dailyCloses, p?.ema_slow ?? 200);
  const adxSeries = adx(
    dailyCandles.map((c) => Number(c.high)),
    dailyCandles.map((c) => Number(c.low)),
    dailyCloses,
    p?.adx_period ?? 14
  );
  const h4Closes = h4Candles.map((c) => Number(c.close));
  const rsiSeries = rsi(h4Closes, p?.rsi_period ?? 14);
  const macdSeries = macd(
    h4Closes,
    p?.macd_fast ?? 12,
    p?.macd_slow ?? 26,
    p?.macd_signal ?? 9
  );
  const atrSeries = atr(
    h4Candles.map((c) => Number(c.high)),
    h4Candles.map((c) => Number(c.low)),
    h4Closes,
    p?.atr_period ?? 14
  );

  const lastDaily = dailyCandles.length - 1;
  const lastH4 = h4Candles.length - 1;
  const emaFastNow = lastDaily >= 0 ? emaFastSeries[lastDaily] : null;
  const emaSlowNow = lastDaily >= 0 ? emaSlowSeries[lastDaily] : null;
  const adxNow = lastDaily >= 0 ? adxSeries[lastDaily]?.adx ?? null : null;
  const rsiNow = lastH4 >= 0 ? rsiSeries[lastH4] : null;
  const macdNow = lastH4 >= 0 ? macdSeries[lastH4] : null;
  const atrNow = lastH4 >= 0 ? atrSeries[lastH4] : null;

  const regime =
    emaFastNow !== null && emaSlowNow !== null
      ? emaFastNow > emaSlowNow
        ? "Bullish"
        : emaFastNow < emaSlowNow
          ? "Bearish"
          : "Flat"
      : "-";

  const chartCandles: ChartCandle[] = dailyCandles.map((c) => ({
    time: toUnixSeconds(c.ts),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
  }));

  const readings: { label: string; value: string }[] = [
    { label: "Daily regime (EMA50 vs EMA200)", value: regime },
    { label: `EMA ${p?.ema_fast ?? 50} (D)`, value: fmt(emaFastNow, precision) },
    { label: `EMA ${p?.ema_slow ?? 200} (D)`, value: fmt(emaSlowNow, precision) },
    { label: `ADX ${p?.adx_period ?? 14} (D)`, value: fmt(adxNow, 1) },
    { label: `RSI ${p?.rsi_period ?? 14} (H4)`, value: fmt(rsiNow, 1) },
    { label: "MACD line (H4)", value: fmt(macdNow?.macd, precision) },
    { label: "MACD signal (H4)", value: fmt(macdNow?.signal, precision) },
    { label: `ATR ${p?.atr_period ?? 14} (H4)`, value: fmt(atrNow, precision) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{pair.display_name}</h1>
        <p className="mt-1 font-mono text-sm text-zinc-500 dark:text-zinc-400">
          {pair.symbol} &middot; Daily chart with EMA overlays
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <CandleChart
          candles={chartCandles}
          emaFast={buildLine(dailyCandles, emaFastSeries)}
          emaSlow={buildLine(dailyCandles, emaSlowSeries)}
          precision={precision}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Current indicator readings
          </h2>
          <dl className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {readings.map((r) => (
              <div key={r.label} className="flex items-center justify-between py-2 text-sm">
                <dt className="text-zinc-600 dark:text-zinc-400">{r.label}</dt>
                <dd className="font-mono text-zinc-900 dark:text-zinc-100">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Backtested track record
          </h2>
          {backtestRun ? (
            <dl className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
              <div className="flex items-center justify-between py-2 text-sm">
                <dt className="text-zinc-600 dark:text-zinc-400">Trades</dt>
                <dd className="font-mono">{backtestRun.trade_count}</dd>
              </div>
              <div className="flex items-center justify-between py-2 text-sm">
                <dt className="text-zinc-600 dark:text-zinc-400">Win rate</dt>
                <dd className="font-mono">
                  {(Number(backtestRun.win_rate) * 100).toFixed(1)}%
                </dd>
              </div>
              <div className="flex items-center justify-between py-2 text-sm">
                <dt className="text-zinc-600 dark:text-zinc-400">Profit factor</dt>
                <dd className="font-mono">{fmt(backtestRun.profit_factor, 2)}</dd>
              </div>
              <div className="flex items-center justify-between py-2 text-sm">
                <dt className="text-zinc-600 dark:text-zinc-400">Expectancy</dt>
                <dd className="font-mono">{fmt(backtestRun.expectancy_r, 2)}R</dd>
              </div>
              <div className="flex items-center justify-between py-2 text-sm">
                <dt className="text-zinc-600 dark:text-zinc-400">Max drawdown</dt>
                <dd className="font-mono">{fmt(backtestRun.max_drawdown_pct, 1)}%</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              No completed backtest for this pair yet. Until one exists, new
              signals here are suppressed rather than surfaced - the reliability
              gate requires a track record first.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Signal history
        </h2>
        {signals.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            No signals recorded for this pair yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Direction</th>
                  <th className="py-2 pr-4">Entry</th>
                  <th className="py-2 pr-4">Stop</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2 pr-4">Confidence</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {signals.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(s.signal_ts).toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td
                      className={`py-2 pr-4 font-semibold uppercase ${
                        s.direction === "long"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {s.direction}
                    </td>
                    <td className="py-2 pr-4 font-mono">{fmt(s.entry_price, precision)}</td>
                    <td className="py-2 pr-4 font-mono">{fmt(s.stop_loss, precision)}</td>
                    <td className="py-2 pr-4 font-mono">{fmt(s.take_profit, precision)}</td>
                    <td className="py-2 pr-4">
                      <ConfidenceBadge
                        score={Number(s.confidence_score)}
                        threshold={p?.high_conviction_confidence_threshold ?? 70}
                      />
                    </td>
                    <td
                      className={`py-2 text-xs font-medium ${STATUS_STYLES[s.status] ?? ""}`}
                    >
                      {s.status.replaceAll("_", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
