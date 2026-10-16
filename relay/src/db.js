export const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS accounts (
  key_hash TEXT PRIMARY KEY,
  grok_webhook_url TEXT NOT NULL DEFAULT '',
  grok_sender_key TEXT NOT NULL DEFAULT '',
  claude_fire_url TEXT NOT NULL DEFAULT '',
  claude_token TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  destination TEXT NOT NULL,
  post_url TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  ok INTEGER NOT NULL,
  error TEXT NOT NULL DEFAULT ''
)`,
  `CREATE INDEX IF NOT EXISTS sends_by_account ON sends (key_hash, id DESC)`
];

export async function ensureSchema(db) {
  await db.batch(STATEMENTS.map(sql => db.prepare(sql)));
}

export async function findAccount(db, keyHash) {
  return db.prepare(
    "SELECT key_hash, grok_webhook_url, grok_sender_key, claude_fire_url, claude_token, created_at, updated_at FROM accounts WHERE key_hash = ?"
  ).bind(keyHash).first();
}

export async function insertAccount(db, row) {
  await db.prepare(
    `INSERT INTO accounts (key_hash, grok_webhook_url, grok_sender_key, claude_fire_url, claude_token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(row.keyHash, row.grokWebhookUrl, row.grokSenderKey, row.claudeFireUrl, row.claudeToken, row.createdAt, row.updatedAt).run();
}

export async function updateAccount(db, row) {
  await db.prepare(
    `UPDATE accounts
     SET grok_webhook_url = ?, grok_sender_key = ?, claude_fire_url = ?, claude_token = ?, updated_at = ?
     WHERE key_hash = ?`
  ).bind(row.grokWebhookUrl, row.grokSenderKey, row.claudeFireUrl, row.claudeToken, row.updatedAt, row.keyHash).run();
}

export async function addSend(db, row) {
  await db.batch([
    db.prepare(
      "INSERT INTO sends (key_hash, sent_at, destination, post_url, author, ok, error) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(row.keyHash, row.sentAt, row.destination, row.postUrl, row.author, row.ok ? 1 : 0, row.error),
    db.prepare(
      "DELETE FROM sends WHERE key_hash = ? AND id NOT IN (SELECT id FROM sends WHERE key_hash = ? ORDER BY id DESC LIMIT 50)"
    ).bind(row.keyHash, row.keyHash)
  ]);
}

export async function recentSends(db, keyHash) {
  const result = await db.prepare(
    "SELECT sent_at, destination, post_url, author, ok, error FROM sends WHERE key_hash = ? ORDER BY id DESC LIMIT 50"
  ).bind(keyHash).all();
  return (result && result.results) || [];
}
