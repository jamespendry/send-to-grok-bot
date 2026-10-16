// Turns an Authorization token into the rk_ key the database uses.
// A phone shortcut stores one stgbr1 code and sends that whole code.
// The relay address inside the code is not required to match this host.

const PREFIX = "stgbr1.";

function b64UrlToString(text) {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const pad = text.length % 4 === 0 ? "" : "====".slice(0, 4 - (text.length % 4));
  let bin;
  try { bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad); }
  catch { return null; }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return null; }
}

function decodeConnectCode(raw) {
  let s = String(raw == null ? "" : raw).replace(/[\u200b-\u200d\ufeff]/g, "").trim();
  if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') || (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/\s+/g, "");
  const at = s.toLowerCase().indexOf(PREFIX);
  if (at === -1) return null;
  s = s.slice(at);
  if (s.length <= PREFIX.length || s.length > 8000) return null;
  const json = b64UrlToString(s.slice(PREFIX.length));
  if (json == null) return null;
  let obj;
  try { obj = JSON.parse(json); }
  catch { return null; }
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || obj.v !== 1) return null;
  const relay = typeof obj.relay === "string" ? obj.relay.trim() : "";
  const key = typeof obj.key === "string" ? obj.key.trim() : "";
  let url;
  try { url = new URL(relay); }
  catch { return null; }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.username || url.password) return null;
  if (!/^rk_[A-Za-z0-9_-]{20,200}$/.test(key)) return null;
  return key;
}

export function relayKeyFromToken(token) {
  if (typeof token !== "string" || token.length > 8000) return "";
  if (/^rk_[A-Za-z0-9_-]{20,200}$/.test(token)) return token;
  return decodeConnectCode(token) || "";
}
