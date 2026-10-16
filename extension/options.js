const $ = id => document.getElementById(id);
const FIELDS = {webhookUrl: 'u', senderKey: 'k', claudeFireUrl: 'cu', claudeToken: 'ct', chatgptTriggerId: 'ti', chatgptToken: 'tt', codexEnvironment: 'ce', codexBranch: 'cb'};
const PROMPTS = ['claudePrompt', 'chatgptPrompt', 'codexPrompt'];

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

function saveForm(done) {
  chrome.storage.local.set(formState(), () => done(chrome.runtime.lastError || null));
}

function useCode(raw) {
  const decoded = globalThis.STGB_CONNECT.decodeConnectionCode(raw);
  if (!decoded.ok) {
    if (!$('cc').value.trim()) $('cc').value = String(raw).replace(/^#connect=/i, '');
    connectMessage(decoded.error, false);
    return;
  }
  applyDecoded(decoded);
  $('cc').value = '';
  saveForm(err => connectMessage(err ? 'Could not save. Click Save.' : decoded.message, !err));
}

function fill(local) {
  const enabled = brandSet(local.enabled, local.webhookUrl);
  document.querySelectorAll('input[data-dest]').forEach(el => { el.checked = enabled.has(el.dataset.dest); });
  for (const [key, id] of Object.entries(FIELDS)) $(id).value = local[key] || '';
  document.querySelectorAll('[data-prompt]').forEach(el => { el.value = local[el.dataset.prompt] || ''; });
  show();
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
$('connect').onclick = () => ready.then(() => useCode($('cc').value));
$('s').onclick = () => ready.then(() => {
  saveForm(() => { $('m').textContent = 'Saved'; setTimeout(() => $('m').textContent = '', 2000); });
});

ready.then(() => {
  const hash = location.hash || '';
  if (!/^#connect=/i.test(hash)) return;
  try { history.replaceState(null, '', location.pathname + location.search); }
  catch (_) {}
  useCode(hash);
});
