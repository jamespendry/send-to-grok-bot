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
import { relayKeyFromToken } from "../../src/connect-code.js";
import { prefilledOpenUrl } from "../../src/open-link.js";
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
  assert.match(PAGE_SOURCE, /chatgpt: "ChatGPT"/);
  assert.ok(read("../extension/relay.js").includes(read("src/relay-codec.fn.js").trim()));
});

test("a relay code and a raw key identify the same account", () => {
  const context = vm.createContext({
    btoa, atob, TextEncoder, TextDecoder, URL, Uint8Array, crypto: webcrypto
  });
  vm.runInContext(CODEC_SOURCE + "\nglobalThis.codec = relayCodec();", context);
  const key = context.codec.newRelayKey();
  const code = context.codec.encodeConnectCode("https://relay.sendtogrokbot.com/", key);
  assert.equal(relayKeyFromToken(key), key);
  assert.equal(relayKeyFromToken(code), key);
  assert.equal(relayKeyFromToken("stgbr1.not-a-code"), "");
  assert.equal(relayKeyFromToken("rk_short"), "");
  const chat = prefilledOpenUrl("chatgpt", "https://x.com/a/status/1");
  assert.match(chat, /^https:\/\/chatgpt\.com\/\?q=/);
  assert.match(decodeURIComponent(chat), /https:\/\/x\.com\/a\/status\/1/);
  assert.match(decodeURIComponent(chat), /one-line takeaway/);
  assert.ok(chat.length < 6000);
  const codex = prefilledOpenUrl("codex", "https://x.com/a/status/1");
  assert.match(codex, /^https:\/\/chatgpt\.com\/codex\?prompt=/);
  assert.equal(prefilledOpenUrl("grokbot", "https://x.com/a/status/1"), "");
});

test("schema.sql contains the worker statements", () => {
  const file = read("schema.sql");
  for (const sql of STATEMENTS) assert.ok(file.includes(sql.trim()));
});

test("only the log helper writes to the console", () => {
  const files = ["src/index.js", "src/crypto.js", "src/validate.js", "src/db.js", "src/rate.js", "src/page.js", "src/client.js", "src/setup-page.fn.js", "src/relay-codec.fn.js", "src/connect-code.js", "src/open-link.js"];
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
  assert.match(parsed.error, /chatgpt, or codex/);
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

test("preset files match the extension prompt text", () => {
  const prompts = require("../../../extension/prompts.js");
  assert.deepEqual(prompts.ORDER, ["general", "research", "job-hunt", "buy-or-skip", "learn-later", "content-ideas"]);
  for (const id of prompts.ORDER) {
    const file = read(`../prompts/${id}.md`);
    const body = file.split("\n---\n")[1].trim();
    assert.equal(body, prompts.text(id), id);
  }
  assert.equal(read("../prompts/default-routine-prompt.md").split("\n---\n")[1].trim(), prompts.text("general"));
  const general = prompts.text("general");
  for (const phrase of [
    "one-line takeaway",
    "worth installing",
    "how to try it",
    "3-line summary",
    "why it matters",
    "what to watch",
    "Do not claim you watched it",
    "one actionable step",
    "who to follow",
    "worth buying or not",
    "one line of context"
  ]) {
    assert.ok(general.includes(phrase), phrase);
  }
  assert.equal(prompts.resolve({}).id, "general");
  assert.equal(prompts.resolve({ promptPreset: "job-hunt" }).text, prompts.text("job-hunt"));
  assert.equal(prompts.resolve({ promptPreset: "general", promptText: "My own words" }).id, "custom");
  const claudePage = read("../docs/setup/claude.html");
  for (const host of prompts.ALLOWED_SITES.split("\n")) assert.ok(claudePage.includes(host), host);
  assert.equal(prompts.ALLOWED_SITES.split("\n").length, 10);
});

test("a pasted connect link, header, or Fire URL is recognized in any order", () => {
  const { encodeConnectionCode, parseSetupPaste, planConnect } = require("../../../extension/connect.js");
  const code = encodeConnectionCode({
    destination: "grokbot",
    mode: "webhook",
    url: "https://api2.cursor.sh/automations/webhook/abc",
    key: "whsec_real_key"
  });
  const fromLink = parseSetupPaste("https://sendtogrokbot.com/connect#" + code);
  assert.equal(fromLink.ok, true);
  assert.equal(fromLink.destination, "grokbot");
  assert.equal(fromLink.fields.senderKey, "whsec_real_key");
  const headerFirst = parseSetupPaste("Authorization: Bearer whsec_real_key\nhttps://hooks.example.com/hook");
  assert.equal(headerFirst.fields.webhookUrl, "https://hooks.example.com/hook");
  assert.equal(headerFirst.fields.senderKey, "whsec_real_key");
  const tokenFirst = parseSetupPaste("sk-ant-oat01-abcdefghijklmnop\nhttps://api.anthropic.com/v1/claude_code/routines/trig_abc/fire");
  assert.equal(tokenFirst.destination, "claude");
  assert.equal(tokenFirst.fields.claudeToken, "sk-ant-oat01-abcdefghijklmnop");
  const trigFirst = parseSetupPaste("https://claude.ai/code/routines/trig_abc\nsk-ant-oat01-abcdefghijklmnop");
  assert.equal(trigFirst.fields.claudeFireUrl, "https://claude.ai/code/routines/trig_abc");
  const urlOnly = parseSetupPaste("trig_abc");
  assert.equal(urlOnly.kind, "claude");
  assert.equal(urlOnly.token, "");
  const plan = planConnect({ enabled: ["chatgpt"], promptPreset: "research" }, fromLink);
  assert.deepEqual(plan.settings.enabled, ["chatgpt", "grokbot"]);
  assert.equal(plan.settings.promptPreset, "research");
  assert.match(plan.message, /Saved Send to Grok Bot/);
  const { finishMessage } = require("../../../extension/connect.js");
  assert.equal(finishMessage(fromLink, plan), "Now open x.com and click the arrow.");
  const urlOnlyGrok = parseSetupPaste("https://hooks.example.com/hook");
  assert.equal(urlOnlyGrok.ok, true);
  const rejected = planConnect({ enabled: [] }, urlOnlyGrok);
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /Authorization header/);
});

test("1.1.0 settings survive an update and a blank local webhook does not win", () => {
  const { stgbMigrateSettings } = require("../../../extension/hosts.js");
  const fromSync = stgbMigrateSettings(
    { enabled: ["grokbot"], webhookUrl: "", senderKey: "" },
    { webhookUrl: "https://hooks.example/hook", senderKey: "whsec_old" }
  );
  assert.equal(fromSync.settings.webhookUrl, "https://hooks.example/hook");
  assert.equal(fromSync.settings.senderKey, "whsec_old");
  assert.deepEqual(fromSync.settings.enabled, ["grokbot"]);
  assert.deepEqual(fromSync.removeSync.sort(), ["senderKey", "webhookUrl"]);
  const keepLocal = stgbMigrateSettings(
    { enabled: ["grokbot"], webhookUrl: "https://hooks.example/local", senderKey: "local-key", claudePrompt: "old lens" },
    { webhookUrl: "https://hooks.example/sync", senderKey: "sync-key" }
  );
  assert.equal(keepLocal.settings.webhookUrl, "https://hooks.example/local");
  assert.equal(keepLocal.settings.senderKey, "local-key");
  assert.equal(keepLocal.settings.promptPreset, "custom");
  assert.equal(keepLocal.settings.promptText, "old lens");
  const already = stgbMigrateSettings(
    { promptPreset: "research", promptText: "", claudePrompt: "do not replace" },
    {}
  );
  assert.equal(already.patch.promptText, undefined);
  assert.equal(already.settings.promptPreset, "research");
});

test("service worker scripts share one scope and an empty webhook stays in the menu", () => {
  const context = vm.createContext({ console });
  context.globalThis = context;
  context.self = context;
  context.importScripts = () => {};
  context.chrome = {
    runtime: { onMessage: { addListener() {} }, onInstalled: { addListener() {} }, openOptionsPage() {} },
    action: { onClicked: { addListener() {} } },
    storage: { session: { set() {} } }
  };
  for (const file of ["hosts.js", "prompts.js", "destinations/grokbot.js", "destinations/claude.js", "destinations/chatgpt.js", "destinations/codex.js", "relay.js", "background.js"]) {
    vm.runInContext(read("../extension/" + file), context, { filename: file });
  }
  assert.equal(typeof context.STGB_DESTINATIONS.grokbot.send, "function");
  assert.equal(typeof context.STGB_DESTINATIONS.claude_routine.send, "function");
  assert.equal(typeof context.STGB_DESTINATIONS.chatgpt_link.send, "function");
  assert.equal(typeof context.STGB_DESTINATIONS.codex.send, "function");
  const empty = context.menuItems({ enabled: ["grokbot"], webhookUrl: "" });
  assert.equal(empty.length, 1);
  assert.equal(empty[0].needsSetup, true);
  const ready = context.menuItems({ enabled: ["grokbot"], webhookUrl: "https://hooks.example/hook" });
  assert.equal(ready[0].needsSetup, false);
  assert.equal(context.menuItems({}).length, 0);
  assert.equal(context.menuItems({ enabled: ["chatgpt"] })[0].needsSetup, false);
});

test("the share sheet shortcut posts one relay code and names each destination", () => {
  const file = read("../shortcuts/Send to Grok Bot.shortcut");
  assert.match(file, /Send to Grok Bot/);
  for (const name of ["Grok Bot", "Claude", "ChatGPT", "Codex"]) assert.ok(file.includes(name), name);
  for (const id of ["grokbot", "claude", "chatgpt", "codex"]) assert.ok(file.includes(`<string>${id}</string>`), id);
  assert.match(file, /https:\/\/relay\.sendtogrokbot\.com\/v1\/send/);
  assert.match(file, /WFWorkflowImportQuestions/);
  assert.match(file, /WFTextActionText/);
  assert.match(file, /ActionExtension/);
  assert.match(file, /<string>Authorization<\/string>/);
  assert.match(file, /application\/json/);
  assert.match(file, /<string>notice<\/string>/);
  assert.match(file, /<string>openUrl<\/string>/);
  assert.match(file, /<string>shortcut<\/string>/);
  assert.match(file, /Bearer \uFFFC/);
  assert.doesNotMatch(file, /rk_[A-Za-z0-9_-]{20}/);
  assert.doesNotMatch(file, /icloud\.com\/shortcuts\/[0-9a-f]{8}/);
  const steps = read("../shortcuts/BUILD.md");
  assert.match(steps, /Copy iCloud Link/);
  assert.match(steps, /Allow Untrusted Shortcuts/);
  assert.match(steps, /docs\/mobile\.html/);
  assert.match(steps, /stgbr1/);
});

test("pasting a webhook and header on /connect saves inside the paste gesture", async () => {
  assert.match(read("../extension/background.js"), /stgbAction === 'request-origins'/);
  assert.match(read("../extension/grant.js"), /permissions\.request/);
  assert.match(read("../extension/site-connect.js"), /stgb-grant/);
  assert.match(read("../extension/grant.html"), /id="box"/);
  const box = { value: "keep-me", addEventListener(type, fn) { this.listeners[type] = fn; }, listeners: {} };
  let duringPaste = false;
  let requests = 0;
  const saved = {};
  const context = {
    console,
    URL,
    TextEncoder,
    TextDecoder,
    btoa,
    atob,
    setTimeout,
    clearTimeout
  };
  context.globalThis = context;
  context.document = {
    documentElement: { dataset: {} },
    getElementById(id) { return id === "box" ? box : null; }
  };
  context.chrome = {
    runtime: { lastError: null },
    permissions: {
      request(msg, cb) {
        requests += 1;
        assert.equal(duringPaste, true);
        context.requested = { origins: msg.origins };
        queueMicrotask(() => cb(!context.deny));
      }
    },
    storage: {
      local: {
        get(_keys, cb) { cb({ enabled: [] }); },
        set(obj, cb) { Object.assign(saved, obj); cb(); },
        remove(_keys, cb) { cb(); }
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(read("../extension/hosts.js"), context, { filename: "hosts.js" });
  vm.runInContext(read("../extension/connect.js"), context, { filename: "connect.js" });
  vm.runInContext(read("../extension/grant.js"), context, { filename: "grant.js" });
  const raw = "Authorization: Bearer whsec_real_key\nhttps://hooks.example.com/hook";
  duringPaste = true;
  box.listeners.paste({ clipboardData: { getData() { return raw; } } });
  duringPaste = false;
  assert.equal(requests, 1);
  assert.equal(JSON.stringify(context.requested), JSON.stringify({ origins: ["https://hooks.example.com/*"] }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saved.webhookUrl, "https://hooks.example.com/hook");
  assert.equal(saved.senderKey, "whsec_real_key");
  assert.equal(context.document.documentElement.dataset.stgbMessage, "Now open x.com and click the arrow.");
  assert.equal(context.document.documentElement.dataset.stgbOk, "1");
  assert.equal(box.value, "");
  box.listeners.paste({ clipboardData: { getData() { return "https://hooks.example.com/only"; } } });
  assert.equal(requests, 1);
  assert.match(context.document.documentElement.dataset.stgbMessage, /Authorization header/);
  assert.equal(context.document.documentElement.dataset.stgbOk, "");
  context.deny = true;
  duringPaste = true;
  box.listeners.paste({ clipboardData: { getData() { return raw; } } });
  duringPaste = false;
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(context.document.documentElement.dataset.stgbMessage, "Choose Allow to finish.");
  assert.equal(context.document.documentElement.dataset.stgbOk, "");
});

test("the connect site is rooted at docs and hands the code to the extension", async () => {
  const page = read("../docs/connect.html");
  assert.match(page, /src="\/connect\.js"/);
  assert.match(page, /id="paste"/);
  assert.match(page, /Step 1\. Install the extension/);
  assert.match(page, /Step 2\. Paste here/);
  assert.match(page, /Load unpacked/);
  assert.match(page, /chrome:\/\/extensions/);
  assert.doesNotMatch(page, /id="connect"/);
  assert.doesNotMatch(page, /click Connect/);
  assert.match(read("../docs/index.html"), /href="\/connect"/);
  assert.doesNotMatch(read("../docs/index.html"), /http-equiv="refresh"/);
  assert.match(read("../docs/_redirects"), /\/\s+\/index\.html\s+200/);
  assert.match(read("../_redirects"), /\/\s+\/docs\/index\.html\s+200/);
  assert.match(read("../docs/_redirects"), /\/connect\s+\/connect\.html\s+200/);
  assert.match(read("../extension/manifest.json"), /"version": "1\.2\.5"/);
  assert.match(read("../extension/options.html"), /id="more"/);
  assert.match(read("../extension/options.html"), /More options/);
  assert.match(read("../extension/options.html"), /id="cc"/);
  assert.doesNotMatch(read("../extension/options.html"), /id="connect"/);
  assert.match(read("../extension/site-connect.js"), /id = 'stgb-grant'/);
  assert.match(read("../extension/grant.js"), /Choose Allow to finish/);
  assert.match(read("../AGENTS.md"), /send one message and stop/);
  assert.match(read("../AGENTS.md"), /Now open x.com and click the arrow/);
  assert.doesNotMatch(read("../plugin/skills/send-to-grok-bot/SKILL.md"), /stgb1/);
  assert.doesNotMatch(read("../plugin/skills/send-to-grok-bot/SKILL.md"), /click Connect/);
  assert.match(read("../extension/manifest.json"), /https:\/\/sendtogrokbot\.com\/connect\*/);
  assert.match(read("../site/wrangler.toml"), /directory = "\.\.\/dist\/site"/);
  assert.match(read("../README.md"), /npx wrangler deploy --config site\/wrangler\.toml/);
  const mobile = read("../docs/mobile.html");
  assert.match(mobile, /id="install-link"/);
  assert.match(mobile, /not published yet/);
  assert.match(mobile, /stgbr1/);
  assert.match(mobile, /https:\/\/relay\.sendtogrokbot\.com/);
  assert.doesNotMatch(mobile, /icloud\.com\/shortcuts\/[0-9a-f]{8}/);
  assert.doesNotMatch(mobile, /rk_[A-Za-z0-9_-]{20}/);
  const history = read("../docs/history.html");
  assert.match(history, /https:\/\/relay\.sendtogrokbot\.com\/v1\/history/);
  assert.match(history, /Authorization/);
  assert.doesNotMatch(history, /localStorage/);
  assert.match(read("../docs/_redirects"), /\/mobile\s+\/mobile\.html\s+200/);
  assert.match(read("../docs/_redirects"), /\/history\s+\/history\.html\s+200/);
  assert.match(read("../_redirects"), /\/mobile\s+\/docs\/mobile\.html\s+200/);
  assert.match(read("../docs/setup/index.html"), /href="\/mobile"/);
  assert.match(read("../README.md"), /\/mobile/);
  const script = history.slice(history.indexOf("<script>") + 8, history.lastIndexOf("</script>"));
  const nodes = {};
  function el(id) {
    if (!nodes[id]) {
      nodes[id] = {
        value: "",
        textContent: "",
        className: "",
        children: [],
        addEventListener(type, fn) { this["on" + type] = fn; },
        replaceChildren() { this.children = []; },
        appendChild(child) { this.children.push(child); }
      };
    }
    return nodes[id];
  }
  const context = {
    document: {
      getElementById: el,
      createElement() { return { textContent: "" }; }
    },
    fetch(url, init) {
      context.fetched = { url, init };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          ok: true,
          history: [{ sentAt: "2026-10-16T00:00:00.000Z", destination: "chatgpt", url: "https://x.com/a/status/1", author: "ada", ok: true, error: "" }]
        })
      });
    },
    Date,
    console
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(script, context);
  function settle() { return new Promise(resolve => setTimeout(resolve, 0)); }
  nodes.code.value = "  stgbr1.example  ";
  nodes.form.onsubmit({ preventDefault() {} });
  await settle();
  assert.equal(context.fetched.url, "https://relay.sendtogrokbot.com/v1/history");
  assert.equal(context.fetched.init.headers.Authorization, "Bearer stgbr1.example");
  assert.match(nodes.list.children[0].textContent, /ChatGPT/);
  assert.match(nodes.list.children[0].textContent, /https:\/\/x.com\/a\/status\/1/);
  assert.equal(nodes.code.value, "  stgbr1.example  ");
  nodes.code.value = " ";
  nodes.form.onsubmit({ preventDefault() {} });
  await settle();
  assert.match(nodes.msg.textContent, /Paste the relay code/);
});

test("the marketplace plugin package and logo match the form", () => {
  const cursorManifest = JSON.parse(read("../plugin/.cursor-plugin/plugin.json"));
  const agentManifest = JSON.parse(read("../plugin/plugin.json"));
  const marketplace = JSON.parse(read("../.cursor-plugin/marketplace.json"));
  assert.equal(cursorManifest.name, "send-to-grok-bot");
  assert.equal(agentManifest.name, "send-to-grok-bot");
  assert.equal(agentManifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(cursorManifest.logo, "assets/logo.svg");
  assert.equal(cursorManifest.skills, "./skills/");
  assert.equal(marketplace.plugins[0].source, "plugin");
  assert.equal(marketplace.plugins[0].name, "send-to-grok-bot");
  const skill = read("../plugin/skills/send-to-grok-bot/SKILL.md");
  assert.match(skill, /^---\nname: send-to-grok-bot\n/);
  assert.match(skill, /description:/);
  assert.match(skill, /sendtogrokbot\.com\/connect/);
  assert.match(skill, /Authorization header/);
  assert.match(skill, /one-line takeaway/);
  assert.match(skill, /job-hunt/);
  assert.doesNotMatch(skill, /rk_[A-Za-z0-9_-]{20}/);
  const routine = read("../plugin/skills/send-to-grok-bot/routine-prompt.md").trim();
  const general = read("../prompts/general.md").split("---").pop().trim();
  assert.equal(routine, general);
  const svg = read("../plugin/assets/logo.svg");
  assert.equal(svg, read("../docs/logo.svg"));
  assert.match(svg, /viewBox="0 0 128 128"/);
  assert.match(svg, /fill="#ffffff"/);
  assert.match(svg, /fill="#0f1419"/);
  assert.doesNotMatch(svg, /[\u{1F300}-\u{1FAFF}]/u);
  const png = readFileSync(join(root, "../plugin/assets/logo.png"));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 512);
  assert.equal(png[25], 2);
  assert.ok(png.equals(readFileSync(join(root, "../docs/logo.png"))));
  const form = read("../plugin/SUBMIT.md");
  const desc = form.match(/\| Brief Description \| (.*) \|/)[1];
  const steps = form.match(/\| Testing Instructions \| (.*) \|/)[1];
  assert.ok(desc.length <= 600, desc.length);
  assert.ok(steps.length <= 600, steps.length);
  assert.match(form, /Organization Handle \| sendtogrokbot/);
  assert.match(form, /Website URL \| https:\/\/sendtogrokbot\.com \|/);
  assert.match(form, /https:\/\/sendtogrokbot\.com\/logo\.svg/);
  assert.match(form, /Grok \(coming soon\), Grok Bot, and Cursor/);
});

test("Claude text keeps the old shape and prefixes a preset prompt", () => {
  const { claudeRoutineText } = require("../../../extension/destinations/claude.js");
  const bare = { url: "https://x.com/a/status/1", author: "ada", sentAt: "t", text: "hello" };
  assert.equal(claudeText(bare), claudeRoutineText(bare));
  const withPrompt = { ...bare, prompt: "Job hunt lens." };
  const text = claudeText(withPrompt);
  assert.equal(text, claudeRoutineText(withPrompt));
  assert.ok(text.startsWith("Prompt:\nJob hunt lens.\n\nX post to research"));
  const long = claudeText({ ...bare, prompt: "p".repeat(1000), text: "x".repeat(70000) });
  assert.equal(long.length, 65536);
});
