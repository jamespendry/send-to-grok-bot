// Grok Bot (or any webhook) destination.

// The same plain answers the relay gives the iPhone Shortcut.
function grokError(status) {
  if (status === 401 || status === 403) return "Grok Bot didn't accept the key. The routine may have been deleted or changed. Set it up again at sendtogrokbot.com/setup/grok.";
  if (status === 404 || status === 410) return "Grok Bot can't find the routine. It may have been deleted. Set it up again at sendtogrokbot.com/setup/grok.";
  if (status === 429) return 'Grok Bot is busy. Wait a minute, then send again.';
  if (status >= 500) return 'Grok Bot had a problem on its side. Send again in a moment.';
  return 'Grok Bot turned the post away (error ' + status + '). If it keeps happening, set it up again at sendtogrokbot.com/setup/grok.';
}
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
    const body = JSON.stringify(post);
    const postOnce = () => fetch(s.webhookUrl, {method: 'POST', headers, body});
    let r;
    try { r = await postOnce(); }
    catch (_) { r = await postOnce(); }
    if (r.ok) return {ok: true, error: ''};
    return {ok: false, error: grokError(r.status)};
  }
};
