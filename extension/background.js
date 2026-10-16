chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  chrome.storage.sync.get(['webhookUrl', 'senderKey'], async ({webhookUrl, senderKey}) => {
    if (!webhookUrl) { chrome.runtime.openOptionsPage(); return reply({ok: false, error: 'Set up first'}); }
    try {
      const headers = {'Content-Type': 'application/json'};
      if (senderKey) { headers['Authorization'] = 'Bearer ' + senderKey; headers['X-Sender-Key'] = senderKey; }
      const r = await fetch(webhookUrl, {method: 'POST', headers, body: JSON.stringify({source: 'x', ...msg, sentAt: new Date().toISOString()})});
      reply({ok: r.ok, error: r.ok ? '' : 'HTTP ' + r.status});
    } catch (e) { reply({ok: false, error: 'Network'}); }
  });
  return true;
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
