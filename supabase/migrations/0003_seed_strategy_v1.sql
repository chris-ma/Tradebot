-- Seed strategy v1: ema_trend_rsi_macd_adx_atr
-- Daily EMA50/EMA200 regime + ADX(14) trend-strength gate,
-- H4 RSI(14) entry trigger + MACD(12,26,9) confirmation,
-- ATR(14)-based stop/target, with cooldown + two-candle confirmation
-- to keep the signal feed low-frequency / high-conviction.
insert into strategies (name, version, params, is_active) values (
  'ema_trend_rsi_macd_adx_atr',
  1,
  '{
    "ema_fast": 50,
    "ema_slow": 200,
    "rsi_period": 14,
    "rsi_long_trigger": 45,
    "rsi_long_ceiling": 70,
    "rsi_short_trigger": 55,
    "rsi_short_floor": 30,
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9,
    "adx_period": 14,
    "adx_threshold": 25,
    "atr_period": 14,
    "atr_stop_multiplier": 1.5,
    "atr_target_multiplier": 2.5,
    "cooldown_trading_days": 5,
    "confirmation_candles": 2,
    "min_backtest_trade_count": 30,
    "min_backtest_win_rate": 0.45,
    "min_backtest_profit_factor": 1.5,
    "high_conviction_confidence_threshold": 70
  }'::jsonb,
  true
)
on conflict (name, version) do nothing;
