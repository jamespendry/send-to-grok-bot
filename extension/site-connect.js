// Runs on sendtogrokbot.com/connect. The visible paste box is an extension
// page, so Allow can be asked during the paste. This page only shows the result.
(function () {
  'use strict';
  document.documentElement.dataset.stgbReady = '1';

  // A /connect#stgb1... link. Read it at document_start and remove it from the
  // address bar right away, so the code does not linger in the URL or history.
  let handoff = '';
  let frameReady = false;
  function takeHash() {
    try {
      const raw = decodeURIComponent((location.hash || '').slice(1)).trim();
      if (!/^(stgb1|stgbr1)\.[A-Za-z0-9_-]+$/i.test(raw)) return '';
      history.replaceState(null, '', location.pathname + location.search);
      return raw;
    } catch (_) {
      return '';
    }
  }
  function handTo(code) {
    if (!code || !frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({stgb: 'code', code: code}, 'chrome-extension://' + chrome.runtime.id);
  }
  handoff = takeHash();
  // A second link opened while this page is already open only changes the hash.
  if (globalThis.addEventListener) {
    globalThis.addEventListener('hashchange', function () {
      const code = takeHash();
      if (!code) return;
      handoff = code;
      const heading = document.querySelector('#step-paste h2');
      if (heading) heading.textContent = 'Finish connecting';
      if (frameReady) handTo(code);
    });
  }

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

  function hide(el) {
    if (!el) return;
    el.hidden = true;
    el.style.setProperty('display', 'none', 'important');
  }

  function shorten() {
    hide(document.querySelector('nav'));
    hide(document.querySelector('h1'));
    hide(document.getElementById('step-install'));
    document.querySelectorAll('[data-stgb-extra]').forEach(hide);
    const heading = document.querySelector('#step-paste h2');
    if (heading) heading.textContent = handoff ? 'Finish connecting' : 'Paste what your setup page told you to copy.';
    hide(document.querySelector('label[for="paste"]'));
  }

  function mount() {
    shorten();
    if (!document.body || !document.createElement || !document.getElementById) return;
    const box = document.getElementById('paste');
    if (!box || document.getElementById('stgb-grant')) return;
    if (!chrome.runtime || !chrome.runtime.getURL) return;
    frame = document.createElement('iframe');
    frame.id = 'stgb-grant';
    frame.title = 'Paste here';
    frame.src = chrome.runtime.getURL('grant.html');
    frame.style.cssText = 'display:block;width:100%;height:160px;border:0;border-radius:12px;background:transparent';
    frame.setAttribute('allowtransparency', 'true');
    frame.addEventListener('load', function () {
      frameReady = true;
      if (handoff) handTo(handoff);
    });
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
