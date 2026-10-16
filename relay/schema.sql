-- Accounts, encrypted secrets, and the last 50 sends.
-- The worker also creates these tables on its own if they are missing.
-- Apply once with: npx wrangler d1 execute stgb-relay --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS accounts (
  key_hash TEXT PRIMARY KEY,
  grok_webhook_url TEXT NOT NULL DEFAULT '',
  grok_sender_key TEXT NOT NULL DEFAULT '',
  claude_fire_url TEXT NOT NULL DEFAULT '',
  claude_token TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  destination TEXT NOT NULL,
  post_url TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  ok INTEGER NOT NULL,
  error TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS sends_by_account ON sends (key_hash, id DESC);
