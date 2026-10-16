const cache = new Map();

export class ConfigError extends Error {
  constructor() {
    super("encryption is not configured");
    this.code = "config";
  }
}

function bytesFromSecret(secret) {
  const text = String(secret || "").trim().replace(/\s+/g, "");
  if (!text || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) return null;
  const normalized = text.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  let bin;
  try { bin = atob(normalized + pad); }
  catch { return null; }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
  return out.length === 32 ? out : null;
}

export function bytesToB64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64UrlToBytes(text) {
  if (!text || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  let bin;
  try { bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad); }
  catch { return null; }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
  return out;
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function getKey(secret) {
  const material = String(secret || "");
  if (cache.has(material)) return cache.get(material);
  const raw = bytesFromSecret(material);
  if (!raw) throw new ConfigError();
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  cache.set(material, key);
  return key;
}

function aadBytes(keyHash, field) {
  return new TextEncoder().encode("stgb1:" + keyHash + ":" + field);
}

export async function encryptSecret(secret, plaintext, keyHash, field) {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aadBytes(keyHash, field) },
    key,
    new TextEncoder().encode(plaintext)
  ));
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return "v1." + bytesToB64Url(packed);
}

export async function decryptSecret(secret, stored, keyHash, field) {
  if (!stored) return "";
  if (typeof stored !== "string" || !stored.startsWith("v1.")) throw new Error("bad ciphertext");
  const packed = b64UrlToBytes(stored.slice(3));
  if (!packed || packed.length < 13) throw new Error("bad ciphertext");
  const key = await getKey(secret);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: packed.slice(0, 12), additionalData: aadBytes(keyHash, field) },
    key,
    packed.slice(12)
  );
  return new TextDecoder().decode(plain);
}
