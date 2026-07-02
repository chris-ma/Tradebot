-- Tradebot core schema: forex swing-trading advisory app.
-- Requires pgcrypto (Supabase enables it by default) for gen_random_uuid().

create table if not exists pairs (
  id uuid primary key default gen_random_uuid(),
  symbol text unique not null,          -- OANDA format, e.g. 'EUR_USD'
  display_name text not null,           -- e.g. 'EUR/USD'
  pip_position int not null,            -- 4 for most pairs, 2 for JPY crosses
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists candles (
  id bigserial primary key,
  pair_id uuid not null references pairs(id) on delete cascade,
  granularity text not null check (granularity in ('D', 'H4')),
  ts timestamptz not null,              -- candle open time (UTC, as returned by OANDA)
  open numeric(12, 6) not null,
  high numeric(12, 6) not null,
  low numeric(12, 6) not null,
  close numeric(12, 6) not null,
  volume integer not null,
  complete boolean not null,            -- only complete=true candles feed indicators/signals
  created_at timestamptz not null default now(),
  unique (pair_id, granularity, ts)
);
create index if not exists candles_pair_gran_ts_idx on candles (pair_id, granularity, ts desc);

create table if not exists strategies (
  id uuid primary key default gen_random_uuid(),
  name text not null,                   -- 'ema_trend_rsi_macd_adx_atr'
  version int not null,
  params jsonb not null,                -- {ema_fast: 50, ema_slow: 200, rsi_period: 14, ...}
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  strategy_id uuid not null references strategies(id) on delete restrict,
  direction text not null check (direction in ('long', 'short')),
  signal_ts timestamptz not null,       -- H4 candle close that triggered the signal
  entry_price numeric(12, 6) not null,
  stop_loss numeric(12, 6) not null,
  take_profit numeric(12, 6) not null,
  risk_reward numeric(6, 3) not null,
  indicator_snapshot jsonb not null,    -- ema50, ema200, rsi, macd, macd_signal, adx, atr at trigger
  confidence_score numeric(5, 2) not null check (confidence_score >= 0 and confidence_score <= 100),
  status text not null default 'active'
    check (status in ('active', 'target_hit', 'stopped_out', 'expired', 'suppressed_low_track_record')),
  closed_at timestamptz,
  closed_price numeric(12, 6),
  outcome text check (outcome in ('win', 'loss', 'breakeven')),
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists signals_pair_status_ts_idx on signals (pair_id, status, signal_ts desc);

create table if not exists backtest_runs (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references strategies(id) on delete cascade,
  pair_id uuid not null references pairs(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  trade_count int not null,
  wins int not null,
  losses int not null,
  win_rate numeric(5, 4) not null,
  profit_factor numeric(8, 3),
  avg_risk_reward numeric(6, 3),
  expectancy_r numeric(8, 4),
  max_drawdown_pct numeric(6, 3),
  status text not null default 'completed' check (status in ('running', 'completed', 'failed')),
  run_at timestamptz not null default now()
);
create index if not exists backtest_runs_pair_strategy_idx on backtest_runs (pair_id, strategy_id, run_at desc);

create table if not exists backtest_trades (
  id uuid primary key default gen_random_uuid(),
  backtest_run_id uuid not null references backtest_runs(id) on delete cascade,
  direction text not null check (direction in ('long', 'short')),
  entry_ts timestamptz not null,
  exit_ts timestamptz not null,
  entry_price numeric(12, 6) not null,
  exit_price numeric(12, 6) not null,
  stop_loss numeric(12, 6) not null,
  take_profit numeric(12, 6) not null,
  pnl_r numeric(8, 4) not null,         -- P&L expressed in multiples of initial risk
  outcome text not null check (outcome in ('win', 'loss')),
  exit_reason text not null check (exit_reason in ('stop', 'target', 'timeout'))
);
create index if not exists backtest_trades_run_entry_idx on backtest_trades (backtest_run_id, entry_ts);

create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  pairs_processed int,
  candles_inserted int,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  error text
);
