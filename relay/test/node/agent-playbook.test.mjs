import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const { CLAUDE_TASK } = require(join(repo, "extension/prompts.js"));
const { decodeConnectionCode } = require(join(repo, "extension/connect.js"));

const EXPECTED_SCRIPT = "(async () => {\n  const sleep = ms => new Promise(r => setTimeout(r, ms));\n  let token = '';\n  for (let i = 0; i < 40 && !token; i++) { const m = document.body.innerText.match(/sk-ant-[A-Za-z0-9_-]{20,}/); if (m) token = m[0]; else await sleep(250); }\n  if (!token) return 'No API token on screen. Check that Trigger was API, then click Create again.';\n  const done = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Done');\n  if (done) done.click();\n  let trig = '';\n  for (let i = 0; i < 40 && !trig; i++) { const m = location.pathname.match(/trig_[A-Za-z0-9]+/); if (m) trig = m[0]; else await sleep(250); }\n  if (!trig) return 'Token kept in this page only. The task page did not open; ask the person to click Done, then run this again.';\n  const json = JSON.stringify({destination: 'claude', mode: 'routine', url: 'https://api.anthropic.com/v1/claude_code/routines/' + trig + '/fire', token: token});\n  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');\n  setTimeout(() => { location.href = 'https://sendtogrokbot.com/connect#stgb1.' + b64; }, 1500);\n  return 'ok: opening the connect page';\n})()";

const agents = readFileSync(join(repo, "AGENTS.md"), "utf8");

function claudeSection() {
  const start = agents.indexOf("## Claude Code\n");
  const end = agents.indexOf("\n## ChatGPT\n", start);
  assert.ok(start >= 0 && end > start, "AGENTS.md has a Claude Code section before ChatGPT");
  return agents.slice(start, end);
}

function tokenScript() {
  const m = claudeSection().match(/```js\n([\s\S]*?)\n```/);
  assert.ok(m, "the Claude Code section has a js block");
  return m[1];
}

test("the playbook quotes the Claude task prompt exactly", () => {
  assert.ok(claudeSection().includes("```text\n" + CLAUDE_TASK + "\n```"));
});

test("the playbook says never to look while the token dialog is open", () => {
  const s = claudeSection();
  assert.match(s, /Do not take a screenshot/);
  assert.match(s, /never enter your context or the transcript/);
  assert.match(s, /Never ask for the API token in chat/);
  assert.match(s, /sendtogrokbot\.com\/setup\/claude/);
});

test("the playbook contains the token script exactly", () => {
  assert.equal(tokenScript(), EXPECTED_SCRIPT);
  assert.ok(claudeSection().includes("```js\n" + EXPECTED_SCRIPT + "\n```"));
});

test("the token script compiles", () => {
  assert.doesNotThrow(() => new Function("return " + tokenScript()));
});

async function runScript({ text, path, buttons = [] }) {
  const loc = { pathname: "/code/routines", href: "https://claude.ai/code/routines" };
  const clicked = [];
  const timers = [];
  const doc = {
    body: { get innerText() { return text; } },
    querySelectorAll: () => buttons.map((label) => ({
      textContent: label,
      click() { clicked.push(label); loc.pathname = path; }
    }))
  };
  const fakeTimeout = (fn, ms) => { if (ms >= 1000) timers.push(fn); else fn(); return 0; };
  const run = new Function("document", "location", "setTimeout", "TextEncoder", "btoa", "return " + tokenScript());
  const result = await run(doc, loc, fakeTimeout, TextEncoder, btoa);
  timers.forEach((fn) => fn());
  return { result, href: loc.href, clicked };
}

test("the token script builds a code the extension accepts and never returns the token", async () => {
  const token = "sk-ant-oat01-" + "Fake_Token-value".repeat(4);
  const trig = "trig_01AbCdEfGhIjKlMnOp";
  const out = await runScript({
    text: "API token\n" + token + "\nCopy\nDone",
    path: "/code/routines/" + trig,
    buttons: ["Copy", "Done"]
  });
  assert.equal(out.result, "ok: opening the connect page");
  assert.ok(!out.result.includes(token));
  assert.ok(!out.result.includes("sk-ant-"));
  assert.deepEqual(out.clicked, ["Done"]);
  assert.ok(out.href.startsWith("https://sendtogrokbot.com/connect#stgb1."));
  const code = out.href.slice(out.href.indexOf("#") + 1);
  assert.match(code, /^stgb1\.[A-Za-z0-9_-]+$/);
  const decoded = decodeConnectionCode(code);
  assert.equal(decoded.ok, true, decoded.error);
  const json = JSON.parse(Buffer.from(code.slice(6), "base64url").toString("utf8"));
  assert.deepEqual(json, {
    destination: "claude",
    mode: "routine",
    url: "https://api.anthropic.com/v1/claude_code/routines/" + trig + "/fire",
    token
  });
});

test("the token script returns a status line, not the token, when the task page does not open", async () => {
  const token = "sk-ant-oat01-" + "x".repeat(40);
  const out = await runScript({ text: token, path: "/code/routines", buttons: [] });
  assert.match(out.result, /^Token kept in this page only/);
  assert.ok(!out.result.includes("sk-ant-"));
  assert.equal(out.href, "https://claude.ai/code/routines");
});

test("the token script says what to do when no token is on screen", async () => {
  const out = await runScript({ text: "New task", path: "/code/routines" });
  assert.match(out.result, /^No API token on screen/);
});
