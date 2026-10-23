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
  // The counter is a guard, not the product. If KV fails, for example when the free
  // plan's daily write allowance runs out, let the request through instead of failing it.
  let current = 0;
  try { current = Number(await kv.get(key)) || 0; }
  catch (_) { return { ok: true, remaining: null }; }
  if (current >= limit) {
    const retry = Math.max(1, windowStart + HOUR - Math.floor(now / 1000));
    return { ok: false, retry };
  }
  try { await kv.put(key, String(current + 1), { expirationTtl: HOUR + 120 }); }
  catch (_) { /* counted as allowed; see above */ }
  return { ok: true, remaining: limit - current - 1 };
}
