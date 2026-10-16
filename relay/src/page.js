import { clientScript } from "./client.js";

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Send to Grok Bot relay</title>
<style>
  body {
    margin: 0;
    background: #fff;
    color: #0f1419;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.45;
  }
  main { max-width: 640px; margin: 0 auto; padding: 40px 20px 64px; }
  h1 { font-size: 24px; line-height: 1.25; margin: 0 0 8px; font-weight: 700; }
  h2 { font-size: 18px; margin: 28px 0 8px; font-weight: 700; }
  h3 { font-size: 16px; margin: 22px 0 0; font-weight: 700; }
  p, li { margin: 0 0 8px; }
  .muted, .hint { color: #536471; }
  ol { margin: 8px 0 0; padding-left: 1.2em; }
  li { margin: 0 0 8px; }
  section { border-top: 1px solid #eff3f4; margin-top: 8px; }
  label { display: block; font-weight: 600; margin: 14px 0 6px; }
  .hint { font-weight: 400; font-size: 14px; margin: 4px 0 0; }
  input[type="text"], input[type="password"], textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 10px;
    border: 1px solid #cfd9de;
    border-radius: 6px;
    font: inherit;
    color: inherit;
    background: #fff;
  }
  textarea { min-height: 72px; resize: vertical; }
  input:focus, textarea:focus { outline: none; border-color: #1d9bf0; }
  button {
    margin-top: 8px;
    padding: 9px 18px;
    border: 0;
    border-radius: 6px;
    background: #0f1419;
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  button.secondary { background: #fff; color: #0f1419; border: 1px solid #cfd9de; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .check { display: flex; align-items: flex-start; gap: 8px; font-weight: 400; margin-top: 8px; }
  .check input { width: 16px; height: 16px; margin: 3px 0 0; flex: none; }
  #saveMsg, #copyMsg, #loadMsg { color: #00ba7c; }
  .bad { color: #f4212e !important; }
  [hidden] { display: none !important; }
  .history p { margin: 0 0 8px; font-size: 14px; overflow-wrap: anywhere; }
</style>
</head>
<body>
<main>
  <h1>Send to Grok Bot relay</h1>
  <p class="muted">This page stores your destinations. The browser extension keeps one code. Your webhook key and Claude token stay here, encrypted, and are not written to the relay logs.</p>
  <h2>Set up</h2>
  <ol>
    <li>Copy the connect code. This browser just created it. Keep it somewhere private. Anyone with it can send through your destinations. If you lose it, the saved destinations cannot be read back, and you start again.</li>
    <li>Add a Grok Bot webhook, a Claude routine, or both. When you come back, leave a key box blank to keep the saved key. Clear an address and save to remove that destination.</li>
    <li>Click Save destinations. The code does not work until you save.</li>
    <li>In the extension options, check Relay, paste the code, and click Save. ChatGPT and Codex stay on this computer, because those open a tab.</li>
  </ol>
  <section>
    <h2>Connect code</h2>
    <p class="muted">Paste this whole code into the extension. It starts with stgbr1.</p>
    <textarea id="code" readonly spellcheck="false" translate="no"></textarea>
    <div class="row">
      <button type="button" id="copy">Copy code</button>
      <span id="copyMsg"></span>
    </div>
    <label for="key">Relay key</label>
    <p class="hint">A Shortcut uses this key as a Bearer token. The extension wants the whole code, not just the key.</p>
    <input id="key" type="text" readonly spellcheck="false" translate="no" autocomplete="off">
  </section>
  <section>
    <h2>Destinations</h2>
    <p id="status" class="muted"></p>
    <form id="form" autocomplete="off" novalidate>
      <h3>Grok Bot</h3>
      <label for="webhook">Webhook URL</label>
      <input id="webhook" type="text" placeholder="https://..." autocomplete="off" spellcheck="false">
      <label for="webhookKey">Webhook key</label>
      <input id="webhookKey" type="password" placeholder="Sent as a Bearer token" autocomplete="off">
      <p id="webhookHint" class="hint"></p>
      <label class="check" id="clearKeyLabel" hidden><input id="clearKey" type="checkbox"> Remove the saved webhook key</label>
      <h3>Claude routine</h3>
      <label for="fire">Routine URL</label>
      <p class="hint">The claude.ai/code/routines/trig_... page, a trig_ id, or the api.anthropic.com fire URL.</p>
      <input id="fire" type="text" placeholder="trig_... or the fire URL" autocomplete="off" spellcheck="false">
      <label for="token">Routine token</label>
      <input id="token" type="password" placeholder="sk-ant-oat01-..." autocomplete="off">
      <p id="tokenHint" class="hint"></p>
      <label class="check" id="clearTokenLabel" hidden><input id="clearToken" type="checkbox"> Remove the saved routine token</label>
      <div class="row">
        <button type="submit" id="save">Save destinations</button>
        <span id="saveMsg"></span>
      </div>
    </form>
  </section>
  <section>
    <h2>Already have a code?</h2>
    <p class="muted">Paste it here to manage those destinations in this browser. Loading a code does not change it.</p>
    <textarea id="existing" spellcheck="false" translate="no" placeholder="stgbr1...."></textarea>
    <div class="row">
      <button type="button" id="load" class="secondary">Load code</button>
      <span id="loadMsg"></span>
    </div>
    <div class="row">
      <button type="button" id="newCode" class="secondary">Create a new code</button>
    </div>
  </section>
  <section>
    <h2>Recent sends</h2>
    <p class="muted">The last 50. The post text is not stored.</p>
    <div id="history" class="history"></div>
  </section>
</main>
<script src="__SETUP_SRC__"></script>
</body>
</html>`;

export function scriptPath(pathname) {
  const path = pathname || "/";
  if (path === "/api" || path.startsWith("/api/")) return "/api/setup.js";
  return "/setup.js";
}

export function renderPage(pathname) {
  return PAGE.replace("__SETUP_SRC__", scriptPath(pathname));
}

export function setupJavaScript() {
  return clientScript();
}
