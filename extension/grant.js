// Extension page inside the connect box. permissions.request has to run here,
// in the paste, because a content script cannot ask and a service worker
// often never shows Allow.
(function () {
  'use strict';
  const box = document.getElementById('box');
  if (!box) return;

  function tell(message, ok, pending) {
    document.documentElement.dataset.stgbMessage = message || '';
    document.documentElement.dataset.stgbOk = ok ? '1' : '';
    document.documentElement.dataset.stgbPending = pending ? '1' : '';
    const target = globalThis.parent;
    if (!target || target === globalThis || !target.postMessage) return;
    target.postMessage({stgb: 'result', ok: !!ok, pending: !!pending, message: message || ''}, '*');
  }

  function clearBox() {
    const wipe = function () { box.value = ''; };
    wipe();
    setTimeout(wipe, 0);
  }

  function save(parsed) {
    chrome.storage.local.get(null, function (current) {
      const plan = globalThis.STGB_CONNECT.planConnect(current || {enabled: []}, parsed);
      if (!plan.ok) {
        tell(plan.error, false, false);
        return;
      }
      chrome.storage.local.set(plan.settings, function () {
        const finish = function () {
          clearBox();
          tell(globalThis.STGB_CONNECT.finishMessage(parsed, plan), true, false);
        };
        if (plan.removeKeys && plan.removeKeys.length) chrome.storage.local.remove(plan.removeKeys, finish);
        else finish();
      });
    });
  }

  // Ask for the hosts this destination needs, then save. Must run inside a paste or a click.
  function connect(parsed) {
    const draft = globalThis.STGB_CONNECT.planConnect({enabled: []}, parsed);
    if (!draft.ok) {
      tell(draft.error, false, false);
      return;
    }
    const origins = draft.origins || [];
    if (!origins.length) {
      save(parsed);
      return;
    }
    tell('Choose Allow.', false, true);
    chrome.permissions.request({origins: origins}, function (granted) {
      const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
      if (!granted || err) {
        tell('Choose Allow to finish.', false, false);
        return;
      }
      save(parsed);
    });
  }

  box.addEventListener('paste', function (event) {
    try {
      const data = event.clipboardData;
      const raw = data ? data.getData('text') : '';
      const parsed = globalThis.STGB_CONNECT.parseSetupPaste(raw);
      if (!parsed.ok) {
        tell(parsed.error, false, false);
        return;
      }
      connect(parsed);
    } catch (err) {
      tell((err && err.message) || 'Could not save that paste.', false, false);
    }
  });

  // A /connect#stgb1... link: the page hands the code here. Codes that need no
  // permission save at once. Others show what they are, never the secret, and a
  // Finish button, because Allow can only be asked during a click.
  const SITES = ['https://sendtogrokbot.com', 'https://www.sendtogrokbot.com'];
  const panel = document.getElementById('finish');
  const what = document.getElementById('what');
  const go = document.getElementById('go');
  let handed = null;

  function receive(event) {
    const data = event && event.data;
    if (!data || data.stgb !== 'code' || typeof data.code !== 'string') return;
    if (SITES.indexOf(event.origin) === -1) return;
    const parsed = globalThis.STGB_CONNECT.parseSetupPaste(data.code);
    if (!parsed.ok) {
      tell(parsed.error, false, false);
      return;
    }
    const draft = globalThis.STGB_CONNECT.planConnect({enabled: []}, parsed);
    if (draft.ok && !(draft.origins || []).length) {
      save(parsed);
      return;
    }
    handed = parsed;
    if (what) what.textContent = parsed.plain || 'Ready to connect.';
    if (panel) panel.hidden = false;
    box.hidden = true;
    tell('Click Finish.', false, true);
  }

  if (go) {
    go.addEventListener('click', function () {
      if (!handed) return;
      const parsed = handed;
      handed = null;
      if (panel) panel.hidden = true;
      box.hidden = false;
      connect(parsed);
    });
  }
  if (globalThis.addEventListener) globalThis.addEventListener('message', receive);
})();
