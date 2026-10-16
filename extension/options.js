const $ = id => document.getElementById(id);
const FIELDS = {webhookUrl: 'u', senderKey: 'k', claudeFireUrl: 'cu', claudeToken: 'ct', chatgptTriggerId: 'ti', chatgptToken: 'tt'};

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

function fill(local) {
  const enabled = new Set(Array.isArray(local.enabled) ? local.enabled : (local.webhookUrl ? ['grokbot'] : []));
  document.querySelectorAll('input[data-dest]').forEach(el => { el.checked = enabled.has(el.dataset.dest); });
  for (const [key, id] of Object.entries(FIELDS)) $(id).value = local[key] || '';
  document.querySelectorAll('[data-sync]').forEach(el => { el.value = local[el.dataset.sync] || ''; });
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
document.querySelectorAll('[data-sync]').forEach(el => el.addEventListener('input', () => {
  document.querySelectorAll(`[data-sync="${el.dataset.sync}"]`).forEach(other => { if (other !== el) other.value = el.value; });
}));
$('s').onclick = () => {
  const o = {enabled: [...document.querySelectorAll('input[data-dest]:checked')].map(el => el.dataset.dest)};
  for (const [key, id] of Object.entries(FIELDS)) o[key] = $(id).value.trim();
  for (const key of ['claudePrompt', 'chatgptPrompt']) {
    const el = document.querySelector(`[data-sync="${key}"]`);
    o[key] = el ? el.value.trim() : '';
  }
  chrome.storage.local.set(o, () => { $('m').textContent = 'Saved'; setTimeout(() => $('m').textContent = '', 2000); });
};
load();
