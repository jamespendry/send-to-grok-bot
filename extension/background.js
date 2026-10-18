importScripts('hosts.js', 'enrich.js', 'prompts.js', 'destinations/grokbot.js', 'destinations/claude.js', 'destinations/chatgpt.js', 'destinations/codex.js', 'relay.js');

// Plain-text rendering of the payload, for receivers that forward a single text field to an AI.
// enrich.js builds it: the page's fields as before, or the labelled full context when a mirror answered.
function digest(p) {
  return self.STGB_ENRICH.digest(p);
}

// Mirror lookups for the full post, its reply chain, and its quote. One per URL, reused for a minute,
// so the menu path can start it on the first click and the chosen row only waits for what is left.
const ENRICH_HARD_MS = 2700;
const enrichCache = new Map();
function enrichFor(url) {
  const E = self.STGB_ENRICH;
  if (!E || !E.parseStatusUrl(url)) return Promise.resolve(null);
  const now = Date.now();
  for (const [k, v] of enrichCache) if (now - v.at > 60000) enrichCache.delete(k);
  const hit = enrichCache.get(url);
  if (hit) return hit.promise;
  // A miss is not kept, so the next click tries the mirrors again.
  const promise = E.fetchContext(url, {budgetMs: E.BUDGET_MS}).catch(() => null).then(ctx => {
    if (!ctx) enrichCache.delete(url);
    return ctx;
  });
  enrichCache.set(url, {at: now, promise});
  return promise;
}
// Never longer than the budget, and never a reason not to send.
async function enrichPost(post) {
  let timer;
  try {
    const ctx = await Promise.race([
      enrichFor(post.url),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), ENRICH_HARD_MS); })
    ]);
    return self.STGB_ENRICH.mergePost(post, ctx);
  } catch (_) {
    try { return self.STGB_ENRICH.mergePost(post, null); } catch (_) { return post; }
  } finally {
    clearTimeout(timer);
  }
}

function getStore(area, keys) {
  return new Promise(resolve => chrome.storage[area].get(keys, resolve));
}
function setStore(area, obj) {
  return new Promise(resolve => chrome.storage[area].set(obj, resolve));
}
function removeStore(area, keys) {
  return new Promise(resolve => chrome.storage[area].remove(keys, resolve));
}

// Tokens and keys live in local storage. 1.1.0 used the same local keys.
// Older installs kept the webhook in sync. An update copies those across and does not blank a saved webhook.
async function loadSettings() {
  const local = await getStore('local', null) || {};
  let sync = {};
  try { sync = await getStore('sync', null) || {}; }
  catch (_) { sync = {}; }
  const migrated = stgbMigrateSettings(local, sync);
  if (migrated.patch && Object.keys(migrated.patch).length) await setStore('local', migrated.patch);
  if (migrated.removeSync && migrated.removeSync.length) await removeStore('sync', migrated.removeSync);
  return migrated.settings;
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

// A saved preset wins. Older installs stored a prompt on one destination; keep that until they pick a preset.
function chosenPrompt(s, brand) {
  s = s || {};
  const prompts = self.STGB_PROMPTS;
  if (!prompts) return {id: 'general', text: ''};
  if (s && (s.promptPreset || String(s.promptText || '').trim())) return prompts.resolve(s);
  const legacy = brand === 'claude' ? s.claudePrompt : brand === 'chatgpt' ? s.chatgptPrompt : brand === 'codex' ? s.codexPrompt : '';
  if (legacy && String(legacy).trim()) return {id: 'custom', text: String(legacy).trim()};
  return prompts.resolve(s);
}

function relayOn(s) {
  return !!(s && s.useRelay && String(s.relayCode || '').trim());
}

function grokReady(s) {
  return relayOn(s) || !!(s && String(s.webhookUrl || '').trim());
}

const SETUP_NOTICE = {
  none: 'Check a destination, then click Save. ChatGPT and Codex need no webhook. The button on X stays on each post either way.',
  grokbot: 'Grok Bot is checked, but the webhook is empty. Paste the webhook URL and the Authorization header together. The button on X stays on each post either way.'
};

function menuItems(s) {
  const on = enabledBrands(s);
  const items = [];
  if (on.has('grokbot')) items.push({brand: 'grokbot', label: 'Send to Grok Bot', needsSetup: !grokReady(s)});
  if (on.has('claude')) items.push({brand: 'claude', label: 'Send to Claude', needsSetup: false});
  if (on.has('chatgpt')) items.push({brand: 'chatgpt', label: 'Send to ChatGPT', needsSetup: false});
  if (on.has('codex')) items.push({brand: 'codex', label: 'Send to Codex', needsSetup: false});
  return items;
}

async function showSetup(message) {
  try { await chrome.storage.session.set({setupNotice: message}); }
  catch (_) {}
  try { chrome.runtime.openOptionsPage(); }
  catch (_) {}
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

async function deliver(brand, msg, s) {
  const name = BRAND_NAME[brand];
  const items = menuItems(s);
  const item = items.find(row => row.brand === brand);
  if (!item) {
    await showSetup(SETUP_NOTICE.none);
    return {ok: false, error: SETUP_NOTICE.none, needsSetup: true, brand, title: 'Choose a destination'};
  }
  if (item.needsSetup) {
    await showSetup(SETUP_NOTICE.grokbot);
    return {ok: false, error: SETUP_NOTICE.grokbot, needsSetup: true, brand, title: 'Set up Grok Bot'};
  }
  if (alreadySent(msg.url, brand)) return {ok: true, duplicate: true, brand};
  const viaRelay = relayOn(s) && (brand === 'grokbot' || brand === 'claude');
  const dest = viaRelay ? self.STGB_RELAY : pickDest(brand, s);
  if (!dest) {
    await showSetup(SETUP_NOTICE.grokbot);
    return {ok: false, error: SETUP_NOTICE.grokbot, needsSetup: true, brand, title: 'Set up ' + name};
  }
  // Version 2 object, including media and thumbnails. Every destination receives it.
  let post = {source: 'x', ...msg, version: 2, sentAt: new Date().toISOString()};
  delete post.stgbDestination;
  delete post.stgbAction;
  post = await enrichPost(post);
  try { post.digest = digest(post); } catch (_) { post.digest = ''; }
  const chosen = chosenPrompt(s, brand);
  post.preset = chosen.id;
  post.prompt = String(chosen.text || '').slice(0, 8000);
  try {
    const r = viaRelay ? await dest.send(post, s, brand) : await dest.send(post, s);
    if (r.needsSetup) await showSetup(r.error || SETUP_NOTICE.grokbot);
    const ok = !!r.ok;
    return {ok, error: ok ? '' : (r.error || 'failed'), needsSetup: !!r.needsSetup, brand, title: (ok ? 'Sent to ' : "Couldn't send to ") + name};
  } catch (e) {
    return {ok: false, error: brand === 'grokbot' ? 'The webhook did not answer.' : 'Network', brand, title: "Couldn't send to " + name};
  }
}

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (!msg || typeof msg !== 'object') { reply({ok: false, error: 'Bad message'}); return; }
  if (msg.stgbAction === 'request-origins') {
    const origins = Array.isArray(msg.origins) ? msg.origins.filter(origin => typeof origin === 'string' && origin.startsWith('https://')) : [];
    if (!origins.length) { reply({ok: true}); return; }
    // Called in this turn, before any await, so a content-script paste can still be the gesture.
    chrome.permissions.request({origins: origins}, granted => {
      const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
      reply({ok: !!granted && !err, error: err || ''});
    });
    return true;
  }
  if (msg.stgbAction === 'list') {
    (async () => {
      const s = await loadSettings();
      const items = menuItems(s);
      if (!items.length) {
        await showSetup(SETUP_NOTICE.none);
        reply({ok: true, items, message: SETUP_NOTICE.none});
        return;
      }
      reply({ok: true, items});
    })();
    return true;
  }
  // One click. A single ready destination is sent in this turn. Two or more come back as a menu.
  if (msg.stgbAction === 'send') {
    (async () => {
      const s = await loadSettings();
      const items = menuItems(s);
      if (!items.length) {
        await showSetup(SETUP_NOTICE.none);
        reply({ok: false, error: SETUP_NOTICE.none, needsSetup: true, brand: 'grokbot', title: 'Choose a destination'});
        return;
      }
      if (items.length !== 1) {
        enrichFor(msg.url);
        reply({ok: true, items});
        return;
      }
      reply(await deliver(items[0].brand, msg, s));
    })();
    return true;
  }
  const brand = msg.stgbDestination;
  if (!brand || !BRAND_NAME[brand]) {
    showSetup(SETUP_NOTICE.none);
    reply({ok: false, error: SETUP_NOTICE.none, needsSetup: true});
    return;
  }
  (async () => {
    reply(await deliver(brand, msg, await loadSettings()));
  })();
  return true;
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.runtime.onInstalled.addListener(details => {
  if (!details || (details.reason !== 'update' && details.reason !== 'install')) return;
  loadSettings().catch(() => {});
});
