// Grok Bot (or any webhook) destination.
self.STGB_DESTINATIONS = self.STGB_DESTINATIONS || {};
self.STGB_DESTINATIONS.grokbot = {
  label: 'Send to Grok Bot',
  toast: 'Sent to Grok Bot',
  async send(post, s) {
    if (!s.webhookUrl) return {ok: false, error: 'Set up first', needsSetup: true};
    const headers = {'Content-Type': 'application/json'};
    if (s.senderKey) { headers['Authorization'] = 'Bearer ' + s.senderKey; headers['X-Sender-Key'] = s.senderKey; }
    const r = await fetch(s.webhookUrl, {method: 'POST', headers, body: JSON.stringify(post)});
    return {ok: r.ok, error: r.ok ? '' : 'HTTP ' + r.status};
  }
};
