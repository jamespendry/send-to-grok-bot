import { relayKeyFromToken } from "./connect-code.js";
import { encryptSecret, decryptSecret, sha256Hex } from "./crypto.js";
import { ensureSchema, findAccount, insertAccount, updateAccount, addSend, recentSends } from "./db.js";
import { safeLog } from "./log.js";
import { prefilledOpenUrl } from "./open-link.js";
import { buildOpen } from "./open.js";
import { renderPage, setupJavaScript } from "./page.js";
import { LIMITS, takeToken } from "./rate.js";
import { claudeFireUrl, claudeText, parseSendBody, pointsAtRelay, publicError, webhookProblem } from "./validate.js";

const SECURITY = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};

const LABELS = {
  grokbot: "Grok Bot",
  claude: "Claude",
  chatgpt: "ChatGPT",
  codex: "Codex"
};

const SITE_ORIGINS = new Set([
  "https://sendtogrokbot.com",
  "https://www.sendtogrokbot.com"
]);

const CLAUDE_ERRORS = {
  400: "Bad request or routine paused",
  401: "Token invalid for this routine",
  403: "Plan lacks routine API access",
  404: "Routine not found",
  429: "Hourly limit reached",
  503: "Claude overloaded, retry"
};

export function normalizePath(pathname) {
  let path = pathname || "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/api") return "/";
  if (path.startsWith("/api/")) path = path.slice(4) || "/";
  return path || "/";
}

function logPath(request) {
  try {
    const path = normalizePath(new URL(request.url).pathname);
    if (path === "/" || path === "/setup.js" || path === "/v1/open" || path === "/v1/config" || path === "/v1/send" || path === "/v1/history") return path;
  } catch { /* ignore */ }
  return "other";
}

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...SECURITY, "content-type": "application/json; charset=utf-8", ...extra }
  });
}

function tooMany(limited, extra = {}) {
  const configured = !limited.error;
  const headers = { ...extra };
  if (configured && limited.retry) headers["retry-after"] = String(limited.retry);
  return json(
    { ok: false, error: limited.error || "Too many requests. Try again in a little while." },
    configured ? 429 : 500,
    headers
  );
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  if (!SITE_ORIGINS.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    vary: "Origin",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-max-age": "86400"
  };
}

async function readJson(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > 100000) return { error: "That request is too large.", status: 413 };
  const type = (request.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("application/json")) return { error: "Set Content-Type to application/json.", status: 400 };
  const text = await request.text();
  if (text.length > 100000) return { error: "That request is too large.", status: 413 };
  try { return { value: JSON.parse(text) }; }
  catch { return { error: "The body needs to be JSON.", status: 400 }; }
}

async function identify(request) {
  const header = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match) return { error: "That relay key was not recognized.", status: 401 };
  const key = relayKeyFromToken(match[1]);
  if (!key) return { error: "That relay key was not recognized.", status: 401 };
  return { keyHash: await sha256Hex(key) };
}

async function clientId(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  return sha256Hex(String(env.ENCRYPTION_KEY || "") + "\n" + ip);
}

function requireStorage(env) {
  if (!env || !env.DB || !env.KV) {
    const err = new Error("storage");
    err.code = "storage";
    throw err;
  }
}

async function applyGrok(value, next, env, request) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Grok Bot settings need to be an object.";
  const hasUrl = Object.prototype.hasOwnProperty.call(value, "webhookUrl");
  const hasKey = Object.prototype.hasOwnProperty.call(value, "senderKey");
  if (hasUrl) {
    if (typeof value.webhookUrl !== "string") return "The webhook address needs to be text.";
    const url = value.webhookUrl.trim();
    if (!url) {
      next.grokWebhookUrl = "";
      next.grokSenderKey = "";
    } else {
      const problem = webhookProblem(url);
      if (problem) return problem;
      if (pointsAtRelay(url, request.url)) return "The webhook cannot point back at this relay.";
      next.grokWebhookUrl = url;
    }
  }
  if (hasKey) {
    if (typeof value.senderKey !== "string") return "The webhook key needs to be text.";
    if (value.senderKey.length > 4000) return "That webhook key is too long.";
    if (!value.senderKey) next.grokSenderKey = "";
    else {
      if (!next.grokWebhookUrl) return "A webhook key needs a webhook URL.";
      next.grokSenderKey = await encryptSecret(env.ENCRYPTION_KEY, value.senderKey, next.keyHash, "grok_sender_key");
    }
  }
  if (next.grokSenderKey && !next.grokWebhookUrl) return "A webhook key needs a webhook URL.";
  return "";
}

async function applyClaude(value, next, env) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Claude settings need to be an object.";
  const hasUrl = Object.prototype.hasOwnProperty.call(value, "fireUrl");
  const hasToken = Object.prototype.hasOwnProperty.call(value, "token");
  if (hasUrl) {
    if (typeof value.fireUrl !== "string") return "The routine address needs to be text.";
    const raw = value.fireUrl.trim();
    if (!raw) {
      next.claudeFireUrl = "";
      next.claudeToken = "";
    } else {
      const fire = claudeFireUrl(raw);
      if (!fire) return "The Claude routine address should be the routines page link, a trig_ id, or the fire URL.";
      next.claudeFireUrl = fire;
    }
  }
  if (hasToken) {
    if (typeof value.token !== "string") return "The routine token needs to be text.";
    if (value.token.length > 4000) return "That routine token is too long.";
    if (!value.token) next.claudeToken = "";
    else {
      if (!next.claudeFireUrl) return "A Claude token needs a routine URL.";
      next.claudeToken = await encryptSecret(env.ENCRYPTION_KEY, value.token, next.keyHash, "claude_token");
    }
  }
  if (next.claudeToken && !next.claudeFireUrl) return "A Claude token needs a routine URL.";
  return "";
}

function historyView(rows) {
  return rows.map(item => ({
    sentAt: item.sent_at,
    destination: item.destination,
    url: item.post_url,
    author: item.author,
    ok: !!item.ok,
    error: item.error || ""
  }));
}

function view(row, history) {
  const webhookUrl = (row && row.grok_webhook_url) || "";
  const fireUrl = (row && row.claude_fire_url) || "";
  const hasKey = !!(row && row.grok_sender_key);
  const hasToken = !!(row && row.claude_token);
  return {
    ok: true,
    destinations: {
      grokbot: { enabled: !!webhookUrl, webhookUrl, hasKey },
      claude: { enabled: !!(fireUrl && hasToken), fireUrl, hasToken }
    },
    history: historyView(history)
  };
}

async function discard(res) {
  try {
    if (res && res.body && res.body.cancel) await res.body.cancel();
    else if (res) await res.arrayBuffer();
  } catch { /* ignore */ }
}

async function sessionFrom(res) {
  let text = "";
  try { text = await res.text(); }
  catch { return ""; }
  if (!text || text.length > 4000) return "";
  try {
    const data = JSON.parse(text);
    const url = data && data.claude_code_session_url;
    if (typeof url === "string" && /^https:\/\/claude\.ai\//.test(url) && url.length < 500) return url;
  } catch { /* ignore */ }
  return "";
}

function callOut(env, outbound) {
  const doFetch = env.OUTBOUND_FETCH || fetch;
  return doFetch(outbound);
}

async function readSecret(env, stored, keyHash, field) {
  try {
    return await decryptSecret(env.ENCRYPTION_KEY, stored, keyHash, field);
  } catch (err) {
    if (err && err.code === "config") throw err;
    const broken = new Error("secret");
    broken.code = "secret";
    throw broken;
  }
}

async function forwardGrok(env, request, account, keyHash, payload) {
  if (!account.grok_webhook_url) {
    return { ok: false, http: 400, error: "Grok Bot is not set up on the relay. Add the webhook on the setup page." };
  }
  let senderKey = "";
  if (account.grok_sender_key) senderKey = await readSecret(env, account.grok_sender_key, keyHash, "grok_sender_key");
  const headers = { "Content-Type": "application/json", "User-Agent": "SendToGrokBotRelay/1" };
  if (senderKey) {
    headers.Authorization = "Bearer " + senderKey;
    headers["X-Sender-Key"] = senderKey;
  }
  const outbound = new Request(account.grok_webhook_url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    redirect: "manual",
    signal: AbortSignal.timeout(15000)
  });
  const res = await callOut(env, outbound);
  if (res.status >= 300 && res.status < 400) {
    await discard(res);
    return { ok: false, http: 502, error: "The webhook redirected. Paste the final https address." };
  }
  await discard(res);
  if (res.ok) return { ok: true, http: 200, error: "" };
  return { ok: false, http: 502, error: "HTTP " + res.status };
}

async function forwardClaude(env, account, keyHash, payload) {
  if (!account.claude_fire_url || !account.claude_token) {
    return { ok: false, http: 400, error: "Claude is not set up on the relay. Add the routine URL and token on the setup page." };
  }
  const token = await readSecret(env, account.claude_token, keyHash, "claude_token");
  const outbound = new Request(account.claude_fire_url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      "User-Agent": "SendToGrokBotRelay/1"
    },
    body: JSON.stringify({ text: claudeText(payload) }),
    redirect: "manual",
    signal: AbortSignal.timeout(15000)
  });
  const res = await callOut(env, outbound);
  if (res.status >= 300 && res.status < 400) {
    await discard(res);
    return { ok: false, http: 502, error: "The routine URL redirected. Save it again from the setup page." };
  }
  let sessionUrl = "";
  if (res.ok) sessionUrl = await sessionFrom(res);
  else await discard(res);
  if (res.ok) return { ok: true, http: 200, error: "", sessionUrl };
  return { ok: false, http: 502, error: CLAUDE_ERRORS[res.status] || ("HTTP " + res.status) };
}

function storedUrl(url) {
  if (typeof url !== "string" || url.length > 500 || !/^https?:\/\//.test(url)) return "";
  return url;
}

async function record(env, keyHash, parsed, result) {
  await addSend(env.DB, {
    keyHash,
    sentAt: new Date().toISOString(),
    destination: parsed.destination,
    postUrl: storedUrl(parsed.payload.url),
    author: String(parsed.payload.author || "").slice(0, 80),
    ok: !!result.ok,
    error: result.ok ? "" : publicError(result.error)
  });
}

async function getConfig(request, env, who) {
  const limited = await takeToken(env.KV, who.keyHash, "configRead", LIMITS.configRead);
  if (!limited.ok) return tooMany(limited);
  await ensureSchema(env.DB);
  const row = await findAccount(env.DB, who.keyHash);
  if (!row) return json({ ok: false, error: "That relay key was not recognized." }, 401);
  const history = await recentSends(env.DB, who.keyHash);
  safeLog({ method: "GET", path: "/v1/config", status: 200 });
  return json(view(row, history));
}

async function putConfig(request, env, who) {
  const limited = await takeToken(env.KV, who.keyHash, "configWrite", LIMITS.configWrite);
  if (!limited.ok) return tooMany(limited);
  const body = await readJson(request);
  if (body.error) return json({ ok: false, error: body.error }, body.status || 400);
  const input = body.value;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return json({ ok: false, error: "The body needs to be a JSON object." }, 400);
  }
  await ensureSchema(env.DB);
  const existing = await findAccount(env.DB, who.keyHash);
  const next = {
    keyHash: who.keyHash,
    grokWebhookUrl: (existing && existing.grok_webhook_url) || "",
    grokSenderKey: (existing && existing.grok_sender_key) || "",
    claudeFireUrl: (existing && existing.claude_fire_url) || "",
    claudeToken: (existing && existing.claude_token) || ""
  };
  if (input.grokbot != null) {
    const problem = await applyGrok(input.grokbot, next, env, request);
    if (problem) return json({ ok: false, error: problem }, 400);
  }
  if (input.claude != null) {
    const problem = await applyClaude(input.claude, next, env);
    if (problem) return json({ ok: false, error: problem }, 400);
  }
  const now = new Date().toISOString();
  if (!existing) {
    const created = await takeToken(env.KV, await clientId(request, env), "create", LIMITS.create);
    if (!created.ok) return tooMany(created);
    await insertAccount(env.DB, { ...next, createdAt: now, updatedAt: now });
  } else {
    await updateAccount(env.DB, { ...next, updatedAt: now });
  }
  safeLog({ method: "PUT", path: "/v1/config", status: 200 });
  return json({ ok: true });
}

function named(destination, fields) {
  return { destination, label: LABELS[destination] || destination, ...fields };
}

async function send(request, env, who) {
  const limited = await takeToken(env.KV, who.keyHash, "send", LIMITS.send);
  if (!limited.ok) return tooMany(limited);
  const body = await readJson(request);
  if (body.error) return json({ ok: false, error: body.error }, body.status || 400);
  const parsed = parseSendBody(body.value);
  if (parsed.error) return json({ ok: false, error: parsed.error }, 400);
  await ensureSchema(env.DB);
  const openOnly = parsed.destination === "chatgpt" || parsed.destination === "codex";
  let result;
  if (openOnly) {
    const openUrl = prefilledOpenUrl(parsed.destination, parsed.payload.url);
    result = { ok: true, http: 200, error: "", openUrl };
  } else {
    const account = await findAccount(env.DB, who.keyHash);
    if (!account) {
      return json(named(parsed.destination, {
        ok: false,
        error: "Nothing is saved for this code yet.",
        notice: "Nothing is saved for this code yet."
      }), 404);
    }
    try {
      result = parsed.destination === "grokbot"
        ? await forwardGrok(env, request, account, who.keyHash, parsed.payload)
        : await forwardClaude(env, account, who.keyHash, parsed.payload);
    } catch (err) {
      if (err && (err.code === "config" || err.code === "storage")) throw err;
      const error = err && err.code === "secret"
        ? "The saved secret could not be read. Set it again on the setup page."
        : "Could not reach the destination.";
      result = { ok: false, http: 502, error };
    }
  }
  await record(env, who.keyHash, parsed, result);
  safeLog({
    method: "POST",
    path: "/v1/send",
    status: result.ok ? 200 : result.http,
    destination: parsed.destination,
    error: result.ok ? "" : "forward"
  });
  if (result.ok) {
    const notice = openOnly
      ? (parsed.destination === "chatgpt" ? "Opened ChatGPT" : "Opened Codex")
      : (parsed.destination === "grokbot" ? "Sent to Grok Bot" : "Sent to Claude");
    const payload = named(parsed.destination, { ok: true, notice });
    if (result.sessionUrl) payload.sessionUrl = result.sessionUrl;
    if (result.openUrl) payload.openUrl = result.openUrl;
    return json(payload);
  }
  const error = publicError(result.error);
  return json(named(parsed.destination, { ok: false, error, notice: error }), result.http || 502);
}

// No code and nothing stored: the shortcut's open-with-the-post-filled-in path.
async function openPost(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "That method is not allowed." }, 405, { allow: "POST" });
  if (!env || !env.KV) requireStorage(env);
  const limited = await takeToken(env.KV, await clientId(request, env), "open", LIMITS.open);
  if (!limited.ok) return tooMany(limited);
  const body = await readJson(request);
  if (body.error) return json({ ok: false, error: body.error, notice: body.error }, body.status || 400);
  const value = body.value || {};
  const result = await buildOpen(String(value.destination || ""), value.url, (u, init) => {
    // Workers reject the credentials option, and fxtwitter asks callers to name themselves.
    const { credentials, ...rest } = init || {};
    const headers = { ...(rest.headers || {}), "User-Agent": "SendToGrokBot/1.0 (+https://sendtogrokbot.com)" };
    return callOut(env, new Request(u, { ...rest, headers }));
  });
  safeLog({ method: "POST", path: "/v1/open", status: result.ok ? 200 : 400, destination: result.ok ? result.destination : "", error: result.ok ? "" : "input" });
  if (!result.ok) return json({ ok: false, error: result.error, notice: result.error }, 400);
  return json(result);
}

async function getHistory(request, env, who, extra) {
  const limited = await takeToken(env.KV, who.keyHash, "configRead", LIMITS.configRead);
  if (!limited.ok) return tooMany(limited, extra);
  await ensureSchema(env.DB);
  const history = await recentSends(env.DB, who.keyHash);
  safeLog({ method: "GET", path: "/v1/history", status: 200 });
  return json({ ok: true, history: historyView(history) }, 200, extra);
}

export async function handle(request, env) {
  const url = new URL(request.url);
  const path = normalizePath(url.pathname);
  if (request.method === "OPTIONS") {
    const extra = path === "/v1/history" ? corsHeaders(request) : {};
    return new Response(null, { status: 204, headers: { ...SECURITY, ...extra } });
  }
  if (path === "/" && request.method === "GET") {
    return new Response(renderPage(url.pathname), {
      status: 200,
      headers: { ...SECURITY, "content-type": "text/html; charset=utf-8" }
    });
  }
  if (path === "/setup.js" && request.method === "GET") {
    return new Response(setupJavaScript(), {
      status: 200,
      headers: { ...SECURITY, "content-type": "text/javascript; charset=utf-8" }
    });
  }
  if (path === "/v1/open") return openPost(request, env);
  if (path !== "/v1/config" && path !== "/v1/send" && path !== "/v1/history") return json({ ok: false, error: "Nothing is here." }, 404);
  requireStorage(env);
  const cors = path === "/v1/history" ? corsHeaders(request) : {};
  const ip = await takeToken(env.KV, await clientId(request, env), "ip", 300);
  if (!ip.ok) return tooMany(ip, cors);
  const who = await identify(request);
  if (who.error) return json({ ok: false, error: who.error }, who.status, cors);
  if (path === "/v1/history" && request.method === "GET") return getHistory(request, env, who, cors);
  if (path === "/v1/config" && request.method === "GET") return getConfig(request, env, who);
  if (path === "/v1/config" && request.method === "PUT") return putConfig(request, env, who);
  if (path === "/v1/send" && request.method === "POST") return send(request, env, who);
  const allow = path === "/v1/send" ? "POST" : path === "/v1/history" ? "GET" : "GET, PUT";
  return json({ ok: false, error: "That method is not allowed." }, 405, { ...cors, allow });
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      const missingSecret = err && err.code === "config";
      const missingStorage = err && err.code === "storage";
      const error = missingSecret
        ? "The relay encryption secret is not set."
        : missingStorage
          ? "The relay storage is not configured."
          : "Something went wrong on the relay.";
      try { safeLog({ method: request.method, path: logPath(request), status: 500, error: missingSecret ? "config" : missingStorage ? "storage" : "internal" }); }
      catch { /* ignore */ }
      let extra = {};
      try {
        if (normalizePath(new URL(request.url).pathname) === "/v1/history") extra = corsHeaders(request);
      } catch { /* ignore */ }
      return json({ ok: false, error }, 500, extra);
    }
  }
};
