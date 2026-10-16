// Runs on sendtogrokbot.com/connect. The visible paste box is an extension
// page, so Allow can be asked during the paste. This page only shows the result.
(function () {
  'use strict';
  document.documentElement.dataset.stgbReady = '1';

  function report(text, ok, pending) {
    const el = document.getElementById('msg');
    if (el) {
      el.textContent = text || '';
      el.className = text ? (pending ? 'pending' : (ok ? 'ok' : 'err')) : '';
    }
    if (typeof CustomEvent === 'function') {
      document.dispatchEvent(new CustomEvent('stgb-connect-result', {detail: {ok: !!ok, pending: !!pending, message: text || ''}}));
    }
  }

  let frame = null;

  function onMessage(event) {
    const data = event.data;
    if (!data || data.stgb !== 'result') return;
    const id = chrome.runtime && chrome.runtime.id;
    if (id && event.origin && event.origin !== 'chrome-extension://' + id) return;
    report(data.message || '', !!data.ok, !!data.pending);
  }

  if (globalThis.addEventListener) globalThis.addEventListener('message', onMessage);

  function mount() {
    if (!document.body || !document.createElement || !document.getElementById) return;
    const box = document.getElementById('paste');
    if (!box || document.getElementById('stgb-grant')) return;
    if (!chrome.runtime || !chrome.runtime.getURL) return;
    frame = document.createElement('iframe');
    frame.id = 'stgb-grant';
    frame.title = 'Paste here';
    frame.src = chrome.runtime.getURL('grant.html');
    frame.style.cssText = 'display:block;width:100%;height:160px;border:0;border-radius:8px;background:#fff';
    box.hidden = true;
    box.disabled = true;
    box.setAttribute('aria-hidden', 'true');
    const label = document.querySelector('label[for="paste"]');
    if (label) label.htmlFor = '';
    box.insertAdjacentElement('afterend', frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
