import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { buildClientScript } from "../../src/build-client.js";
import { CODEC_SOURCE, PAGE_SOURCE } from "../../src/browser-sources.js";
import { ConfigError, decryptSecret, encryptSecret } from "../../src/crypto.js";
import { STATEMENTS } from "../../src/db.js";
import { safeLog } from "../../src/log.js";
import { LIMITS, takeToken } from "../../src/rate.js";
import { claudeFireUrl, claudeText, parseSendBody, webhookProblem } from "../../src/validate.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);

if (!globalThis.crypto) globalThis.crypto = webcrypto;

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("browser sources match the checked function files", () => {
  assert.equal(CODEC_SOURCE, read("src/relay-codec.fn.js"));
  assert.equal(PAGE_SOURCE, read("src/setup-page.fn.js"));
  assert.ok(read("../extension/relay.js").includes(read("src/relay-codec.fn.js").trim()));
});

test("schema.sql contains the worker statements", () => {
  const file = read("schema.sql");
  for (const sql of STATEMENTS) assert.ok(file.includes(sql.trim()));
});

test("only the log helper writes to the console", () => {
  const files = ["src/index.js", "src/crypto.js", "src/validate.js", "src/db.js", "src/rate.js", "src/page.js", "src/client.js", "src/setup-page.fn.js", "src/relay-codec.fn.js"];
  for (const file of files) {
    assert.equal(/\bconsole\./.test(read(file)), false, file);
  }
  assert.match(read("src/log.js"), /console\.log/);
});

test("safeLog drops anything that is not on the list", () => {
  const lines = [];
  const original = console.log;
  console.log = (...args) => { lines.push(args.join(" ")); };
  try {
    safeLog({ method: "POST", path: "/v1/send", status: 200, destination: "grokbot", token: "sk-ant-oat01-secret", authorization: "Bearer rk_secret", text: "post" });
  } finally {
    console.log = original;
  }
  const line = lines.join("\n");
  assert.match(line, /"destination":"grokbot"/);
  assert.equal(line.includes("sk-ant"), false);
  assert.equal(line.includes("rk_secret"), false);
  assert.equal(line.includes("post"), false);
});

test("secrets round-trip and cannot be swapped", async () => {
  const secret = Buffer.alloc(32, 7).toString("base64");
  const cipher = await encryptSecret(secret, "whsec_test_key", "hash-a", "grok_sender_key");
  assert.equal(cipher.includes("whsec_test_key"), false);
  assert.equal(await decryptSecret(secret, cipher, "hash-a", "grok_sender_key"), "whsec_test_key");
  const again = await encryptSecret(secret, "whsec_test_key", "hash-a", "grok_sender_key");
  assert.notEqual(cipher, again);
  await assert.rejects(() => decryptSecret(secret, cipher, "hash-b", "grok_sender_key"));
  await assert.rejects(() => decryptSecret(secret, cipher, "hash-a", "claude_token"));
  const flipped = cipher.slice(0, -2) + (cipher.endsWith("a") ? "b" : "a");
  await assert.rejects(() => decryptSecret(secret, flipped, "hash-a", "grok_sender_key"));
  await assert.rejects(() => encryptSecret("too-short", "x", "h", "f"), ConfigError);
});

test("webhook and Claude addresses are checked", () => {
  assert.equal(webhookProblem("https://hooks.example/hook"), "");
  assert.match(webhookProblem("http://hooks.example/hook"), /https/);
  assert.match(webhookProblem("https://127.0.0.1/hook"), /IP/);
  assert.match(webhookProblem("https://10.1.2.3/hook"), /IP/);
  assert.match(webhookProblem("https://[::1]/hook"), /IP/);
  assert.match(webhookProblem("https://metadata.google.internal/"), /public/);
  assert.match(webhookProblem("https://printer.local/hook"), /public/);
  assert.match(webhookProblem("https://user:pass@hooks.example/hook"), /key field/);
  assert.equal(claudeFireUrl("trig_abc"), "https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire");
  assert.equal(claudeFireUrl("https://claude.ai/code/routines/trig_abc"), "https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire");
  assert.equal(claudeFireUrl("https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire"), "https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire");
  assert.equal(claudeFireUrl("https://example.com/trig_abc"), "");
});

test("Claude text matches the extension block and stays within the limit", () => {
  const text = claudeText({ url: "https://x.com/a/status/1", author: "ada", sentAt: "t", text: "hello" });
  assert.equal(text, 'X post to research\nURL: https://x.com/a/status/1\nAuthor: @ada\nSent at: t\n\n"""\nhello\n"""');
  const long = claudeText({ url: "https://x.com/a/status/1", author: "ada", sentAt: "t", text: "x".repeat(70000) });
  assert.equal(long.length, 65536);
  const parsed = parseSendBody({ destination: "nope" });
  assert.match(parsed.error, /grokbot or claude/);
  const rich = parseSendBody({
    destination: "grokbot",
    url: "https://x.com/a/status/1",
    text: "hello",
    author: "ada",
    version: 2,
    digest: "full digest",
    media: [{ type: "video", thumbnail: "https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/abc.jpg?name=large", captions: "Visible caption" }]
  });
  assert.equal(rich.payload.version, 2);
  assert.equal(rich.payload.digest, "full digest");
  assert.equal(rich.payload.media[0].thumbnail, "https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/abc.jpg?name=large");
  const viaDigest = claudeText({ url: "https://x.com/a/status/1", author: "ada", sentAt: "t", text: "hello", digest: "full digest" });
  assert.match(viaDigest, /full digest/);
});

test("rate limit counts inside one window", async () => {
  const store = new Map();
  const kv = {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); }
  };
  const now = Date.parse("2026-10-16T00:00:00.000Z");
  assert.equal((await takeToken(kv, "user", "send", 2, now)).ok, true);
  assert.equal((await takeToken(kv, "user", "send", 2, now + 1000)).ok, true);
  const blocked = await takeToken(kv, "user", "send", 2, now + 2000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retry > 0);
  assert.equal(LIMITS.send, 60);
});

function refEncode(relay, key) {
  const payload = JSON.stringify({ v: 1, relay, key });
  return "stgbr1." + Buffer.from(payload).toString("base64url");
}

test("the extension and the setup page agree on the connect code", () => {
  const ext = require("../../../extension/relay.js");
  const relay = "https://relay.sendtogrokbot.com";
  const key = "rk_" + "abcXYZ_-".repeat(5);
  assert.equal(ext.encodeConnectCode(relay, key), refEncode(relay, key));
  const decoded = ext.decodeConnectCode("  " + ext.encodeConnectCode(relay + "/", key) + "\n");
  assert.equal(decoded.ok, true);
  assert.equal(decoded.relay, relay);
  assert.equal(decoded.key, key);
  assert.equal(ext.decodeConnectCode("hello").ok, false);
  const script = buildClientScript(CODEC_SOURCE, PAGE_SOURCE);
  const sandbox = { crypto: webcrypto, btoa, atob, TextEncoder, TextDecoder, URL, Uint8Array };
  vm.createContext(sandbox);
  vm.runInContext(script.slice(0, script.indexOf("function setupPage")), sandbox);
  const page = sandbox.relayCodec();
  assert.equal(page.encodeConnectCode(relay, key), ext.encodeConnectCode(relay, key));
  assert.equal(page.decodeConnectCode(ext.encodeConnectCode("http://127.0.0.1:8787", key)).relay, "http://127.0.0.1:8787");
});

function fakeDocument() {
  const elements = new Map();
  function make(tag) {
    return {
      tag,
      value: "",
      textContent: "",
      className: "",
      hidden: false,
      checked: false,
      children: [],
      listeners: {},
      appendChild(child) { this.children.push(child); return child; },
      replaceChildren(...kids) { this.children = kids.filter(Boolean); },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      focus() {},
      select() {}
    };
  }
  for (const id of ["code", "key", "copy", "copyMsg", "status", "form", "webhook", "webhookKey", "webhookHint", "clearKey", "clearKeyLabel", "fire", "token", "tokenHint", "clearToken", "clearTokenLabel", "save", "saveMsg", "existing", "load", "loadMsg", "newCode", "history"]) {
    elements.set(id, make(id));
  }
  return {
    getElementById(id) { return elements.get(id) || null; },
    createElement: make,
    elements
  };
}

test("the setup page creates a code and saves without putting the key in the body", async () => {
  const calls = [];
  const document = fakeDocument();
  const stored = new Map();
  const context = {
    document,
    localStorage: {
      getItem(k) { return stored.has(k) ? stored.get(k) : null; },
      setItem(k, v) { stored.set(k, String(v)); }
    },
    location: { origin: "https://relay.sendtogrokbot.com", pathname: "/", hash: "", search: "" },
    history: { replaceState() {} },
    navigator: { clipboard: { writeText() { return Promise.resolve(); } } },
    crypto: webcrypto,
    btoa,
    atob,
    TextEncoder,
    TextDecoder,
    URL,
    Uint8Array,
    console,
    fetch(url, init = {}) {
      const method = String(init.method || "GET").toUpperCase();
      calls.push({ url: String(url), method, headers: init.headers || {}, body: init.body });
      const saved = calls.some(call => call.method === "PUT");
      if (method === "PUT") {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
      }
      if (saved) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            ok: true,
            destinations: {
              grokbot: { enabled: true, webhookUrl: "https://hooks.example/hook", hasKey: true },
              claude: { enabled: false, fireUrl: "", hasToken: false }
            },
            history: [{ sentAt: "2026-10-16T00:00:00.000Z", destination: "grokbot", url: "https://x.com/a/status/1", author: "ada", ok: true, error: "" }]
          })
        });
      }
      return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ ok: false, error: "That relay key was not recognized." }) });
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(buildClientScript(CODEC_SOURCE, PAGE_SOURCE), context);
  await context.__stgbReady;
  const code = document.getElementById("code").value;
  const key = document.getElementById("key").value;
  assert.match(code, /^stgbr1\./);
  assert.match(key, /^rk_/);
  assert.match(document.getElementById("status").textContent, /Nothing is saved/);
  assert.equal(document.getElementById("history").children[0].textContent, "No sends yet.");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].headers.Authorization, "Bearer " + key);
  assert.equal(calls[0].url, "https://relay.sendtogrokbot.com/v1/config");
  document.getElementById("webhook").value = "https://hooks.example/hook";
  document.getElementById("webhookKey").value = "whsec_test_key";
  document.getElementById("form").listeners.submit({ preventDefault() {} });
  await context.__stgbLast;
  const put = calls.find(call => call.method === "PUT");
  const body = JSON.parse(put.body);
  assert.equal(body.grokbot.webhookUrl, "https://hooks.example/hook");
  assert.equal(body.grokbot.senderKey, "whsec_test_key");
  assert.equal(JSON.stringify(body).includes(key), false);
  assert.equal(document.getElementById("saveMsg").textContent, "Saved.");
  assert.equal(document.getElementById("webhookKey").value, "");
  assert.match(document.getElementById("webhookHint").textContent, /already saved|key is saved/);
  assert.match(document.getElementById("history").children[0].textContent, /Grok Bot/);
  assert.match(document.getElementById("history").children[0].textContent, /ada/);
  document.getElementById("copy").listeners.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(document.getElementById("copyMsg").textContent, "Copied.");
});

test("the extension posts the payload and the relay key only in the header", async () => {
  const ext = require("../../../extension/relay.js");
  const key = "rk_" + "abcXYZ_-".repeat(5);
  const code = ext.encodeConnectCode("https://relay.sendtogrokbot.com", key);
  let captured;
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await ext.send({ source: "x", url: "https://x.com/a/status/1", text: "hello", author: "ada", sentAt: "t" }, { relayCode: code }, "claude");
    assert.equal(result.ok, true);
  } finally {
    globalThis.fetch = previous;
  }
  assert.equal(captured.url, "https://relay.sendtogrokbot.com/v1/send");
  assert.equal(captured.init.headers.Authorization, "Bearer " + key);
  const body = JSON.parse(captured.init.body);
  assert.equal(body.destination, "claude");
  assert.equal(body.text, "hello");
  assert.equal(body.relayCode, undefined);
  assert.equal(JSON.stringify(body).includes(key), false);
});
