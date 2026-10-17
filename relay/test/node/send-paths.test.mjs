// Drives the real background.js message handler in a vm with a stubbed chrome API.
// Nothing leaves the process: fetch and chrome.tabs.create only record what they were given.
// Run: cd relay && node --test test/node/send-paths.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ext = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "extension");
const read = (f) => readFileSync(join(ext, f), "utf8");

const POST = {
  url: "https://x.com/alice/status/1234567890",
  text: "Check out this new tool https://github.com/foo/bar",
  author: "alice",
  authorName: "Alice Example",
  postedAt: "2026-10-15T12:00:00.000Z",
  links: [],
  media: [],
  thread: []
};
const FIRE = "https://api.anthropic.com/v1/claude_code/routines/trig_TEST123/fire";
const TOKEN = "sk-ant-oat01-FAKEFAKEFAKEFAKE";

function worker(settings) {
  const cap = [];
  let listener;
  const store = { ...settings };
  const area = (obj) => ({
    get(keys, cb) { const v = { ...obj }; if (cb) cb(v); return Promise.resolve(v); },
    set(patch, cb) { Object.assign(obj, patch); if (cb) cb(); return Promise.resolve(); },
    remove(keys, cb) { for (const k of [].concat(keys)) delete obj[k]; if (cb) cb(); return Promise.resolve(); }
  });
  const ctx = vm.createContext({
    console, URL, TextEncoder, TextDecoder, btoa, atob, setTimeout, clearTimeout, Date, JSON, Promise,
    fetch: async (url, init) => {
      cap.push({ kind: "fetch", url: String(url), ...init });
      return { ok: true, status: 200, json: async () => ({ claude_code_session_url: "https://claude.ai/code/session_fake" }) };
    }
  });
  ctx.globalThis = ctx;
  ctx.self = ctx;
  ctx.importScripts = () => {};
  ctx.chrome = {
    runtime: { onMessage: { addListener(fn) { listener = fn; } }, onInstalled: { addListener() {} }, openOptionsPage() { cap.push({ kind: "options" }); } },
    action: { onClicked: { addListener() {} } },
    storage: { local: area(store), sync: area({}), session: area({}) },
    permissions: { contains: async () => true },
    tabs: { create: async (o) => { cap.push({ kind: "tab", url: o.url }); return { id: 1 }; } }
  };
  for (const f of ["hosts.js", "prompts.js", "destinations/grokbot.js", "destinations/claude.js", "destinations/chatgpt.js", "destinations/codex.js", "relay.js", "background.js"]) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  const send = (msg) => new Promise((resolve) => listener(msg, {}, resolve));
  return { cap, send, ctx };
}

test("Claude routine: POST to the fire URL with bearer, anthropic-version, and {text} starting with Prompt:", async () => {
  const w = worker({ enabled: ["claude"], claudeFireUrl: FIRE, claudeToken: TOKEN, promptPreset: "research" });
  const r = await w.send({ stgbDestination: "claude", ...POST });
  assert.equal(r.ok, true, JSON.stringify(r));
  const f = w.cap.find((c) => c.kind === "fetch");
  assert.equal(f.url, FIRE);
  assert.equal(f.method, "POST");
  assert.equal(f.headers.Authorization, "Bearer " + TOKEN);
  assert.equal(f.headers["anthropic-version"], "2023-06-01");
  const body = JSON.parse(f.body);
  assert.deepEqual(Object.keys(body), ["text"]);
  assert.ok(body.text.startsWith("Prompt:\n"));
  assert.ok(body.text.includes("Then say what you could verify"), "research preset text is carried");
  assert.ok(body.text.includes(`X post to research\nURL: ${POST.url}\nAuthor: @alice`));
  assert.ok(body.text.includes("Check out this new tool"));
});

test("Grok webhook: JSON payload with prompt and digest, key in both headers", async () => {
  const w = worker({ enabled: ["grokbot"], webhookUrl: "https://example.test/hook", senderKey: "abc" });
  const r = await w.send({ stgbDestination: "grokbot", ...POST });
  assert.equal(r.ok, true, JSON.stringify(r));
  const f = w.cap.find((c) => c.kind === "fetch");
  assert.equal(f.url, "https://example.test/hook");
  assert.equal(f.headers["Content-Type"], "application/json");
  assert.equal(f.headers.Authorization, "Bearer abc");
  assert.equal(f.headers["X-Sender-Key"], "abc");
  const body = JSON.parse(f.body);
  assert.equal(body.version, 2);
  assert.equal(body.source, "x");
  assert.equal(body.preset, "general");
  assert.ok(body.prompt.startsWith("Someone saved one X post"));
  assert.ok(body.digest.startsWith("X post by @alice (Alice Example)"));
  assert.equal("stgbDestination" in body, false);
});

for (const [brand, settings, prefix, max] of [
  ["chatgpt", { enabled: ["chatgpt"] }, "https://chatgpt.com/?q=", 6000],
  ["codex", { enabled: ["codex"], codexEnvironment: "abc123", codexBranch: "main" }, "https://chatgpt.com/codex?environment=abc123&branch=main&prompt=", 6000],
  ["claude", { enabled: ["claude"] }, "https://claude.ai/new?q=", 8000]
]) {
  test(`${brand} link opens a prefilled tab under ${max} chars and sends nothing`, async () => {
    for (const text of [POST.text, "word ".repeat(5000)]) {
      const w = worker(settings);
      const r = await w.send({ stgbDestination: brand, ...POST, text });
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.equal(w.cap.some((c) => c.kind === "fetch"), false);
      const tab = w.cap.find((c) => c.kind === "tab");
      assert.ok(tab.url.startsWith(prefix), tab.url.slice(0, 80));
      assert.ok(tab.url.length <= max, `${tab.url.length} > ${max}`);
      const decoded = decodeURIComponent(tab.url.slice(prefix.length));
      assert.ok(decoded.startsWith("Someone saved one X post"));
      assert.ok(decoded.includes(POST.url));
      if (text.length > 1000) assert.ok(decoded.includes("…"), "long text is cut with an ellipsis");
      else assert.ok(decoded.includes("Check out this new tool"));
    }
  });
}

// Found by the headless Chrome run on 2026-10-16: chrome.permissions is undefined in content
// scripts, so a click on Connect for a webhook or Claude routine code throws at
// site-connect.js `chrome.permissions.request` and nothing is saved or shown.
// The paste flow now asks background.js (stgbAction 'request-origins'); keep it that way.
test("site-connect.js does not call chrome.permissions from the content script", () => {
  const src = read("site-connect.js").replace(/\/\/.*$/gm, "");
  assert.equal(/chrome\.permissions\./.test(src), false);
});
