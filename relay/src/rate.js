// Fixed one-hour windows in KV. Two requests at the same moment can both pass;
// that is close enough for a personal relay, and a full hour still cannot run away.
export const LIMITS = {
  send: 60,
  configWrite: 30,
  configRead: 240,
  create: 20,
  open: 120
};

const HOUR = 60 * 60;

export async function takeToken(kv, id, bucket, limit, now = Date.now()) {
  if (!kv) return { ok: false, retry: 60, error: "Rate limit storage is not configured." };
  const windowStart = Math.floor(now / 1000 / HOUR) * HOUR;
  const key = `rl:${bucket}:${id}:${windowStart}`;
  const current = Number(await kv.get(key)) || 0;
  if (current >= limit) {
    const retry = Math.max(1, windowStart + HOUR - Math.floor(now / 1000));
    return { ok: false, retry };
  }
  await kv.put(key, String(current + 1), { expirationTtl: HOUR + 120 });
  return { ok: true, remaining: limit - current - 1 };
}
