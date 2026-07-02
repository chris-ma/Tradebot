"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  UTCTimestamp,
} from "lightweight-charts";

export interface ChartCandle {
  time: number; // UNIX seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartLinePoint {
  time: number; // UNIX seconds (UTC)
  value: number;
}

interface CandleChartProps {
  candles: ChartCandle[];
  emaFast: ChartLinePoint[];
  emaSlow: ChartLinePoint[];
  /** Decimal places for the price scale, e.g. pip_position + 1. */
  precision: number;
}

/**
 * lightweight-charts (v5) candlestick chart with EMA50/EMA200 overlays.
 * Mounted client-side only; all series data is computed on the server and
 * passed in as plain serializable arrays.
 */
export default function CandleChart({
  candles,
  emaFast,
  emaSlow,
  precision,
}: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.12)" },
        horzLines: { color: "rgba(148, 163, 184, 0.12)" },
      },
      rightPriceScale: { borderColor: "rgba(148, 163, 184, 0.3)" },
      timeScale: { borderColor: "rgba(148, 163, 184, 0.3)" },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
      priceFormat: { type: "price", precision, minMove: 10 ** -precision },
    });
    candleSeries.setData(
      candles.map((c) => ({ ...c, time: c.time as UTCTimestamp }))
    );

    const fastSeries = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "EMA 50",
    });
    fastSeries.setData(
      emaFast.map((p) => ({ ...p, time: p.time as UTCTimestamp }))
    );

    const slowSeries = chart.addSeries(LineSeries, {
      color: "#c084fc",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "EMA 200",
    });
    slowSeries.setData(
      emaSlow.map((p) => ({ ...p, time: p.time as UTCTimestamp }))
    );

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
  }, [candles, emaFast, emaSlow, precision]);

  if (candles.length === 0) {
    return (
      <div className="flex h-96 w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No candle data yet - run the backfill script to populate this chart.
      </div>
    );
  }

  return <div ref={containerRef} className="h-96 w-full" />;
}
