function relayCodec() {
  var PREFIX = "stgbr1.";

  function bytesToB64Url(bytes) {
    var bin = "";
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function b64UrlToString(text) {
    if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
    var pad = text.length % 4 === 0 ? "" : "====".slice(0, 4 - (text.length % 4));
    var bin;
    try { bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad); }
    catch (e) { return null; }
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch (e) { return null; }
  }

  function newRelayKey() {
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return "rk_" + bytesToB64Url(bytes);
  }

  function encodeConnectCode(relay, key) {
    var base = String(relay || "").trim().replace(/\/$/, "");
    var payload = JSON.stringify({ v: 1, relay: base, key: String(key || "") });
    return PREFIX + bytesToB64Url(new TextEncoder().encode(payload));
  }

  function decodeConnectCode(raw) {
    var s = String(raw == null ? "" : raw).replace(/[\u200b-\u200d\ufeff]/g, "").trim();
    if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') || (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
      s = s.slice(1, -1).trim();
    }
    s = s.replace(/\s+/g, "");
    var at = s.toLowerCase().indexOf(PREFIX);
    if (at === -1) return { ok: false, error: "That doesn't look like a relay code. It should start with stgbr1." };
    s = s.slice(at);
    if (s.length <= PREFIX.length || s.length > 8000) return { ok: false, error: "That code is damaged. Copy it again from the setup page." };
    var json = b64UrlToString(s.slice(PREFIX.length));
    if (json == null) return { ok: false, error: "That code is damaged. Copy it again from the setup page." };
    var obj;
    try { obj = JSON.parse(json); }
    catch (e) { return { ok: false, error: "That code is damaged. Copy it again from the setup page." }; }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false, error: "That code is damaged. Copy it again from the setup page." };
    if (obj.v !== 1) return { ok: false, error: "That code is from a different version of the relay." };
    var relay = typeof obj.relay === "string" ? obj.relay.trim() : "";
    var key = typeof obj.key === "string" ? obj.key.trim() : "";
    var url;
    try { url = new URL(relay); }
    catch (e) { return { ok: false, error: "That code has no relay address." }; }
    var local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
      return { ok: false, error: "The relay address needs to start with https://." };
    }
    if (url.username || url.password) return { ok: false, error: "That code has no relay address." };
    if (!/^rk_[A-Za-z0-9_-]{20,200}$/.test(key)) return { ok: false, error: "That code is missing its relay key." };
    var path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return { ok: true, relay: url.origin + path, key: key };
  }

  return {
    PREFIX: PREFIX,
    encodeConnectCode: encodeConnectCode,
    decodeConnectCode: decodeConnectCode,
    newRelayKey: newRelayKey
  };
}
