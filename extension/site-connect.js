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
  // Save a parsed code into chrome.storage.local, the same way the paste box does.
  function save(parsed) {
    chrome.storage.local.get(null, function (current) {
      const plan = globalThis.STGB_CONNECT.planConnect(current || {enabled: []}, parsed);
      if (!plan.ok) { report(plan.error, false); return; }
      chrome.storage.local.set(plan.settings, function () {
        const finish = function () {
          const panel = document.getElementById('stgb-finish');
          if (panel) panel.remove();
          report(globalThis.STGB_CONNECT.finishMessage(parsed, plan), true);
        };
        if (plan.removeKeys && plan.removeKeys.length) chrome.storage.local.remove(plan.removeKeys, finish);
        else finish();
      });
    });
  }

  // A connect link. The Finish button lives on the page itself, not in the extension
  // frame, so it works in tabs where embedded extension frames are removed (agent-driven
  // tabs). The click is the gesture; the service worker asks for Allow in that turn.
  function handTo(code) {
    if (!code || !globalThis.STGB_CONNECT) return;
    const parsed = globalThis.STGB_CONNECT.parseSetupPaste(code);
    if (!parsed.ok) { report(parsed.error, false); return; }
    const draft = globalThis.STGB_CONNECT.planConnect({enabled: []}, parsed);
    if (!draft.ok) { report(draft.error, false); return; }
    const origins = draft.origins || [];
    if (!origins.length) { save(parsed); return; }
    const old = document.getElementById('stgb-finish');
    if (old) old.remove();
    const panel = document.createElement('div');
    panel.id = 'stgb-finish';
    panel.className = 'note';
    const what = document.createElement('p');
    what.style.margin = '0 0 12px';
    what.style.fontWeight = '600';
    what.textContent = parsed.plain || 'Ready to connect.';
    const go = document.createElement('button');
    go.type = 'button';
    go.id = 'stgb-finish-go';
    go.className = 'btn';
    go.textContent = 'Finish';
    go.addEventListener('click', function () {
      report('Choose Allow in the Chrome prompt.', false, true);
      chrome.runtime.sendMessage({stgbAction: 'request-origins', origins: origins}, function (res) {
        const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
        if (err || !res || !res.ok) { report('Choose Allow to finish. Click Finish again.', false); return; }
        save(parsed);
      });
    });
    panel.appendChild(what);
    panel.appendChild(go);
    const anchor = document.getElementById('stgb-grant') || document.getElementById('paste');
    if (anchor) anchor.insertAdjacentElement('beforebegin', panel);
    else if (document.body) document.body.prepend(panel);
    report('Click Finish.', false, true);
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
      if (document.readyState !== 'loading') handTo(code);
    });
  }

  // A saved paste or link gets an unmistakable confirmation at the top of the step,
  // so nobody has to guess whether they're done.
  function confirm(text) {
    const step = document.getElementById('step-paste') || document.querySelector('main');
    if (!step) return;
    let done = document.getElementById('stgb-done');
    if (!done) {
      done = document.createElement('div');
      done.id = 'stgb-done';
      done.className = 'note done';
      done.setAttribute('role', 'status');
      const heading = step.querySelector('h2');
      if (heading) heading.insertAdjacentElement('afterend', done);
      else step.prepend(done);
    }
    done.textContent = '';
    const title = document.createElement('b');
    title.textContent = /now paste/i.test(text) ? 'Saved. One more to go.' : 'Connected.';
    const body = document.createElement('span');
    body.textContent = ' ' + text + ' ';
    done.appendChild(title);
    done.appendChild(body);
    if (!/now paste/i.test(text)) {
      const go = document.createElement('a');
      go.href = 'https://x.com/home';
      go.target = '_blank';
      go.rel = 'noopener';
      go.textContent = 'Open x.com';
      done.appendChild(go);
    }
    if (done.scrollIntoView) done.scrollIntoView({block: 'center', behavior: 'smooth'});
  }

  function report(text, ok, pending) {
    const el = document.getElementById('msg');
    if (el) {
      el.textContent = text || '';
      el.className = text ? (pending ? 'pending' : (ok ? 'ok' : 'err')) : '';
    }
    if (ok && text) {
      confirm(text);
      if (el) { el.textContent = ''; el.className = ''; }
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
    if (handoff) setTimeout(function () { handTo(handoff); }, 0);
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
    frame.addEventListener('load', function () { frameReady = true; });
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
