const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain"];
const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog"
]);

export function claudeFireUrl(v) {
  v = (v || "").trim();
  const fire = id => `https://api.anthropic.com/v1/claude_code/routines/${id}/fire`;
  if (/^trig_[A-Za-z0-9_-]+$/.test(v)) return fire(v);
  let url;
  try { url = new URL(/^[a-z]+:/i.test(v) ? v : "https://" + v.replace(/^\/\//, "")); }
  catch { return ""; }
  const id = (url.pathname.match(/\/(trig_[A-Za-z0-9_-]+)/) || [])[1];
  if (!id) return "";
  const host = url.hostname.replace(/^www\./, "");
  if (host === "api.anthropic.com" && /^\/v1\/claude_code\/routines\/trig_[A-Za-z0-9_-]+\/fire\/?$/.test(url.pathname)) return fire(id);
  if (host === "claude.ai" && /^\/code\/routines\/trig_[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return fire(id);
  return "";
}

function isIpLiteral(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (host.includes(":")) return true;
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
}

export function webhookProblem(value) {
  const raw = String(value || "").trim();
  if (!raw) return "The webhook address is empty.";
  if (raw.length > 2000) return "That webhook address is too long.";
  if (/\s/.test(raw)) return "The webhook address needs to be a full URL starting with https://.";
  let url;
  try { url = new URL(raw); }
  catch { return "The webhook address needs to be a full URL starting with https://."; }
  if (url.protocol !== "https:") return "The webhook address needs to start with https://.";
  if (url.username || url.password) return "Put the key in the key field. Leave it out of the webhook address.";
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some(suffix => host.endsWith(suffix))) {
    return "The webhook address has to be a public https address.";
  }
  if (isIpLiteral(host)) return "Use the webhook's https hostname, not a raw IP address.";
  return "";
}

export function pointsAtRelay(webhook, requestUrl) {
  let target;
  let here;
  try {
    target = new URL(webhook);
    here = new URL(requestUrl);
  } catch { return false; }
  if (target.host !== here.host) return false;
  return /\/v1\/send\/?$/.test(target.pathname);
}

export function claudeText(post) {
  const digest = typeof post.digest === "string" ? post.digest : "";
  const text = digest || (typeof post.text === "string" ? post.text : "");
  const author = post.author || "unknown";
  let body = `X post to research\nURL: ${post.url}\nAuthor: @${author}\nSent at: ${post.sentAt}\n\n"""\n${text}\n"""`;
  const prompt = typeof post.prompt === "string" ? post.prompt.trim() : "";
  if (prompt) body = `Prompt:\n${prompt}\n\n${body}`;
  if (body.length > 65536) body = body.slice(0, 65536);
  return body;
}

const PASSTHROUGH = new Set(["source", "url", "text", "author", "sentAt"]);
const MAX_FIELD = 20000;
const MAX_PAYLOAD = 120000;

function plainCopy(value, depth) {
  if (depth > 6) return undefined;
  if (typeof value === "string") return value.length > MAX_FIELD ? value.slice(0, MAX_FIELD) + "…" : value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value.slice(0, 30)) {
      const copied = plainCopy(item, depth + 1);
      if (copied !== undefined) out.push(copied);
    }
    return out;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key)) continue;
      const copied = plainCopy(item, depth + 1);
      if (copied !== undefined) out[key] = copied;
    }
    return out;
  }
  return undefined;
}

export function parseSendBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "The body needs to be a JSON object." };
  const destination = body.destination === "grokbot" || body.destination === "claude" || body.destination === "chatgpt" || body.destination === "codex"
    ? body.destination
    : "";
  if (!destination) return { error: "Choose a destination: grokbot, claude, chatgpt, or codex." };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!/^https?:\/\/\S{1,2000}$/.test(url)) return { error: "The post needs an http or https URL." };
  const text = typeof body.text === "string" ? body.text : "";
  if (text.length > 60000) return { error: "That post is too long." };
  const author = typeof body.author === "string" ? body.author.replace(/[\r\n\t]/g, " ").trim().slice(0, 80) : "";
  const source = typeof body.source === "string" && body.source.length > 0 && body.source.length <= 40 ? body.source : "x";
  let sentAt = typeof body.sentAt === "string" ? body.sentAt.slice(0, 40) : "";
  if (!sentAt) sentAt = new Date().toISOString();
  const payload = { source, url, text, author, sentAt };
  for (const [key, value] of Object.entries(body)) {
    if (key === "destination" || PASSTHROUGH.has(key)) continue;
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key)) continue;
    const copied = plainCopy(value, 0);
    if (copied !== undefined) payload[key] = copied;
  }
  if (JSON.stringify(payload).length > MAX_PAYLOAD) return { error: "That post is too long." };
  return { destination, payload };
}

export function publicError(message) {
  const text = String(message || "Request failed").replace(/[\r\n]/g, " ").slice(0, 180);
  if (/sk-ant|rk_|bearer |v1\./i.test(text)) return "Request failed.";
  return text;
}
