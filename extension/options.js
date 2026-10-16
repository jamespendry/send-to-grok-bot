const $ = id => document.getElementById(id);
const FIELDS = {webhookUrl: 'u', senderKey: 'k', claudeFireUrl: 'cu', claudeToken: 'ct', chatgptTriggerId: 'ti', chatgptToken: 'tt', codexEnvironment: 'ce', codexBranch: 'cb'};
const PROMPTS = ['claudePrompt', 'chatgptPrompt', 'codexPrompt'];
const CONTENT_HOSTS = new Set(['x.com', 'twitter.com']);

function hostOf(pattern) {
  try { return new URL(String(pattern).replace(/\*$/, 'x')).host; }
  catch { return ''; }
}

function brandSet(enabled, webhookUrl) {
  const keys = Array.isArray(enabled) ? enabled : (webhookUrl ? ['grokbot'] : []);
  const set = new Set();
  for (const k of keys) {
    if (k === 'claude' || k === 'claude_routine' || k === 'claude_link') set.add('claude');
    else if (k === 'chatgpt' || k === 'chatgpt_link' || k === 'chatgpt_workspace_agent') set.add('chatgpt');
    else set.add(k);
  }
  return set;
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

function show() {
  document.querySelectorAll('.fields').forEach(el => {
    el.hidden = !document.querySelector(`input[data-dest="${el.dataset.for}"]`).checked;
  });
}

function formState() {
  const o = {enabled: [...document.querySelectorAll('input[data-dest]:checked')].map(el => el.dataset.dest)};
  for (const [key, id] of Object.entries(FIELDS)) o[key] = $(id).value.trim();
  for (const key of PROMPTS) {
    const el = document.querySelector(`[data-prompt="${key}"]`);
    o[key] = el ? el.value.trim() : '';
  }
  return o;
}

function connectMessage(text, ok) {
  const el = $('cm');
  el.textContent = text || '';
  el.className = text ? (ok ? 'ok' : 'err') : '';
}

function applyDecoded(decoded) {
  const box = document.querySelector(`input[data-dest="${decoded.destination}"]`);
  if (box) box.checked = true;
  for (const [key, value] of Object.entries(decoded.fields)) {
    if (FIELDS[key]) $(FIELDS[key]).value = value;
    const prompt = document.querySelector(`[data-prompt="${key}"]`);
    if (prompt) prompt.value = value;
  }
  show();
}

function persist(o, done) {
  const problem = settingsProblem(o);
  if (problem) { done(problem); return; }
  const origins = stgbNeededOrigins(o);
  const write = () => {
    chrome.storage.local.set(o, () => {
      dropUnusedOrigins(stgbNeededOrigins(o));
      done(chrome.runtime.lastError || null);
    });
  };
  // permissions.request has to run in the click that started this, before any await.
  if (!origins.length) { write(); return; }
  chrome.permissions.request({origins}, granted => {
    if (!granted) { done('Click Save and choose Allow to send there'); return; }
    write();
  });
}

function useCode(raw, fromClick) {
  const decoded = globalThis.STGB_CONNECT.decodeConnectionCode(raw);
  if (!decoded.ok) {
    if (!$('cc').value.trim()) $('cc').value = String(raw).replace(/^#connect=/i, '');
    connectMessage(decoded.error, false);
    return;
  }
  applyDecoded(decoded);
  $('cc').value = '';
  const o = formState();
  if (!fromClick) {
    chrome.storage.local.set(o, () => {
      const needsAllow = stgbNeededOrigins(o).length > 0;
      connectMessage(needsAllow ? decoded.message + ' Click Save and choose Allow.' : decoded.message, true);
    });
    return;
  }
  persist(o, err => connectMessage(err ? (typeof err === 'string' ? err : 'Could not save. Click Save.') : decoded.message, !err));
}

function fill(local) {
  const enabled = brandSet(local.enabled, local.webhookUrl);
  document.querySelectorAll('input[data-dest]').forEach(el => { el.checked = enabled.has(el.dataset.dest); });
  for (const [key, id] of Object.entries(FIELDS)) $(id).value = local[key] || '';
  document.querySelectorAll('[data-prompt]').forEach(el => { el.value = local[el.dataset.prompt] || ''; });
  show();
}

function settingsProblem(o) {
  if (!o.enabled.includes('grokbot') || !o.webhookUrl) return '';
  if (!stgbWebhookPattern(o.webhookUrl)) return 'Webhook URL must be a valid https link';
  return '';
}

function say(text, bad) {
  $('m').textContent = text;
  $('m').classList.toggle('bad', !!bad);
  clearTimeout(say.t);
  if (!bad && text) say.t = setTimeout(() => { $('m').textContent = ''; $('m').classList.remove('bad'); }, 2000);
}

function dropUnusedOrigins(keep) {
  const needed = new Set(keep.map(hostOf));
  chrome.permissions.getAll(all => {
    const extra = (all.origins || []).filter(origin => {
      const host = hostOf(origin);
      return host && !needed.has(host) && !CONTENT_HOSTS.has(host);
    });
    if (!extra.length) return;
    chrome.permissions.remove({origins: extra}, () => { void chrome.runtime.lastError; });
  });
}

async function load() {
  let local = await getStore('local', null);
  const sync = await getStore('sync', ['webhookUrl', 'senderKey']);
  if ((sync.webhookUrl || sync.senderKey) && local.webhookUrl == null && local.senderKey == null) {
    const patch = {webhookUrl: sync.webhookUrl || '', senderKey: sync.senderKey || ''};
    if (!Array.isArray(local.enabled)) patch.enabled = ['grokbot'];
    await setStore('local', patch);
    await removeStore('sync', ['webhookUrl', 'senderKey']);
    local = {...local, ...patch};
  }
  fill(local);
}

document.querySelectorAll('input[data-dest]').forEach(el => el.addEventListener('change', show));
$('cc').addEventListener('input', () => connectMessage('', true));
const ready = load();
$('connect').onclick = () => ready.then(() => useCode($('cc').value, true));
$('s').onclick = () => ready.then(() => {
  persist(formState(), err => {
    if (err) say(typeof err === 'string' ? err : 'Could not save', true);
    else say('Saved', false);
  });
});

ready.then(() => {
  const hash = location.hash || '';
  if (!/^#connect=/i.test(hash)) return;
  try { history.replaceState(null, '', location.pathname + location.search); }
  catch (_) {}
  useCode(hash, false);
});
