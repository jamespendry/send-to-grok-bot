// Runs on sendtogrokbot.com/connect. A paste writes the box into this browser.
// The page itself never receives the saved settings back.
// chrome.permissions is not available in a content script, so the request goes to
// the service worker in this same turn, before any await.
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

  function clearBox(box) {
    const wipe = function () { if (box) box.value = ''; };
    wipe();
    setTimeout(wipe, 0);
  }

  document.addEventListener('paste', function (event) {
    try {
      const box = document.getElementById('paste');
      if (!box || event.target !== box) return;
      const data = event.clipboardData;
      const raw = data ? data.getData('text') : '';
      const parsed = globalThis.STGB_CONNECT.parseSetupPaste(raw);
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
              clearBox(box);
              report(globalThis.STGB_CONNECT.finishMessage(parsed, plan), true);
            };
            if (plan.removeKeys && plan.removeKeys.length) chrome.storage.local.remove(plan.removeKeys, finish);
            else finish();
          });
        });
      };
      if (!origins.length) {
        save();
        return;
      }
      chrome.runtime.sendMessage({stgbAction: 'request-origins', origins: origins}, function (res) {
        const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
        if (err || !res || !res.ok) {
          report('Choose Allow to finish.', false);
          return;
        }
        save();
      });
    } catch (err) {
      report((err && err.message) || 'Could not save that paste.', false);
    }
  }, true);
})();
