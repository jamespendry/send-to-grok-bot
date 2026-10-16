importScripts('destinations/grokbot.js', 'destinations/claude.js', 'destinations/chatgpt.js', 'destinations/codex.js');

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
    // Version 2 object, including media and thumbnails. Every destination receives it.
    const post = {source: 'x', ...msg, version: 2, sentAt: new Date().toISOString()};
    delete post.stgbDestination;
    delete post.stgbAction;
    try { post.digest = digest(post); } catch (_) { post.digest = ''; }
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
