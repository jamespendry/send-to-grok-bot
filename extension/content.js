// Send to Grok Bot: adds an icon-only action to each post's action bar on x.com.
(() => {
  if (globalThis.__STGB_BOOTED || document.documentElement.dataset.stgbBoot) return;
  globalThis.__STGB_BOOTED = true;
  document.documentElement.dataset.stgbBoot = '1';

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
  function brandSvg(brand) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', (globalThis.STGB_LOGOS && globalThis.STGB_LOGOS[brand]) || '');
    svg.appendChild(p);
    return svg;
  }
  function xDark() {
    const c = getComputedStyle(document.body).backgroundColor || '';
    const m = c.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return matchMedia('(prefers-color-scheme: dark)').matches;
    return (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) < 140;
  }
  let toastEl, toastTimer;
  function showToast(brand, title, reason) {
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
    }
    toastEl.className = 'stgb-toast stgb-b-' + brand + (xDark() ? ' stgb-dark' : '') + (reason ? ' stgb-err' : '');
    const mark = document.createElement('span');
    mark.className = 'stgb-toast-mark';
    mark.appendChild(brandSvg(brand));
    const copy = document.createElement('span');
    copy.className = 'stgb-toast-copy';
    const heading = document.createElement('span');
    heading.className = 'stgb-toast-title';
    heading.textContent = title;
    copy.appendChild(heading);
    if (reason) {
      const detail = document.createElement('span');
      detail.className = 'stgb-toast-reason';
      detail.textContent = reason;
      copy.appendChild(detail);
    }
    toastEl.replaceChildren(mark, copy);
    toastEl.classList.remove('stgb-toast-show');
    document.body.appendChild(toastEl);
    void toastEl.offsetWidth;
    toastEl.classList.add('stgb-toast-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (toastEl) toastEl.classList.remove('stgb-toast-show'); }, 3000);
  }
  const recentSends = new Map();
  function tooSoon(url, brand) {
    const now = Date.now();
    const key = url + '\n' + brand;
    for (const [k, t] of recentSends) if (now - t >= 5000) recentSends.delete(k);
    const t = recentSends.get(key);
    if (t != null && now - t < 5000) return true;
    recentSends.set(key, now);
    return false;
  }
  // Flat post fields. Add fields on the returned object; the service worker forwards them.
  function readPost(article) {
    const link = [...article.querySelectorAll('a[href*="/status/"]')].find(l => l.querySelector('time'));
    const url = link ? link.href : location.href;
    const text = article.querySelector('[data-testid="tweetText"]')?.innerText || '';
    const author = (url.split('/')[3]) || '';
    return {url, text, author};
  }
  let menuEl, menuCloser;
  function closeMenu() {
    if (menuCloser) { menuCloser(); menuCloser = null; }
    if (menuEl) { menuEl.remove(); menuEl = null; }
  }
  function openMenu(btn, items, article) {
    closeMenu();
    const menu = document.createElement('div');
    menu.className = 'stgb-menu' + (xDark() ? ' stgb-dark' : '');
    menu.setAttribute('role', 'menu');
    items.forEach(item => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'stgb-b-' + item.brand;
      row.setAttribute('role', 'menuitem');
      row.appendChild(brandSvg(item.brand));
      const label = document.createElement('span');
      label.textContent = item.label;
      row.appendChild(label);
      row.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        let post;
        try { post = extract(article); } catch (_) { post = readPost(article); }
        closeMenu();
        if (btn.classList.contains('stgb-busy') || tooSoon(post.url, item.brand)) return;
        setState(btn, 'busy', 'Sending…');
        chrome.runtime.sendMessage({stgbDestination: item.brand, ...post}, r => {
          if (r && r.duplicate) { setState(btn, 'send', 'Send'); return; }
          if (r && r.ok) {
            setState(btn, 'ok', r.title || item.label);
            showToast(item.brand, r.title || ('Sent to ' + item.label.replace(/^Send to /, '')), '');
          } else {
            const reason = (r && r.error) || 'failed';
            const title = (r && r.title) || ("Couldn't send to " + item.label.replace(/^Send to /, ''));
            setState(btn, 'err', title);
            showToast(item.brand, title, reason);
            setTimeout(() => setState(btn, 'send', 'Send'), 5000);
          }
        });
      }, true);
      menu.appendChild(row);
    });
    menu.addEventListener('pointerdown', e => e.stopPropagation());
    menu.dataset.for = btn.dataset.stgbId || '';
    document.body.appendChild(menu);
    const r = btn.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = r.left + r.width / 2 - mw / 2;
    left = Math.max(8, Math.min(left, innerWidth - mw - 8));
    let top = r.bottom + 8;
    if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 8);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menuEl = menu;
    const onDoc = e => { if (!menu.contains(e.target)) closeMenu(); };
    const onKey = e => { if (e.key === 'Escape') closeMenu(); };
    const onScroll = () => closeMenu();
    setTimeout(() => {
      document.addEventListener('pointerdown', onDoc, true);
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('scroll', onScroll, true);
    }, 0);
    menuCloser = () => {
      document.removeEventListener('pointerdown', onDoc, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
    };
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
  // --- Post extraction. Everything is best-effort: X's DOM changes often, so each field degrades to empty. ---
  const MAX_TEXT = 20000, MAX_THREAD = 25;
  const clip = (s, n = MAX_TEXT) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');
  const own = (root, sel, article) => [...root.querySelectorAll(sel)].filter(n => n.closest('article') === article);
  // Quoted posts render as a nested [role="link"] block inside the article.
  const quoteBox = article => own(article, 'div[role="link"]', article).find(n => n.querySelector('[data-testid="User-Name"]')) || null;
  const outsideQuote = (nodes, q) => nodes.filter(n => !q || !q.contains(n));
  function postLink(article, q) {
    return outsideQuote(own(article, 'a[href*="/status/"]', article), q).find(l => l.querySelector('time')) || null;
  }
  function userName(root) {
    const n = root.querySelector('[data-testid="User-Name"]');
    if (!n) return {name: '', handle: ''};
    const t = n.textContent, m = t.match(/@([A-Za-z0-9_]{1,15})/);
    return {name: (m ? t.slice(0, m.index) : t.split('·')[0]).trim(), handle: m ? m[1] : ''};
  }
  // X hides the full URL in invisible spans inside each link, so textContent recovers it while innerText shows "github.com/foo…".
  function links(textEl) {
    if (!textEl) return [];
    return [...textEl.querySelectorAll('a[href]')].map(l => {
      const shown = l.textContent.replace(/…$/, '').trim();
      return {text: shown, href: l.href, url: /^https?:\/\//.test(shown) ? shown : ''};
    }).filter(l => !/^[@#$]/.test(l.text));
  }
  function textOf(textEl) {
    if (!textEl) return '';
    const c = textEl.cloneNode(true);
    c.querySelectorAll('a[href]').forEach(l => { const t = l.textContent.replace(/…$/, '').trim(); if (/^https?:\/\//.test(t)) l.replaceWith(t); });
    c.querySelectorAll('img[alt]').forEach(i => i.replaceWith(i.alt)); // emoji
    return clip(c.textContent);
  }
  function media(article, q) {
    const out = [];
    outsideQuote(own(article, '[data-testid="tweetPhoto"] img', article), q).forEach(i => out.push({type: 'image', alt: i.alt && i.alt !== 'Image' ? i.alt : ''}));
    outsideQuote(own(article, '[data-testid="videoPlayer"]', article), q).forEach(v => {
      const el = v.querySelector('video');
      out.push({type: el && /gif/i.test(el.src || el.poster || '') ? 'gif' : 'video', duration: el && isFinite(el.duration) ? Math.round(el.duration) : null});
    });
    return out;
  }
  function card(article, q) {
    const c = outsideQuote(own(article, '[data-testid="card.wrapper"]', article), q)[0];
    if (!c) return null;
    const a = c.querySelector('a[href]');
    const lines = c.innerText.split('\n').map(s => s.trim()).filter(Boolean);
    return {href: a ? a.href : '', text: clip(lines.join(' | '), 1000)};
  }
  function basic(article) {
    const q = quoteBox(article);
    const link = postLink(article, q);
    const url = link ? link.href.replace(/\/(analytics|photo\/\d+|video\/\d+)$/, '') : '';
    const textEl = outsideQuote(own(article, '[data-testid="tweetText"]', article), q)[0];
    const {name, handle} = userName(article);
    return {url, author: handle || (url.split('/')[3] || ''), authorName: name, text: textOf(textEl), postedAt: link?.querySelector('time')?.getAttribute('datetime') || '', textEl, q};
  }
  function extract(article) {
    const b = basic(article);
    const bar = actionBar(article);
    const post = {
      url: b.url || location.href, author: b.author, authorName: b.authorName, text: b.text, postedAt: b.postedAt,
      truncated: !!own(article, '[data-testid="tweet-text-show-more-link"]', article).length,
      links: links(b.textEl), media: media(article, b.q), card: card(article, b.q),
      metrics: bar?.getAttribute('aria-label') || '', quoted: null, inReplyTo: null, thread: []
    };
    if (b.q) {
      const qt = b.q.querySelector('[data-testid="tweetText"]');
      const qu = userName(b.q);
      post.quoted = {author: qu.handle, authorName: qu.name, text: textOf(qt), postedAt: b.q.querySelector('time')?.getAttribute('datetime') || '', links: links(qt)};
    }
    // On a post's own page, X renders ancestors above it and replies below. Collect the author's contiguous run as the thread.
    if (/\/status\/\d+/.test(location.pathname)) {
      const all = [...document.querySelectorAll('article[data-testid="tweet"]')];
      const i = all.indexOf(article);
      if (i >= 0) {
        let s = i, e = i;
        const same = n => basic(n).author.toLowerCase() === post.author.toLowerCase();
        while (s > 0 && same(all[s - 1])) s--;
        while (e < all.length - 1 && same(all[e + 1])) e++;
        if (e > s) post.thread = all.slice(s, e + 1).slice(0, MAX_THREAD).map(n => { const x = basic(n); return {url: x.url, text: x.text, postedAt: x.postedAt}; });
        if (s > 0) { const p = basic(all[s - 1]); post.inReplyTo = {url: p.url, author: p.author, text: p.text}; }
      }
    }
    return post;
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
      if (!btn || btn.dataset.stgbBound) return;
      btn.dataset.stgbBound = '1';
      btn.dataset.stgbId = String(Date.now()) + Math.random().toString(36).slice(2);
      btn.classList.add('stgb-btn');
      btn.removeAttribute('aria-expanded');
      btn.removeAttribute('aria-describedby');
      btn.setAttribute('aria-haspopup', 'menu');
      if (btn.tagName === 'BUTTON') btn.type = 'button';
      btn.querySelectorAll('[style]').forEach(n => n.style.removeProperty('color'));
      const svg = btn.querySelector('svg');
      if (svg && svg.previousElementSibling) svg.previousElementSibling.classList.add('stgb-circle');
      setState(btn, 'send', 'Send');
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if (menuEl && menuEl.dataset.for === btn.dataset.stgbId) { closeMenu(); return; }
        chrome.runtime.sendMessage({stgbAction: 'list'}, r => {
          const items = r && r.items;
          if (!items || !items.length) return;
          openMenu(btn, items, a);
        });
      }, true);
      bar.appendChild(wrap);
    });
  }
  new MutationObserver(addButtons).observe(document.body, {childList: true, subtree: true});
  addButtons();
})();
