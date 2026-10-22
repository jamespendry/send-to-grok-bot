import { env, exports } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import worker, { handle } from "../src/index.js";
import { LIMITS } from "../src/rate.js";

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

let ipN = 0;
function nextIp() {
  ipN += 1;
  return `203.0.113.${(ipN % 250) + 1}`;
}

function relayKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "rk_" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function connectCode(key, relay = "https://relay.sendtogrokbot.com") {
  const payload = JSON.stringify({ v: 1, relay, key });
  const bytes = new TextEncoder().encode(payload);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "stgbr1." + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function testEnv(outbound) {
  return {
    DB: env.DB,
    KV: env.KV,
    ENCRYPTION_KEY: env.ENCRYPTION_KEY,
    OUTBOUND_FETCH: outbound
  };
}

function mockFetch(status, responseBody) {
  const calls = [];
  const fn = async request => {
    calls.push({
      url: request.url,
      method: request.method,
      authorization: request.headers.get("Authorization"),
      sender: request.headers.get("X-Sender-Key"),
      version: request.headers.get("anthropic-version"),
      type: request.headers.get("Content-Type"),
      body: await request.text()
    });
    const payload = responseBody == null ? "" : typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody);
    return new Response(payload, { status, headers: { "content-type": "application/json" } });
  };
  fn.calls = calls;
  return fn;
}

async function api(path, { method = "GET", key, body, ip, outbound, headers = {} } = {}) {
  const requestHeaders = { "cf-connecting-ip": ip || nextIp(), ...headers };
  if (key) requestHeaders.authorization = "Bearer " + key;
  let payload;
  if (body !== undefined) {
    requestHeaders["content-type"] = requestHeaders["content-type"] || "application/json";
    payload = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await handle(new Request("https://relay.test" + path, { method, headers: requestHeaders, body: payload }), testEnv(outbound));
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text, headers: res.headers };
}

async function saveGrok(key, ip, extra = {}) {
  return api("/v1/config", {
    method: "PUT",
    key,
    ip,
    body: { grokbot: { webhookUrl: "https://hooks.example/hook", senderKey: "whsec_test_key", ...extra } }
  });
}

beforeEach(async () => {
  await reset();
});

afterEach(() => {
  // reset() drops rows. The next request recreates tables.
});

describe("setup page", () => {
  it("explains the code in plain language", async () => {
    const page = await api("/");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(page.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(page.text).toContain("system-ui");
    expect(page.text).toContain("Connect code");
    expect(page.text).toContain("stgbr1.");
    expect(page.text).toContain("Save destinations");
    expect(page.text).toContain("The post text is not stored.");
    expect(page.text).toContain("Remove the saved webhook key");
    expect(page.text).toContain('src="/setup.js"');
    expect(page.text).not.toMatch(EMOJI);
    expect(page.text).not.toContain("rk_");
    const script = await api("/setup.js");
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toContain("javascript");
    expect(script.text).toContain("function relayCodec()");
    expect(script.text).toContain("function setupPage()");
    expect(script.text).toContain("Nothing is saved for this code yet.");
    expect(script.text).not.toMatch(EMOJI);
  });

  it("serves the page under /api with a matching script path", async () => {
    const page = await api("/api/");
    expect(page.status).toBe(200);
    expect(page.text).toContain('src="/api/setup.js"');
    const script = await api("/api/setup.js");
    expect(script.text).toContain("function relayCodec()");
  });

  it("answers through the default export", async () => {
    const res = await exports.default.fetch("https://relay.test/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Send to Grok Bot relay");
  });
});

describe("config", () => {
  it("rejects a missing key and masks secrets after save", async () => {
    const missing = await api("/v1/config");
    expect(missing.status).toBe(401);
    const key = relayKey();
    const ip = nextIp();
    const saved = await api("/v1/config", {
      method: "PUT",
      key,
      ip,
      body: {
        grokbot: { webhookUrl: "https://hooks.example/hook", senderKey: "whsec_test_key" },
        claude: { fireUrl: "https://claude.ai/code/routines/trig_abc", token: "sk-ant-oat01-secret" }
      }
    });
    expect(saved.status).toBe(200);
    const loaded = await api("/v1/config", { key, ip });
    expect(loaded.status).toBe(200);
    expect(loaded.json.destinations.grokbot).toEqual({ enabled: true, webhookUrl: "https://hooks.example/hook", hasKey: true });
    expect(loaded.json.destinations.claude.enabled).toBe(true);
    expect(loaded.json.destinations.claude.fireUrl).toBe("https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire");
    expect(loaded.json.destinations.claude.hasToken).toBe(true);
    expect(loaded.text).not.toContain("whsec_test_key");
    expect(loaded.text).not.toContain("sk-ant-oat01-secret");
    expect(loaded.text).not.toContain("\"v1.");
    const other = await api("/v1/config", { key: relayKey() });
    expect(other.status).toBe(401);
  });

  it("keeps a secret when the field is omitted and clears it when empty", async () => {
    const key = relayKey();
    const ip = nextIp();
    await saveGrok(key, ip);
    const kept = await api("/v1/config", {
      method: "PUT",
      key,
      ip,
      body: { grokbot: { webhookUrl: "https://hooks.example/other" } }
    });
    expect(kept.status).toBe(200);
    const outbound = mockFetch(200, { ok: true });
    const sent = await api("/v1/send", {
      method: "POST",
      key,
      ip,
      outbound,
      body: { destination: "grokbot", url: "https://x.com/a/status/1", text: "hello", author: "a", sentAt: "2026-10-16T00:00:00.000Z" }
    });
    expect(sent.status).toBe(200);
    expect(outbound.calls[0].authorization).toBe("Bearer whsec_test_key");
    expect(outbound.calls[0].url).toBe("https://hooks.example/other");
    await api("/v1/config", { method: "PUT", key, ip, body: { grokbot: { senderKey: "" } } });
    const again = mockFetch(200, {});
    await api("/v1/send", {
      method: "POST",
      key,
      ip,
      outbound: again,
      body: { destination: "grokbot", url: "https://x.com/a/status/1", text: "hello", author: "a" }
    });
    expect(again.calls[0].authorization).toBeNull();
    expect(again.calls[0].sender).toBeNull();
  });

  it("rejects private webhook addresses and a loop back to the relay", async () => {
    const key = relayKey();
    const ip = nextIp();
    const cases = [
      "http://hooks.example/hook",
      "https://127.0.0.1/hook",
      "https://169.254.169.254/latest",
      "https://metadata.google.internal/computeMetadata/v1/",
      "https://user:pass@hooks.example/hook",
      "https://relay.test/v1/send",
      "https://localhost/hook"
    ];
    for (const webhookUrl of cases) {
      const res = await api("/v1/config", { method: "PUT", key, ip, body: { grokbot: { webhookUrl, senderKey: "k" } } });
      expect(res.status, webhookUrl).toBe(400);
    }
    const loaded = await api("/v1/config", { key, ip });
    expect(loaded.status).toBe(401);
  });

  it("does not show one account to another key", async () => {
    const ip = nextIp();
    const first = relayKey();
    const second = relayKey();
    await saveGrok(first, ip);
    await api("/v1/config", {
      method: "PUT",
      key: second,
      ip,
      body: { grokbot: { webhookUrl: "https://other.example/hook" } }
    });
    const a = await api("/v1/config", { key: first, ip });
    const b = await api("/v1/config", { key: second, ip });
    expect(a.json.destinations.grokbot.webhookUrl).toBe("https://hooks.example/hook");
    expect(a.json.destinations.grokbot.hasKey).toBe(true);
    expect(b.json.destinations.grokbot.webhookUrl).toBe("https://other.example/hook");
    expect(b.json.destinations.grokbot.hasKey).toBe(false);
    expect(b.text).not.toContain("whsec_test_key");
  });

  it("rejects a Claude address that is not a routine", async () => {
    const key = relayKey();
    const res = await api("/v1/config", {
      method: "PUT",
      key,
      body: { claude: { fireUrl: "https://example.com/trig_abc", token: "sk-ant-oat01-secret" } }
    });
    expect(res.status).toBe(400);
  });
});

describe("send", () => {
  it("accepts the shortcut POST with a full stgbr1 code and a mock webhook", async () => {
    const key = relayKey();
    const code = connectCode(key);
    const ip = nextIp();
    await saveGrok(key, ip);
    const outbound = mockFetch(200, { ok: true });
    const res = await api("/v1/send", {
      method: "POST",
      key: code,
      ip,
      outbound,
      body: {
        destination: "grokbot",
        url: "https://x.com/jack/status/20",
        source: "shortcut"
      }
    });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    expect(res.json.notice).toBe("Sent to Grok Bot");
    expect(res.json.destination).toBe("grokbot");
    expect(outbound.calls).toHaveLength(1);
    expect(outbound.calls[0].url).toBe("https://hooks.example/hook");
    expect(outbound.calls[0].authorization).toBe("Bearer whsec_test_key");
    const forwarded = JSON.parse(outbound.calls[0].body);
    expect(forwarded.source).toBe("shortcut");
    expect(forwarded.url).toBe("https://x.com/jack/status/20");
    expect(forwarded.destination).toBeUndefined();
  });

  it("sends from the phone in the background and answers in one line of text", async () => {
    const key = relayKey();
    const code = connectCode(key);
    const ip = nextIp();
    await saveGrok(key, ip);
    const calls = [];
    const outbound = async request => {
      calls.push(request.url);
      if (request.url.startsWith("https://hooks.example/")) {
        calls.body = await request.text();
        return new Response("{}", { status: 200 });
      }
      // The post mirrors are down; the post still goes out with its link.
      return new Response("", { status: 503 });
    };
    const res = await api("/v1/send", {
      method: "POST",
      key: code,
      ip,
      outbound,
      body: { destination: "grokbot", url: "Look at this https://x.com/jack/status/20?s=46 via X", format: "text" }
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.text).toBe("Sent to Grok Bot. The reply will land in your Grok Bot chat.");
    expect(calls.filter(u => u.startsWith("https://hooks.example/"))).toHaveLength(1);
    const forwarded = JSON.parse(calls.body);
    expect(forwarded.url).toBe("https://x.com/jack/status/20");
    expect(forwarded.author).toBe("jack");
    expect(forwarded.destination).toBeUndefined();

    const none = await api("/v1/send", {
      method: "POST",
      key: code,
      ip,
      outbound,
      body: { destination: "grokbot", url: "no link here", format: "text" }
    });
    expect(none.status).toBe(200);
    expect(none.text).toContain("No post link came through");
  });

  it("explains a refused webhook in plain words instead of an HTTP code", async () => {
    const key = relayKey();
    const code = connectCode(key);
    const ip = nextIp();
    await saveGrok(key, ip);
    const answers = { 401: "didn't accept the key", 404: "can't find the routine", 503: "problem on its side" };
    for (const [status, words] of Object.entries(answers)) {
      const outbound = async request => request.url.startsWith("https://hooks.example/")
        ? new Response("no", { status: Number(status) })
        : new Response("", { status: 503 });
      const res = await api("/v1/send", { method: "POST", key: code, ip, outbound, body: { destination: "grokbot", url: "https://x.com/jack/status/20", format: "text" } });
      expect(res.text).toContain("Not sent: Grok Bot");
      expect(res.text).toContain(words);
      expect(res.text).not.toContain("HTTP");
    }
  });

  it("sends a setup test from the phone so the person sees it work", async () => {
    const key = relayKey();
    const code = connectCode(key);
    const ip = nextIp();
    const calls = [];
    const outbound = async request => {
      calls.push(request.url);
      calls.body = await request.text();
      return new Response("{}", { status: 200 });
    };
    const before = await api("/v1/send", { method: "POST", key: code, ip, outbound, body: { destination: "grokbot", test: "setup", format: "text" } });
    expect(before.text).toContain("Not connected yet");
    await saveGrok(key, ip);
    const res = await api("/v1/send", { method: "POST", key: code, ip, outbound, body: { destination: "grokbot", test: "setup", format: "text" } });
    expect(res.status).toBe(200);
    expect(res.text).toContain("Connected. Grok Bot got a test");
    const forwarded = JSON.parse(calls.body);
    expect(forwarded.source).toBe("setup");
    expect(forwarded.text).toContain("your iPhone is connected");

    // Start over forgets the code, so a code someone saw stops working.
    const gone = await api("/v1/config", { method: "DELETE", key, ip });
    expect(gone.status).toBe(200);
    const after = await api("/v1/send", { method: "POST", key: code, ip, outbound, body: { destination: "grokbot", test: "setup", format: "text" } });
    expect(after.text).toContain("Not connected yet");
  });

  it("forwards a Grok Bot webhook with the bearer key and without the destination field", async () => {
    const key = relayKey();
    const ip = nextIp();
    const lines = [];
    const original = console.log;
    console.log = (...args) => { lines.push(args.map(String).join(" ")); };
    try {
      await saveGrok(key, ip);
      const outbound = mockFetch(200, { echo: "LEAK_GROK_BODY" });
      const res = await api("/v1/send", {
        method: "POST",
        key,
        ip,
        outbound,
        body: {
          destination: "grokbot",
          source: "x",
          url: "https://x.com/a/status/9",
          text: "SUPER_SECRET_POST_TEXT",
          author: "ada",
          sentAt: "2026-10-16T00:00:00.000Z",
          quote: "a quote"
        }
      });
      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
      expect(res.text).not.toContain("LEAK_GROK_BODY");
      expect(res.text).not.toContain("whsec_test_key");
      const call = outbound.calls[0];
      expect(call.method).toBe("POST");
      expect(call.authorization).toBe("Bearer whsec_test_key");
      expect(call.sender).toBe("whsec_test_key");
      expect(call.type).toContain("application/json");
      const forwarded = JSON.parse(call.body);
      expect(forwarded.destination).toBeUndefined();
      expect(forwarded.text).toBe("SUPER_SECRET_POST_TEXT");
      expect(forwarded.quote).toBe("a quote");
      expect(forwarded.url).toBe("https://x.com/a/status/9");
      const history = await api("/v1/config", { key, ip });
      expect(history.json.history).toHaveLength(1);
      expect(history.json.history[0].ok).toBe(true);
      expect(history.json.history[0].url).toBe("https://x.com/a/status/9");
      expect(history.text).not.toContain("SUPER_SECRET_POST_TEXT");
      expect(history.text).not.toContain("whsec_test_key");
      const log = lines.join("\n");
      expect(log).toContain("/v1/send");
      expect(log).not.toContain("whsec_test_key");
      expect(log).not.toContain(key);
      expect(log).not.toContain("SUPER_SECRET_POST_TEXT");
    } finally {
      console.log = original;
    }
  });

  it("fires a Claude routine with anthropic-version and a text body", async () => {
    const key = relayKey();
    const ip = nextIp();
    const lines = [];
    const original = console.log;
    console.log = (...args) => { lines.push(args.map(String).join(" ")); };
    try {
      const saved = await api("/v1/config", {
        method: "PUT",
        key,
        ip,
        body: { claude: { fireUrl: "trig_abc", token: "sk-ant-oat01-secret" } }
      });
      expect(saved.status).toBe(200);
      const outbound = mockFetch(200, { claude_code_session_url: "https://claude.ai/code/session/1", secret_echo: "SHOULD_NOT_LEAK" });
      const res = await api("/v1/send", {
        method: "POST",
        key,
        ip,
        outbound,
        body: { destination: "claude", url: "https://x.com/a/status/2", text: "hello", author: "ada", sentAt: "2026-10-16T01:00:00.000Z" }
      });
      expect(res.status).toBe(200);
      expect(res.json.sessionUrl).toBe("https://claude.ai/code/session/1");
      expect(res.text).not.toContain("SHOULD_NOT_LEAK");
      expect(res.text).not.toContain("sk-ant-oat01-secret");
      const call = outbound.calls[0];
      expect(call.url).toBe("https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire");
      expect(call.authorization).toBe("Bearer sk-ant-oat01-secret");
      expect(call.version).toBe("2023-06-01");
      const body = JSON.parse(call.body);
      expect(Object.keys(body)).toEqual(["text"]);
      expect(body.text).toBe('X post to research\nURL: https://x.com/a/status/2\nAuthor: @ada\nSent at: 2026-10-16T01:00:00.000Z\n\n"""\nhello\n"""');
      const log = lines.join("\n");
      expect(log).toContain("/v1/send");
      expect(log).not.toContain("sk-ant-oat01-secret");
      expect(log).not.toContain(key);
    } finally {
      console.log = original;
    }
  });

  it("maps a Claude error and does not set up a missing destination", async () => {
    const key = relayKey();
    const ip = nextIp();
    await api("/v1/config", { method: "PUT", key, ip, body: { claude: { fireUrl: "trig_abc", token: "sk-ant-oat01-secret" } } });
    const outbound = mockFetch(401, { error: "nope" });
    const res = await api("/v1/send", {
      method: "POST",
      key,
      ip,
      outbound,
      body: { destination: "claude", url: "https://x.com/a/status/3", text: "hi", author: "a" }
    });
    expect(res.status).toBe(502);
    expect(res.json.error).toBe("Token invalid for this routine");
    const missing = await api("/v1/send", {
      method: "POST",
      key,
      ip,
      body: { destination: "grokbot", url: "https://x.com/a/status/3", text: "hi", author: "a" }
    });
    expect(missing.status).toBe(400);
    expect(missing.json.error).toContain("not set up");
  });

  it("rejects a bad destination and a send before anything is saved", async () => {
    const key = relayKey();
    const ip = nextIp();
    await api("/v1/config", { method: "PUT", key, ip, body: {} });
    const bad = await api("/v1/send", { method: "POST", key, ip, body: { destination: "email", url: "https://x.com/a/status/1", text: "hi" } });
    expect(bad.status).toBe(400);
    const fresh = relayKey();
    const early = await api("/v1/send", { method: "POST", key: fresh, body: { destination: "grokbot", url: "https://x.com/a/status/1", text: "hi" } });
    expect(early.status).toBe(404);
  });

  it("keeps only the last 50 sends", async () => {
    const key = relayKey();
    const ip = nextIp();
    await saveGrok(key, ip);
    const outbound = mockFetch(200, {});
    for (let i = 1; i <= 55; i++) {
      const res = await api("/v1/send", {
        method: "POST",
        key,
        ip,
        outbound,
        body: { destination: "grokbot", url: `https://x.com/a/status/${i}`, text: `post ${i}`, author: "a" }
      });
      expect(res.status).toBe(200);
    }
    const history = await api("/v1/config", { key, ip });
    expect(history.json.history).toHaveLength(50);
    expect(history.json.history[0].url).toBe("https://x.com/a/status/55");
    expect(history.json.history.some(item => item.url.endsWith("/status/5"))).toBe(false);
    expect(history.text).not.toContain("post 55");
  }, 30000);

  it("accepts a relay code and opens ChatGPT or Codex without calling out", async () => {
    const key = relayKey();
    const code = connectCode(key);
    const outbound = async () => { throw new Error("outbound"); };
    const chat = await api("/v1/send", {
      method: "POST",
      key: code,
      outbound,
      body: { destination: "chatgpt", url: "https://x.com/ada/status/9", text: "SECRET_POST_TEXT", author: "ada", source: "shortcut" }
    });
    expect(chat.status).toBe(200);
    expect(chat.json.ok).toBe(true);
    expect(chat.json.label).toBe("ChatGPT");
    expect(chat.json.notice).toBe("Opened ChatGPT");
    expect(chat.json.openUrl).toContain("https://chatgpt.com/?q=");
    expect(decodeURIComponent(chat.json.openUrl)).toContain("https://x.com/ada/status/9");
    expect(chat.json.openUrl.length).toBeLessThan(6000);
    const codex = await api("/v1/send", {
      method: "POST",
      key: code,
      outbound,
      body: { destination: "codex", url: "https://x.com/ada/status/9", text: "SECRET_POST_TEXT" }
    });
    expect(codex.status).toBe(200);
    expect(codex.json.notice).toBe("Opened Codex");
    expect(codex.json.openUrl).toContain("https://chatgpt.com/codex?prompt=");
    expect(codex.json.openUrl).not.toBe("");
    const history = await api("/v1/history", { key: code });
    expect(history.status).toBe(200);
    expect(history.json.history).toHaveLength(2);
    expect(history.json.history[0].destination).toBe("codex");
    expect(history.text).not.toContain("SECRET_POST_TEXT");
    expect(history.text).not.toContain(key);
    const same = await api("/v1/history", { key });
    expect(same.json.history).toHaveLength(2);
  });

  it("forwards Grok Bot when the bearer is the whole relay code", async () => {
    const key = relayKey();
    const ip = nextIp();
    await saveGrok(key, ip);
    const outbound = mockFetch(200, {});
    const res = await api("/v1/send", {
      method: "POST",
      key: connectCode(key),
      ip,
      outbound,
      body: { destination: "grokbot", url: "https://x.com/a/status/4", text: "hi", author: "a" }
    });
    expect(res.status).toBe(200);
    expect(res.json.notice).toBe("Sent to Grok Bot");
    expect(res.json.label).toBe("Grok Bot");
    expect(res.json.openUrl).toBeUndefined();
    expect(outbound.calls).toHaveLength(1);
    expect(outbound.calls[0].authorization).toBe("Bearer whsec_test_key");
  });
});

describe("history", () => {
  it("lists sends for the site and stays closed to other origins", async () => {
    const key = relayKey();
    const code = connectCode(key);
    const empty = await api("/v1/history", { key: code, headers: { origin: "https://sendtogrokbot.com" } });
    expect(empty.status).toBe(200);
    expect(empty.json.history).toEqual([]);
    expect(empty.headers.get("access-control-allow-origin")).toBe("https://sendtogrokbot.com");
    expect(empty.text).not.toContain("webhook");
    const preflight = await api("/v1/history", {
      method: "OPTIONS",
      headers: { origin: "https://www.sendtogrokbot.com", "access-control-request-method": "GET" }
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("https://www.sendtogrokbot.com");
    expect(preflight.headers.get("access-control-allow-headers")).toMatch(/Authorization/);
    expect(preflight.headers.get("vary")).toBe("Origin");
    const blocked = await api("/v1/history", { key: code, headers: { origin: "https://evil.example" } });
    expect(blocked.status).toBe(200);
    expect(blocked.headers.get("access-control-allow-origin")).toBeNull();
    const sendPreflight = await api("/v1/send", { method: "OPTIONS", headers: { origin: "https://sendtogrokbot.com" } });
    expect(sendPreflight.headers.get("access-control-allow-origin")).toBeNull();
    const bad = await api("/v1/history", { key: "stgbr1.not-a-real-code", headers: { origin: "https://sendtogrokbot.com" } });
    expect(bad.status).toBe(401);
    expect(bad.headers.get("access-control-allow-origin")).toBe("https://sendtogrokbot.com");
    expect(bad.text).not.toContain("rk_");
    const method = await api("/v1/history", { method: "POST", key: code, body: {} });
    expect(method.status).toBe(405);
  });
});

describe("iPhone setup page", () => {
  it("lets sendtogrokbot.com save the Grok Bot webhook and nobody else", async () => {
    const key = relayKey();
    const pre = await api("/v1/config", { method: "OPTIONS", headers: { origin: "https://sendtogrokbot.com" } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-methods")).toContain("PUT");
    const saved = await api("/v1/config", {
      method: "PUT",
      key,
      headers: { origin: "https://sendtogrokbot.com" },
      body: { grokbot: { webhookUrl: "https://hooks.example/hook", senderKey: "whsec_test_key" } }
    });
    expect(saved.status).toBe(200);
    expect(saved.headers.get("access-control-allow-origin")).toBe("https://sendtogrokbot.com");
    const other = await api("/v1/config", {
      method: "PUT",
      key: relayKey(),
      headers: { origin: "https://evil.example" },
      body: { grokbot: { webhookUrl: "https://hooks.example/hook" } }
    });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("limits and errors", () => {
  it("rate limits sends per key", async () => {
    const key = relayKey();
    const ip = nextIp();
    await saveGrok(key, ip);
    const outbound = mockFetch(200, {});
    for (let i = 0; i < LIMITS.send; i++) {
      const res = await api("/v1/send", {
        method: "POST",
        key,
        ip,
        outbound,
        body: { destination: "grokbot", url: "https://x.com/a/status/1", text: "hi", author: "a" }
      });
      expect(res.status).toBe(200);
    }
    const blocked = await api("/v1/send", {
      method: "POST",
      key,
      ip,
      outbound,
      body: { destination: "grokbot", url: "https://x.com/a/status/1", text: "hi", author: "a" }
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  }, 30000);

  it("rate limits new codes per network", async () => {
    const ip = nextIp();
    for (let i = 0; i < LIMITS.create; i++) {
      const res = await api("/v1/config", { method: "PUT", key: relayKey(), ip, body: {} });
      expect(res.status).toBe(200);
    }
    const blocked = await api("/v1/config", { method: "PUT", key: relayKey(), ip, body: {} });
    expect(blocked.status).toBe(429);
  });

  it("does not echo a secret when encryption is not configured", async () => {
    const key = relayKey();
    const bare = { DB: env.DB, KV: env.KV, ENCRYPTION_KEY: "" };
    const res = await worker.fetch(new Request("https://relay.test/v1/config", {
      method: "PUT",
      headers: {
        authorization: "Bearer " + key,
        "content-type": "application/json",
        "cf-connecting-ip": nextIp()
      },
      body: JSON.stringify({ grokbot: { webhookUrl: "https://hooks.example/hook", senderKey: "whsec_test_key" } })
    }), bare);
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).toContain("encryption secret");
    expect(text).not.toContain("whsec_test_key");
  });

  it("rejects the wrong method and a huge body", async () => {
    const key = relayKey();
    const method = await api("/v1/config", { method: "POST", key, body: {} });
    expect(method.status).toBe(405);
    const huge = await api("/v1/send", { method: "POST", key, body: "x".repeat(100001), headers: { "content-type": "application/json" } });
    expect(huge.status).toBe(413);
    expect((await api("/nope")).status).toBe(404);
  });
});
