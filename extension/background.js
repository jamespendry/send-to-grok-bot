importScripts('destinations/grokbot.js', 'destinations/claude.js', 'destinations/chatgpt.js');

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

function enabledDestinations(s) {
  const keys = Array.isArray(s.enabled) ? s.enabled : (s.webhookUrl ? ['grokbot'] : []);
  return keys.filter(k => self.STGB_DESTINATIONS[k]).map(k => self.STGB_DESTINATIONS[k]);
}

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  (async () => {
    const s = await loadSettings();
    const dests = enabledDestinations(s);
    if (!dests.length) {
      chrome.runtime.openOptionsPage();
      reply({ok: false, error: 'Set up first', needsSetup: true});
      return;
    }
    const post = {source: 'x', ...msg, sentAt: new Date().toISOString()};
    const results = await Promise.all(dests.map(async dest => {
      try {
        const r = await dest.send(post, s);
        return {label: dest.label, toast: dest.toast, ...r};
      } catch (e) { return {label: dest.label, ok: false, error: 'Network'}; }
    }));
    if (results.some(r => r.needsSetup)) chrome.runtime.openOptionsPage();
    const ok = results.every(r => r.ok);
    const error = ok ? '' : results.filter(r => !r.ok).map(r => {
      const text = r.error || 'failed';
      return results.length > 1 ? r.label + ': ' + text : text;
    }).join('; ');
    const toast = ok ? (results.length === 1 ? (results[0].toast || 'Sent') : 'Sent') : '';
    reply({ok, error, needsSetup: results.some(r => r.needsSetup), toast});
  })();
  return true;
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
