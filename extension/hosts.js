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
  if (enabled.has('grokbot')) {
    const pattern = stgbWebhookPattern(settings.webhookUrl || '');
    if (pattern) origins.push(pattern);
  }
  if (enabled.has('claude') && ((settings.claudeFireUrl || '').trim() || (settings.claudeToken || '').trim())) {
    origins.push('https://api.anthropic.com/*');
  }
  if (enabled.has('chatgpt') && ((settings.chatgptTriggerId || '').trim() || (settings.chatgptToken || '').trim())) {
    origins.push('https://api.chatgpt.com/*');
  }
  return [...new Set(origins)];
}

if (typeof module !== 'undefined') module.exports = {stgbWebhookPattern, stgbNeededOrigins};
