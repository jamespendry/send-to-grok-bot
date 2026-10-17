// Hosts the service worker may call. None are granted at install.
// The options page requests only the origins for destinations you save.
// https://*/* is listed so a webhook host you type can be requested.
// The code never requests that broad pattern itself.
// https://developer.chrome.com/docs/extensions/reference/api/permissions

function stgbWebhookPattern(url) {
  let parsed;
  try { parsed = new URL(String(url || '').trim()); }
  catch { return ''; }
  if (parsed.protocol !== 'https:' || !parsed.hostname) return '';
  return parsed.origin + '/*';
}

function stgbNeededOrigins(settings) {
  const enabled = new Set(Array.isArray(settings.enabled) ? settings.enabled : []);
  const origins = [];
  const relay = !!(settings.useRelay && String(settings.relayCode || '').trim());
  if (enabled.has('grokbot') && !relay) {
    const pattern = stgbWebhookPattern(settings.webhookUrl || '');
    if (pattern) origins.push(pattern);
  }
  if (!relay && enabled.has('claude') && ((settings.claudeFireUrl || '').trim() || (settings.claudeToken || '').trim())) {
    origins.push('https://api.anthropic.com/*');
  }
  if (enabled.has('chatgpt') && ((settings.chatgptTriggerId || '').trim() || (settings.chatgptToken || '').trim())) {
    origins.push('https://api.chatgpt.com/*');
  }
  if (relay && typeof STGB_RELAY !== 'undefined' && STGB_RELAY.decodeConnectCode) {
    const parsed = STGB_RELAY.decodeConnectCode(settings.relayCode);
    if (parsed.ok) {
      try {
        const url = new URL(parsed.relay);
        if (url.protocol === 'https:') origins.push(url.origin + '/*');
      } catch (_) {}
    }
  }
  return [...new Set(origins)];
}

function stgbBlank(value) {
  return value == null || (typeof value === 'string' && !value.trim());
}

// 1.1.0 kept the webhook in chrome.storage.local, and older installs kept it in sync.
// Copy a saved value into local when local is missing or blank. Never replace a saved value with a blank.
function stgbMigrateSettings(local, sync) {
  const cur = local && typeof local === 'object' ? local : {};
  const old = sync && typeof sync === 'object' ? sync : {};
  const patch = {};
  const keys = ['webhookUrl', 'senderKey', 'claudeFireUrl', 'claudeToken', 'chatgptTriggerId', 'chatgptToken', 'codexEnvironment', 'codexBranch', 'claudePrompt', 'chatgptPrompt', 'codexPrompt', 'relayCode'];
  for (const key of keys) {
    if (stgbBlank(cur[key]) && !stgbBlank(old[key])) patch[key] = old[key];
  }
  if (old.useRelay && !cur.useRelay && !stgbBlank(patch.relayCode || cur.relayCode)) patch.useRelay = true;
  const merged = Object.assign({}, cur, patch);
  if (!Array.isArray(merged.enabled)) {
    if (Array.isArray(old.enabled)) patch.enabled = old.enabled.slice();
    else if (!stgbBlank(merged.webhookUrl) || !stgbBlank(merged.senderKey)) patch.enabled = ['grokbot'];
  }
  const next = Object.assign({}, cur, patch);
  if (!next.promptPreset && stgbBlank(next.promptText)) {
    const legacy = next.claudePrompt || next.chatgptPrompt || next.codexPrompt;
    if (!stgbBlank(legacy)) {
      patch.promptPreset = 'custom';
      patch.promptText = String(legacy).trim();
    }
  }
  const saved = Object.assign({}, cur, patch);
  const removeSync = [];
  for (const key of keys) {
    if (!stgbBlank(old[key]) && !stgbBlank(saved[key])) removeSync.push(key);
  }
  return {patch, removeSync, settings: saved};
}

if (typeof module !== 'undefined') module.exports = {stgbWebhookPattern, stgbNeededOrigins, stgbMigrateSettings, stgbBlank};
