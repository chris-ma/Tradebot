-- Seed the 10 tracked forex pairs (majors + key crosses).
insert into pairs (symbol, display_name, pip_position) values
  ('EUR_USD', 'EUR/USD', 4),
  ('GBP_USD', 'GBP/USD', 4),
  ('USD_JPY', 'USD/JPY', 2),
  ('USD_CHF', 'USD/CHF', 4),
  ('AUD_USD', 'AUD/USD', 4),
  ('USD_CAD', 'USD/CAD', 4),
  ('NZD_USD', 'NZD/USD', 4),
  ('EUR_GBP', 'EUR/GBP', 4),
  ('EUR_JPY', 'EUR/JPY', 2),
  ('GBP_JPY', 'GBP/JPY', 2)
on conflict (symbol) do nothing;
