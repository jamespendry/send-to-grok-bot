importScripts('hosts.js', 'prompts.js', 'destinations/grokbot.js', 'destinations/claude.js', 'destinations/chatgpt.js', 'destinations/codex.js', 'relay.js');

function mediaLine(m) {
  if (!m || typeof m !== 'object') return '';
  const label = m.type === 'gif' ? 'GIF' : m.type === 'video' ? 'Video' : 'Image';
  const head = m.duration ? `${label} (${m.duration}s)` : label;
  if (m.type === 'image') {
    const body = [m.alt, m.url].filter(Boolean).join(' ');
    return '- ' + (body ? `${head}: ${body}` : head);
  }
  const parts = [head];
  if (m.alt) parts.push(m.alt);
  if (m.captions) parts.push('captions: ' + m.captions);
  if (m.thumbnail) parts.push('thumbnail: ' + m.thumbnail);
  return '- ' + parts.join(' ');
}
function normUrl(u) {
  return String(u || '').split('?')[0].replace(/\/$/, '');
}
// Plain-text rendering of the payload, for receivers that forward a single text field to an AI.
function digest(p) {
  const L = [`X post by @${p.author}${p.authorName ? ` (${p.authorName})` : ''}`, `URL: ${p.url}`];
  if (p.postedAt) L.push(`Posted: ${p.postedAt}`);
  if (p.metrics) L.push(`Engagement: ${p.metrics}`);
  if (p.inReplyTo) L.push('', `In reply to @${p.inReplyTo.author} (${p.inReplyTo.url}):`, p.inReplyTo.text);
  const thread = Array.isArray(p.thread) ? p.thread : [];
  const url = normUrl(p.url);
  const threadHasClicked = url
    ? thread.some(t => normUrl(t && t.url) === url)
    : !!(p.text && thread.some(t => t && t.text === p.text));
  if (thread.length > 1) {
    L.push('', `Thread (${thread.length} posts by the author):`);
    thread.forEach((t, i) => L.push(`[${i + 1}/${thread.length}] ${t.url}`, t.text));
    if (!threadHasClicked) L.push('', 'Text:', p.text || '(no text)');
  } else L.push('', 'Text:', p.text || '(no text)');
  if (p.truncated) L.push('(Post text was cut off by "Show more" in the timeline; the full text may be longer.)');
  if (p.quoted) L.push('', `Quoting @${p.quoted.author}${p.quoted.postedAt ? ` (${p.quoted.postedAt})` : ''}:`, p.quoted.text);
  const links = [...(p.links || []), ...((p.quoted && p.quoted.links) || [])];
  if (links.length) L.push('', 'Links:', ...links.map(l => `- ${l.url || l.text} (${l.href})`));
  if (p.card) L.push('', `Link card: ${p.card.text} (${p.card.href})`);
  if (p.media && p.media.length) {
    const lines = p.media.map(mediaLine).filter(Boolean);
    if (lines.length) L.push('', 'Media:', ...lines);
  }
  return L.join('\n');
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
  const brand = msg.stgbDestination;
  if (!brand || !BRAND_NAME[brand]) {
    showSetup(SETUP_NOTICE.none);
    reply({ok: false, error: SETUP_NOTICE.none, needsSetup: true});
    return;
  }
  (async () => {
    const s = await loadSettings();
    const name = BRAND_NAME[brand];
    const items = menuItems(s);
    const item = items.find(row => row.brand === brand);
    if (!item) {
      await showSetup(SETUP_NOTICE.none);
      reply({ok: false, error: SETUP_NOTICE.none, needsSetup: true, brand, title: 'Choose a destination'});
      return;
    }
    if (item.needsSetup) {
      await showSetup(SETUP_NOTICE.grokbot);
      reply({ok: false, error: SETUP_NOTICE.grokbot, needsSetup: true, brand, title: 'Set up Grok Bot'});
      return;
    }
    if (alreadySent(msg.url, brand)) { reply({ok: true, duplicate: true}); return; }
    const viaRelay = relayOn(s) && (brand === 'grokbot' || brand === 'claude');
    const dest = viaRelay ? self.STGB_RELAY : pickDest(brand, s);
    if (!dest) {
      await showSetup(SETUP_NOTICE.grokbot);
      reply({ok: false, error: SETUP_NOTICE.grokbot, needsSetup: true, brand, title: 'Set up ' + name});
      return;
    }
    // Version 2 object, including media and thumbnails. Every destination receives it.
    const post = {source: 'x', ...msg, version: 2, sentAt: new Date().toISOString()};
    delete post.stgbDestination;
    delete post.stgbAction;
    try { post.digest = digest(post); } catch (_) { post.digest = ''; }
    const chosen = chosenPrompt(s, brand);
    post.preset = chosen.id;
    post.prompt = String(chosen.text || '').slice(0, 8000);
    try {
      const r = viaRelay ? await dest.send(post, s, brand) : await dest.send(post, s);
      if (r.needsSetup) await showSetup(r.error || SETUP_NOTICE.grokbot);
      const ok = !!r.ok;
      reply({ok, error: ok ? '' : (r.error || 'failed'), needsSetup: !!r.needsSetup, brand, title: (ok ? 'Sent to ' : "Couldn't send to ") + name});
    } catch (e) {
      reply({ok: false, error: brand === 'grokbot' ? 'The webhook did not answer.' : 'Network', brand, title: "Couldn't send to " + name});
    }
  })();
  return true;
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.runtime.onInstalled.addListener(details => {
  if (!details || (details.reason !== 'update' && details.reason !== 'install')) return;
  loadSettings().catch(() => {});
});
