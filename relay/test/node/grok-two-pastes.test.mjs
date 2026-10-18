// The Grok Bot webhook URL and its Authorization header can be pasted one at a time, in either order.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const read = rel => readFileSync(join(root, rel), "utf8");

const URL_ONLY = "https://hooks.example.com/hook";
const HEADER = "Authorization: Bearer whsec_real_key";
const CLAUDE_FIRE = "https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire";
const X_STEP = "Now open x.com and click the arrow.";

function loadConnect() {
  const context = { console, URL, TextEncoder, TextDecoder, btoa, atob };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read("../extension/hosts.js"), context, { filename: "hosts.js" });
  vm.runInContext(read("../extension/connect.js"), context, { filename: "connect.js" });
  return context.STGB_CONNECT;
}

function paste(api, current, raw) {
  const parsed = api.parseSetupPaste(raw);
  assert.equal(parsed.ok, true, parsed.error);
  const plan = api.planConnect(current, parsed);
  assert.equal(plan.ok, true, plan.error);
  return { parsed, plan, text: api.finishMessage(parsed, plan) };
}

test("single values parse with a plain summary and no secret", () => {
  const { parseSetupPaste } = require("../../../extension/connect.js");
  for (const raw of [HEADER, "Bearer whsec_real_key", "whsec_real_key"]) {
    const parsed = parseSetupPaste(raw);
    assert.equal(parsed.ok, true, raw);
    assert.equal(parsed.kind, "secret");
    assert.equal(parsed.key, "whsec_real_key");
    assert.ok(parsed.plain);
    assert.doesNotMatch(parsed.plain, /whsec/);
  }
  const url = parseSetupPaste(URL_ONLY);
  assert.equal(url.ok, true);
  assert.ok(url.plain);
  const short = parseSetupPaste("Bearer k");
  assert.equal(short.ok, true);
  assert.equal(short.key, "k");
  assert.equal(parseSetupPaste("whsec_.../example").ok, false);
});

test("URL then header", () => {
  const api = loadConnect();
  const first = paste(api, { enabled: [] }, URL_ONLY);
  assert.equal(first.plan.settings.webhookUrl, URL_ONLY);
  assert.deepEqual([...first.plan.settings.enabled], ["grokbot"]);
  assert.deepEqual([...first.plan.origins], ["https://hooks.example.com/*"]);
  assert.equal(first.text, "Webhook URL saved. Now paste the Authorization header.");
  const second = paste(api, first.plan.settings, HEADER);
  assert.equal(second.plan.settings.webhookUrl, URL_ONLY);
  assert.equal(second.plan.settings.senderKey, "whsec_real_key");
  assert.equal(second.text, X_STEP);
});

test("header then URL", () => {
  const api = loadConnect();
  const first = paste(api, { enabled: [] }, "Bearer whsec_real_key");
  assert.equal(first.plan.settings.senderKey, "whsec_real_key");
  assert.equal(first.plan.settings.webhookUrl, undefined);
  assert.deepEqual([...first.plan.origins], []);
  assert.equal(first.text, "Key saved. Now paste the Webhook URL.");
  const second = paste(api, first.plan.settings, URL_ONLY);
  assert.equal(second.plan.settings.senderKey, "whsec_real_key");
  assert.equal(second.plan.settings.webhookUrl, URL_ONLY);
  assert.equal(second.text, X_STEP);
});

test("a bare key with a webhook already saved finishes at once", () => {
  const api = loadConnect();
  const done = paste(api, { enabled: ["grokbot"], webhookUrl: URL_ONLY }, "whsec_real_key");
  assert.equal(done.plan.settings.senderKey, "whsec_real_key");
  assert.equal(done.text, X_STEP);
});

test("both together work as before", () => {
  const api = loadConnect();
  const both = paste(api, { enabled: [] }, HEADER + "\n" + URL_ONLY);
  assert.equal(both.parsed.kind, "code");
  assert.equal(both.plan.settings.webhookUrl, URL_ONLY);
  assert.equal(both.plan.settings.senderKey, "whsec_real_key");
  assert.match(both.plan.message, /Saved Send to Grok Bot/);
  assert.equal(both.text, X_STEP);
});

test("Claude tokens and waiting Claude routines keep the Claude path", () => {
  const api = loadConnect();
  const sk = paste(api, { enabled: ["grokbot"], webhookUrl: URL_ONLY }, "sk-ant-oat01-abcdefghijklmnop");
  assert.equal(sk.parsed.kind, "claude");
  assert.equal(sk.plan.settings.claudeToken, "sk-ant-oat01-abcdefghijklmnop");
  assert.equal(sk.plan.settings.senderKey, undefined);
  assert.notEqual(sk.text, X_STEP);

  const claudeWaiting = { enabled: ["claude"], claudeFireUrl: CLAUDE_FIRE };
  const bare = paste(api, claudeWaiting, "plain_secret_value");
  assert.equal(bare.plan.settings.claudeToken, "plain_secret_value");
  assert.equal(bare.plan.settings.senderKey, undefined);
  assert.match(bare.text, /Clicking a post starts the Claude routine/);

  const bothWaiting = { enabled: ["claude", "grokbot"], claudeFireUrl: CLAUDE_FIRE, webhookUrl: URL_ONLY };
  const grok = paste(api, bothWaiting, "plain_secret_value");
  assert.equal(grok.plan.settings.senderKey, "plain_secret_value");
  assert.equal(grok.plan.settings.claudeToken, undefined);
  assert.equal(grok.text, X_STEP);
});

test("finishMessage reads the saved settings", () => {
  const api = loadConnect();
  const parsed = api.parseSetupPaste(URL_ONLY);
  assert.equal(api.finishMessage(parsed, { destination: "grokbot", message: "m", settings: { webhookUrl: URL_ONLY } }), "m");
  assert.equal(api.finishMessage(parsed, { destination: "grokbot", message: "m", settings: { webhookUrl: URL_ONLY, senderKey: "k" } }), X_STEP);
  const claude = api.parseSetupPaste("trig_abc");
  assert.equal(api.finishMessage(claude, { destination: "claude", message: "c", settings: { webhookUrl: URL_ONLY, senderKey: "k" } }), "c");
});

test("grant.js asks for permission only on the URL paste, in either order", async () => {
  for (const order of [[URL_ONLY, HEADER], [HEADER, URL_ONLY]]) {
    const box = { value: "", addEventListener(type, fn) { this.listeners[type] = fn; }, listeners: {} };
    const store = { enabled: [] };
    const requested = [];
    let duringPaste = false;
    const context = { console, URL, TextEncoder, TextDecoder, btoa, atob, setTimeout, clearTimeout };
    context.globalThis = context;
    context.document = {
      documentElement: { dataset: {} },
      getElementById(id) { return id === "box" ? box : null; }
    };
    context.chrome = {
      runtime: { lastError: null },
      permissions: {
        request(msg, cb) {
          assert.equal(duringPaste, true);
          requested.push([...msg.origins]);
          queueMicrotask(() => cb(true));
        }
      },
      storage: {
        local: {
          get(_keys, cb) { cb(JSON.parse(JSON.stringify(store))); },
          set(obj, cb) { Object.assign(store, JSON.parse(JSON.stringify(obj))); cb(); },
          remove(_keys, cb) { cb(); }
        }
      }
    };
    vm.createContext(context);
    vm.runInContext(read("../extension/hosts.js"), context, { filename: "hosts.js" });
    vm.runInContext(read("../extension/connect.js"), context, { filename: "connect.js" });
    vm.runInContext(read("../extension/grant.js"), context, { filename: "grant.js" });
    const messages = [];
    for (const raw of order) {
      box.value = raw;
      duringPaste = true;
      box.listeners.paste({ clipboardData: { getData() { return raw; } } });
      duringPaste = false;
      await new Promise(resolve => setTimeout(resolve, 5));
      messages.push(context.document.documentElement.dataset.stgbMessage);
      assert.equal(context.document.documentElement.dataset.stgbOk, "1");
      assert.equal(box.value, "");
    }
    assert.deepEqual(requested, [["https://hooks.example.com/*"]]);
    assert.equal(store.webhookUrl, URL_ONLY);
    assert.equal(store.senderKey, "whsec_real_key");
    assert.deepEqual(store.enabled, ["grokbot"]);
    if (order[0] === URL_ONLY) assert.deepEqual(messages, ["Webhook URL saved. Now paste the Authorization header.", X_STEP]);
    else assert.deepEqual(messages, ["Key saved. Now paste the Webhook URL.", X_STEP]);
  }
});
