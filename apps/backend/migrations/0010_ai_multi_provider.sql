-- Multi-provider AI config: one row per provider (openai, anthropic, gemini).
-- Replaces the single-row ai_config table.

CREATE TABLE IF NOT EXISTS ai_configs (
  provider TEXT PRIMARY KEY CHECK (provider IN ('openai', 'anthropic', 'gemini')),
  model TEXT NOT NULL,
  api_key TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Migrate existing single row if present
INSERT INTO ai_configs (provider, model, api_key, updated_at)
SELECT provider, model, api_key, updated_at
FROM ai_config
WHERE id = 1
ON CONFLICT(provider) DO UPDATE SET
  model = excluded.model,
  api_key = excluded.api_key,
  updated_at = excluded.updated_at;

-- Drop old table
DROP TABLE IF EXISTS ai_config;
