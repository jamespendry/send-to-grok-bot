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

// The service worker asks api.fxtwitter.com / api.vxtwitter.com for the full post first.
// `mirror` maps those URLs to JSON bodies; anything else there is a 404, so the page post goes out.
function worker(settings, mirror = {}) {
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
      if (/^https:\/\/api\.(fx|vx)twitter\.com\//.test(String(url))) {
        cap.push({ kind: "mirror", url: String(url) });
        const body = mirror[String(url)];
        return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 404, json: async () => ({}) };
      }
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
  for (const f of ["hosts.js", "enrich.js", "prompts.js", "destinations/grokbot.js", "destinations/claude.js", "destinations/chatgpt.js", "destinations/codex.js", "relay.js", "background.js"]) {
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

test("a reply's parent and full text reach the Claude fire text and the Grok digest", async () => {
  const tweet = (id, user, text, extra = {}) => ({ code: 200, message: "OK", tweet: {
    url: `https://x.com/${user}/status/${id}`, id, text, author: { screen_name: user, name: user.toUpperCase() },
    created_at: "Sun Oct 18 05:06:07 +0000 2026", created_timestamp: 1792299967, is_note_tweet: false,
    replying_to: null, replying_to_status: null, ...extra } });
  const full = POST.text + " and here is the rest of the long post after Show more.";
  const mirror = {
    "https://api.fxtwitter.com/alice/status/1234567890": tweet("1234567890", "alice", full, { replying_to: "bob", replying_to_status: "99" }),
    "https://api.fxtwitter.com/bob/status/99": tweet("99", "bob", "Step 1: parent post the page never showed.")
  };
  const c = worker({ enabled: ["claude"], claudeFireUrl: FIRE, claudeToken: TOKEN }, mirror);
  assert.equal((await c.send({ stgbDestination: "claude", ...POST })).ok, true);
  const text = JSON.parse(c.cap.find((x) => x.kind === "fetch").body).text;
  assert.ok(text.includes("Replying to (1 earlier post, oldest first):\n[1] @bob (BOB)"), text);
  assert.ok(text.includes("Step 1: parent post the page never showed."));
  assert.ok(text.includes("Post:\n" + full));
  const g = worker({ enabled: ["grokbot"], webhookUrl: "https://example.test/hook", senderKey: "abc" }, mirror);
  assert.equal((await g.send({ stgbDestination: "grokbot", ...POST })).ok, true);
  const body = JSON.parse(g.cap.find((x) => x.kind === "fetch").body);
  assert.equal(body.text, full);
  assert.equal(body.context.source, "fxtwitter");
  assert.equal(body.context.parents[0].text, "Step 1: parent post the page never showed.");
  assert.ok(body.digest.includes("Step 1: parent post the page never showed."));
});

test("with no mirror answer, the send still goes out with the page text and source page", async () => {
  const w = worker({ enabled: ["grokbot"], webhookUrl: "https://example.test/hook", senderKey: "abc" });
  assert.equal((await w.send({ stgbDestination: "grokbot", ...POST })).ok, true);
  assert.ok(w.cap.some((c) => c.kind === "mirror"), "mirrors were asked first");
  const body = JSON.parse(w.cap.find((c) => c.kind === "fetch").body);
  assert.equal(body.context.source, "page");
  assert.ok(body.digest.includes("\nText:\n" + POST.text));
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

const STYLES = [{ id: "a1", name: "Sales lead check", text: "Is this person a sales lead? Answer yes or no first." }];

test("saved styles: the default saved style goes out as the prompt", async () => {
  const w = worker({ enabled: ["grokbot"], webhookUrl: "https://example.test/hook", senderKey: "abc", savedStyles: STYLES, promptPreset: "saved:a1" });
  const r = await w.send({ stgbDestination: "grokbot", ...POST });
  assert.equal(r.ok, true, JSON.stringify(r));
  const body = JSON.parse(w.cap.find((c) => c.kind === "fetch").body);
  assert.equal(body.preset, "custom");
  assert.equal(body.prompt, STYLES[0].text);
});

test("saved styles: a style picked in the Send menu wins for that post, and stays out of the payload", async () => {
  const w = worker({ enabled: ["grokbot"], webhookUrl: "https://example.test/hook", senderKey: "abc", savedStyles: STYLES, promptPreset: "general" });
  await w.send({ stgbDestination: "grokbot", stgbStyle: "saved:a1", ...POST });
  let body = JSON.parse(w.cap.filter((c) => c.kind === "fetch").pop().body);
  assert.equal(body.prompt, STYLES[0].text);
  assert.equal("stgbStyle" in body, false);
  const w2 = worker({ enabled: ["grokbot"], webhookUrl: "https://example.test/hook", senderKey: "abc", savedStyles: STYLES, promptPreset: "saved:a1" });
  await w2.send({ stgbDestination: "grokbot", stgbStyle: "research", ...POST });
  body = JSON.parse(w2.cap.filter((c) => c.kind === "fetch").pop().body);
  assert.equal(body.preset, "research");
  // An unknown pick falls back to the saved default rather than failing.
  const w3 = worker({ enabled: ["grokbot"], webhookUrl: "https://example.test/hook", senderKey: "abc", savedStyles: STYLES, promptPreset: "saved:a1" });
  await w3.send({ stgbDestination: "grokbot", stgbStyle: "saved:nope", ...POST });
  body = JSON.parse(w3.cap.filter((c) => c.kind === "fetch").pop().body);
  assert.equal(body.prompt, STYLES[0].text);
});

test("saved styles: one destination plus saved styles opens the menu with the style list", async () => {
  const one = worker({ enabled: ["grokbot"], webhookUrl: "https://example.test/hook", senderKey: "abc" });
  const plain = await one.send({ stgbAction: "send", ...POST });
  assert.equal(plain.items, undefined, "no saved styles: one click still sends");
  const w = worker({ enabled: ["grokbot"], webhookUrl: "https://example.test/hook", senderKey: "abc", savedStyles: STYLES, promptPreset: "saved:a1" });
  const r = await w.send({ stgbAction: "send", ...POST });
  assert.equal(r.items.length, 1);
  assert.equal(r.styles[r.styles.length - 1].label, "Sales lead check");
  assert.equal(r.styles[0].id, "general");
  assert.equal(r.style, "saved:a1");
  assert.equal(w.cap.filter((c) => c.kind === "fetch").length, 0, "nothing is sent until a row is picked");
});
