// Grok Bot (or any webhook) destination.
self.STGB_DESTINATIONS = self.STGB_DESTINATIONS || {};
self.STGB_DESTINATIONS.grokbot = {
  label: 'Send to Grok Bot',
  toast: 'Sent to Grok Bot',
  async send(post, s) {
    if (!s.webhookUrl) return {ok: false, error: 'Set up first', needsSetup: true};
    const pattern = stgbWebhookPattern(s.webhookUrl);
    if (!pattern) return {ok: false, error: 'Webhook must be https', needsSetup: true};
    if (!(await chrome.permissions.contains({origins: [pattern]}))) {
      return {ok: false, error: 'Allow this site in settings', needsSetup: true};
    }
    const headers = {'Content-Type': 'application/json'};
    if (s.senderKey) { headers['Authorization'] = 'Bearer ' + s.senderKey; headers['X-Sender-Key'] = s.senderKey; }
    const r = await fetch(s.webhookUrl, {method: 'POST', headers, body: JSON.stringify(post)});
    if (r.ok) return {ok: true, error: ''};
    if (r.status === 401 || r.status === 403) return {ok: false, error: 'The webhook refused the key. Copy the Authorization header again.'};
    return {ok: false, error: 'The webhook did not accept the post.'};
  }
};
