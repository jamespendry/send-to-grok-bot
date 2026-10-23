// Runs on every sendtogrokbot.com page. It marks the page so the site can say
// "Installed" and move the person to the next step. It sends nothing anywhere.
document.documentElement.dataset.stgbReady = '1';

// A setup page button, <button data-stgb-enable="chatgpt">, adds that AI to the Send
// menu in one click. Only the AIs that open in a tab: none of them needs a secret.
// Claude here means its open-a-tab mode; a saved Claude task is left as it is.
document.addEventListener('click', function (event) {
  const btn = event.target.closest && event.target.closest('[data-stgb-enable]');
  if (!btn) return;
  const dest = btn.getAttribute('data-stgb-enable');
  if (['chatgpt', 'codex', 'claude'].indexOf(dest) === -1) return;
  event.preventDefault();
  chrome.storage.local.get(['enabled', 'webhookUrl', 'senderKey'], function (s) {
    let list = Array.isArray(s.enabled) ? s.enabled.slice() : [];
    // Settings from before the checkboxes: a saved webhook meant Grok Bot was on.
    if (!Array.isArray(s.enabled) && (s.webhookUrl || s.senderKey)) list = ['grokbot'];
    if (list.indexOf(dest) === -1) list.push(dest);
    chrome.storage.local.set({enabled: list}, function () {
      const ok = !chrome.runtime.lastError;
      btn.dataset.stgbState = ok ? 'on' : 'error';
      document.dispatchEvent(new CustomEvent('stgb-enabled', {detail: {dest: dest, ok: ok}}));
    });
  });
});
