-- AI engine settings for Auto CV plus the request log the Config screen shows.
-- The key sits in one row (id = 1) so "the" configuration is a single value,
-- never a list an admin has to reconcile.

CREATE TABLE IF NOT EXISTS ai_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('check', 'generate')),
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  user_id TEXT,
  created_at TEXT NOT NULL
);
