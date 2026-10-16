importScripts('destinations/grokbot.js', 'destinations/claude.js', 'destinations/chatgpt.js', 'destinations/codex.js');

function getStore(area, keys) {
  return new Promise(resolve => chrome.storage[area].get(keys, resolve));
}
function setStore(area, obj) {
  return new Promise(resolve => chrome.storage[area].set(obj, resolve));
}
function removeStore(area, keys) {
  return new Promise(resolve => chrome.storage[area].remove(keys, resolve));
}

// Tokens and keys live in local storage. Older installs kept the webhook in sync.
async function loadSettings() {
  const local = await getStore('local', null);
  const sync = await getStore('sync', ['webhookUrl', 'senderKey']);
  if ((sync.webhookUrl || sync.senderKey) && local.webhookUrl == null && local.senderKey == null) {
    const patch = {webhookUrl: sync.webhookUrl || '', senderKey: sync.senderKey || ''};
    if (!Array.isArray(local.enabled)) patch.enabled = ['grokbot'];
    await setStore('local', patch);
    await removeStore('sync', ['webhookUrl', 'senderKey']);
    Object.assign(local, patch);
  }
  return local;
}

const BRAND_NAME = {grokbot: 'Grok Bot', claude: 'Claude', chatgpt: 'ChatGPT', codex: 'Codex'};

function enabledBrands(s) {
  const keys = Array.isArray(s.enabled) ? s.enabled : (s.webhookUrl ? ['grokbot'] : []);
  const set = new Set();
  for (const k of keys) {
    if (k === 'claude' || k === 'claude_routine' || k === 'claude_link') set.add('claude');
    else if (k === 'chatgpt' || k === 'chatgpt_link' || k === 'chatgpt_workspace_agent') set.add('chatgpt');
    else set.add(k);
  }
  return set;
}

function menuItems(s) {
  const on = enabledBrands(s);
  const items = [];
  if (on.has('grokbot') && (s.webhookUrl || '').trim()) items.push({brand: 'grokbot', label: 'Send to Grok Bot'});
  if (on.has('claude')) items.push({brand: 'claude', label: 'Send to Claude'});
  if (on.has('chatgpt')) items.push({brand: 'chatgpt', label: 'Send to ChatGPT'});
  if (on.has('codex')) items.push({brand: 'codex', label: 'Send to Codex'});
  return items;
}

// One menu row maps to a single sender. Routine/agent wins when its fields are filled.
function pickDest(brand, s) {
  const D = self.STGB_DESTINATIONS;
  if (brand === 'grokbot') return D.grokbot;
  if (brand === 'claude') return ((s.claudeFireUrl || '').trim() || (s.claudeToken || '').trim()) ? D.claude_routine : D.claude_link;
  if (brand === 'chatgpt') return ((s.chatgptTriggerId || '').trim() || (s.chatgptToken || '').trim()) ? D.chatgpt_workspace_agent : D.chatgpt_link;
  if (brand === 'codex') return D.codex;
  return null;
}

// Same post + brand inside 5s is one send. Claimed synchronously, before any await,
// so two messages that arrive together cannot both pass.
const recentSends = new Map();
function alreadySent(url, brand) {
  const now = Date.now();
  const key = (url || '') + '\n' + brand;
  for (const [k, t] of recentSends) if (now - t >= 5000) recentSends.delete(k);
  const t = recentSends.get(key);
  if (t != null && now - t < 5000) return true;
  recentSends.set(key, now);
  return false;
}

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (!msg || typeof msg !== 'object') { reply({ok: false, error: 'Bad message'}); return; }
  if (msg.stgbAction === 'list') {
    (async () => {
      const s = await loadSettings();
      const items = menuItems(s);
      if (!items.length) chrome.runtime.openOptionsPage();
      reply({ok: true, items});
    })();
    return true;
  }
  const brand = msg.stgbDestination;
  if (!brand || !BRAND_NAME[brand]) {
    chrome.runtime.openOptionsPage();
    reply({ok: false, error: 'Set up first', needsSetup: true});
    return;
  }
  if (alreadySent(msg.url, brand)) { reply({ok: true, duplicate: true}); return; }
  (async () => {
    const s = await loadSettings();
    const name = BRAND_NAME[brand];
    const allowed = menuItems(s).some(item => item.brand === brand);
    const dest = allowed && pickDest(brand, s);
    if (!dest) {
      chrome.runtime.openOptionsPage();
      reply({ok: false, error: 'Set up first', needsSetup: true, brand, title: "Couldn't send to " + name});
      return;
    }
    // Flat post object. Extra fields on the message are kept for callers that add them.
    const post = {source: 'x', ...msg, sentAt: new Date().toISOString()};
    delete post.stgbDestination;
    delete post.stgbAction;
    try {
      const r = await dest.send(post, s);
      if (r.needsSetup) chrome.runtime.openOptionsPage();
      const ok = !!r.ok;
      reply({ok, error: ok ? '' : (r.error || 'failed'), needsSetup: !!r.needsSetup, brand, title: (ok ? 'Sent to ' : "Couldn't send to ") + name});
    } catch (e) {
      reply({ok: false, error: 'Network', brand, title: "Couldn't send to " + name});
    }
  })();
  return true;
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
