// Send to Grok Bot: adds an icon-only action to each post's action bar on x.com.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    send: 'M2.5 3.5l19 8.5-19 8.5 2.6-8.5L2.5 3.5zm4.2 9.25l-1.5 4.9L17.3 12 5.2 6.35l1.5 4.9H13v1.5H6.7z',
    ok: 'M9.64 18.952l-5.55-4.861 1.317-1.504 3.951 3.459 8.459-10.948L19.4 6.32 9.64 18.952z',
    err: 'M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z'
  };
  function setState(btn, state, title) {
    btn.classList.remove('stgb-ok', 'stgb-err', 'stgb-busy');
    if (state !== 'send') btn.classList.add('stgb-' + state);
    const svg = btn.querySelector('svg');
    if (svg) {
      let g = svg.querySelector('g');
      if (!g) { g = document.createElementNS(NS, 'g'); svg.appendChild(g); }
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', ICONS[state === 'busy' ? 'send' : state]);
      g.replaceChildren(p);
    }
    btn.title = title; btn.setAttribute('aria-label', title);
  }
  let toastEl, toastTimer;
  function showToast(message, err) {
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement('div');
      toastEl.className = 'stgb-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
    }
    toastEl.textContent = message;
    toastEl.classList.toggle('stgb-toast-err', !!err);
    toastEl.classList.remove('stgb-toast-show');
    document.body.appendChild(toastEl);
    void toastEl.offsetWidth;
    toastEl.classList.add('stgb-toast-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (toastEl) toastEl.classList.remove('stgb-toast-show'); }, 3000);
  }
  // Direct child of the action bar that holds Share. Its classes are what space the row out.
  function shareWrap(bar) {
    const share = bar.querySelector('[data-testid="share"]');
    let node = share || bar.lastElementChild;
    if (!node || node === bar) return null;
    while (node.parentElement && node.parentElement !== bar) node = node.parentElement;
    return node.parentElement === bar ? node : null;
  }
  function actionBar(article) {
    return [...article.querySelectorAll('[role="group"]')].find(g => g.closest('article') === article) || null;
  }
  function addButtons() {
    document.querySelectorAll('article[data-testid="tweet"]').forEach(a => {
      if (a.querySelector('.stgb-btn')) return;
      const bar = actionBar(a);
      const proto = bar && shareWrap(bar);
      if (!proto) return;
      // Deep-clone Share so flex slot, 34.75px hit circle, and icon box match exactly.
      const wrap = proto.cloneNode(true);
      wrap.removeAttribute('id');
      wrap.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      wrap.querySelectorAll('[data-testid]').forEach(n => n.removeAttribute('data-testid'));
      const btn = wrap.querySelector('button, [role="button"]');
      if (!btn) return;
      btn.classList.add('stgb-btn');
      btn.removeAttribute('aria-haspopup');
      btn.removeAttribute('aria-expanded');
      btn.removeAttribute('aria-describedby');
      if (btn.tagName === 'BUTTON') btn.type = 'button';
      btn.querySelectorAll('[style]').forEach(n => n.style.removeProperty('color'));
      const svg = btn.querySelector('svg');
      if (svg && svg.previousElementSibling) svg.previousElementSibling.classList.add('stgb-circle');
      setState(btn, 'send', 'Send to Grok Bot');
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        if (btn.classList.contains('stgb-busy')) return;
        const link = [...a.querySelectorAll('a[href*="/status/"]')].find(l => l.querySelector('time'));
        const url = link ? link.href : location.href;
        const text = a.querySelector('[data-testid="tweetText"]')?.innerText || '';
        const author = (url.split('/')[3]) || '';
        setState(btn, 'busy', 'Sending…');
        chrome.runtime.sendMessage({url, text, author}, r => {
          if (r && r.ok) {
            setState(btn, 'ok', 'Sent to Grok Bot');
            showToast('Sent to Grok Bot');
          } else {
            const err = (r && r.error) || 'failed';
            setState(btn, 'err', 'Not sent: ' + err + '. Click to retry.');
            showToast(err, true);
            setTimeout(() => setState(btn, 'send', 'Send to Grok Bot'), 4000);
          }
        });
      }, true);
      bar.appendChild(wrap);
    });
  }
  new MutationObserver(addButtons).observe(document.body, {childList: true, subtree: true});
  addButtons();
})();
