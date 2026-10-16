// Runs on sendtogrokbot.com/connect. One click writes the pasted link into this browser.
// The page itself never receives the saved settings back.
(function () {
  'use strict';
  document.documentElement.dataset.stgbReady = '1';

  function report(text, ok) {
    const el = document.getElementById('msg');
    if (el) {
      el.textContent = text || '';
      el.className = text ? (ok ? 'ok' : 'err') : '';
    }
    document.dispatchEvent(new CustomEvent('stgb-connect-result', {detail: {ok: !!ok, message: text || ''}}));
  }

  document.addEventListener('click', function (event) {
    const btn = event.target && event.target.closest && event.target.closest('#connect');
    if (!btn || btn.dataset.stgbIgnore === '1') return;
    const box = document.getElementById('paste');
    const raw = box ? box.value : '';
    const parsed = globalThis.STGB_CONNECT.parseSetupPaste(raw);
    event.preventDefault();
    event.stopPropagation();
    if (!parsed.ok) {
      report(parsed.error, false);
      return;
    }
    const draft = globalThis.STGB_CONNECT.planConnect({enabled: []}, parsed);
    if (!draft.ok) {
      report(draft.error, false);
      return;
    }
    const origins = draft.origins || [];
    const save = function () {
      chrome.storage.local.get(null, function (current) {
        const plan = globalThis.STGB_CONNECT.planConnect(current, parsed);
        if (!plan.ok) {
          report(plan.error, false);
          return;
        }
        chrome.storage.local.set(plan.settings, function () {
          const finish = function () {
            if (box) box.value = '';
            report(plan.message, true);
          };
          if (plan.removeKeys && plan.removeKeys.length) chrome.storage.local.remove(plan.removeKeys, finish);
          else finish();
        });
      });
    };
    // permissions.request has to run in this click, before any await.
    if (!origins.length) {
      save();
      return;
    }
    chrome.permissions.request({origins: origins}, function (granted) {
      if (chrome.runtime.lastError || !granted) {
        report('Click Connect and choose Allow.', false);
        return;
      }
      save();
    });
  }, true);
})();
