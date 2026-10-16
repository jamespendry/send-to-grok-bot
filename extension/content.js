// Send to Grok Bot: adds an icon-only action to each post's action bar on x.com.
(() => {
  if (globalThis.__STGB_BOOTED || (document.documentElement && document.documentElement.dataset.stgbBoot)) return;
  globalThis.__STGB_BOOTED = true;
  if (document.documentElement) document.documentElement.dataset.stgbBoot = '1';

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
        sendTo(btn, item, article);
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
  // Checked against the public x.com status page on 2026-10-16.
  // Logged-in pages still use article[data-testid="tweet"], [data-testid="share"], and role="group".
  // The public page uses a plain article, aria-label "Share", and class x-engagement-button.
  function isShare(el) {
    const id = el.getAttribute('data-testid') || '';
    const label = el.getAttribute('aria-label') || '';
    return id === 'share' || /^share\b/i.test(label);
  }
  function isEngagement(el) {
    const id = el.getAttribute('data-testid') || '';
    const label = el.getAttribute('aria-label') || '';
    return /^(reply|retweet|repost|like|bookmark|share)$/i.test(id) || /^(reply|repost|retweet|like|bookmark|share|views)\b/i.test(label);
  }
  function shareControl(article) {
    return [...article.querySelectorAll('button, a, [role="button"]')].find(el => el.closest('article') === article && isShare(el)) || null;
  }
  function actionBar(article) {
    const group = [...article.querySelectorAll('[role="group"]')].find(g => g.closest('article') === article);
    if (group) return group;
    const share = shareControl(article);
    if (!share) return null;
    let node = share;
    while (node.parentElement && node.parentElement.closest('article') === article) {
      const parent = node.parentElement;
      const controls = [...parent.querySelectorAll('button, a, [role="button"]')].filter(el => el.closest('article') === article && isEngagement(el));
      if (controls.length >= 3 && parent.children.length >= 3) return parent;
      node = parent;
    }
    return share.parentElement;
  }
  // Clone Share only when its slot is Share alone. The 2026 bar groups Bookmark and Share.
  function shareSlot(bar, article) {
    const share = [...bar.querySelectorAll('button, a, [role="button"]')].find(el => el.closest('article') === article && isShare(el));
    if (!share) return null;
    let node = share;
    while (node.parentElement && node.parentElement !== bar) node = node.parentElement;
    if (node.parentElement !== bar) return null;
    const controls = [...node.querySelectorAll('button, a, [role="button"]')].filter(isEngagement);
    if (controls.length === 1) return node;
    if (!controls.length && isShare(node)) return node;
    return null;
  }
  function postArticles() {
    const found = new Set();
    document.querySelectorAll('article[data-testid="tweet"], article').forEach(a => {
      if (a.getAttribute('data-testid') === 'tweet' || shareControl(a)) found.add(a);
    });
    return [...found].filter(a => !(a.parentElement && a.parentElement.closest('article')));
  }
  function drawButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stgb-btn stgb-own';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    btn.appendChild(svg);
    setState(btn, 'send', 'Send');
    return btn;
  }
  // --- Post extraction. Everything is best-effort: X's DOM changes often, so each field degrades to empty. ---
  const MAX_TEXT = 20000, MAX_THREAD = 25;
  const clip = (s, n = MAX_TEXT) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');
  const own = (root, sel, article) => [...root.querySelectorAll(sel)].filter(n => n.closest('article') === article);
  // Quoted posts render as a nested [role="link"] block inside the article.
  const quoteBox = article => own(article, 'div[role="link"]', article).find(n => n.querySelector('[data-testid="User-Name"]')) || null;
  const outsideQuote = (nodes, q) => nodes.filter(n => !q || !q.contains(n));
  function postLink(article, q) {
    const links = outsideQuote(own(article, 'a[href*="/status/"]', article), q);
    return links.find(l => l.querySelector('time'))
      || links.find(l => /\/status\/\d+$/.test((l.getAttribute('href') || '').split('?')[0]))
      || null;
  }
  function userName(root) {
    const n = root.querySelector('[data-testid="User-Name"]');
    if (n) {
      const t = n.textContent, m = t.match(/@([A-Za-z0-9_]{1,15})/);
      return {name: (m ? t.slice(0, m.index) : t.split('·')[0]).trim(), handle: m ? m[1] : ''};
    }
    const handleLink = [...root.querySelectorAll('a[href]')].find(a => /^\/[A-Za-z0-9_]{1,15}$/.test(a.getAttribute('href') || ''));
    if (handleLink) return {name: (handleLink.textContent || '').trim().replace(/^@/, ''), handle: handleLink.getAttribute('href').slice(1)};
    const m = (root.innerText || '').match(/@([A-Za-z0-9_]{1,15})/);
    return {name: '', handle: m ? m[1] : ''};
  }
  // X puts a truncated label in aria-hidden spans and the full URL in another span, so
  // textContent is "github.com/foo…https://github.com/foo/bar". Read each piece on its own.
  function linkPieces(a) {
    const pieces = [];
    const walk = (n, hidden) => {
      if (n.nodeType === 3) {
        const t = (n.textContent || '').trim();
        if (t) pieces.push({t, hidden});
        return;
      }
      if (n.nodeType !== 1 || n.tagName === 'IMG') return;
      const h = hidden || n.getAttribute('aria-hidden') === 'true';
      [...n.childNodes].forEach(c => walk(c, h));
    };
    [...a.childNodes].forEach(c => walk(c, false));
    return pieces;
  }
  function urlsIn(text) {
    const urls = [];
    String(text || '').split('…').forEach(part => {
      const s = part.trim().replace(/[)\].,;:]+$/g, '');
      if (/^https?:\/\/\S+$/i.test(s)) urls.push(s);
    });
    return urls;
  }
  function linkParts(a) {
    const pieces = linkPieces(a);
    const urls = pieces.flatMap(p => urlsIn(p.t));
    const url = urls.slice().sort((x, y) => y.length - x.length)[0] || '';
    const hidden = pieces.filter(p => p.hidden).map(p => p.t).join('');
    const visible = pieces.filter(p => !p.hidden).map(p => p.t).join('');
    let label = (hidden || visible).replace(/…+$/g, '').trim();
    if (url && label.includes('…')) label = label.split('…')[0].trim();
    const href = /^https?:\/\//i.test(a.href || '') ? a.href : '';
    return {text: label || url, href, url};
  }
  function links(textEl) {
    if (!textEl) return [];
    return [...textEl.querySelectorAll('a[href]')].map(linkParts).filter(l => l.text && !/^[@#$]/.test(l.text) && (l.url || l.href));
  }
  function textOf(textEl) {
    if (!textEl) return '';
    const c = textEl.cloneNode(true);
    c.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    c.querySelectorAll('a[href]').forEach(a => { const parts = linkParts(a); a.replaceWith(parts.url || parts.text); });
    c.querySelectorAll('img[alt]').forEach(i => i.replaceWith(i.alt)); // emoji
    return clip(c.textContent);
  }
  // pbs.twimg.com serves the same asset at several sizes; name=large is the useful one.
  const THUMB_RE = /pbs\.twimg\.com\/(?:ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb)\//i;
  function preferLarge(raw) {
    if (!raw || !/^https?:\/\//i.test(raw)) return '';
    let u;
    try { u = new URL(raw); } catch (_) { return ''; }
    u.username = '';
    u.password = '';
    const twimg = /(^|\.)twimg\.com$/i.test(u.hostname);
    if (u.protocol === 'http:' && twimg) u.protocol = 'https:';
    if (u.protocol !== 'https:') return '';
    // Posters are sometimes hosted off twimg. Keep those URLs; only rewrite twimg sizes.
    if (!twimg) return u.href;
    u.pathname = u.pathname.replace(/:(?:small|medium|thumb|orig|large|\d+x\d+)$/i, '');
    if (u.searchParams.has('name') || /\/(?:media|ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb)\//i.test(u.pathname)) {
      u.searchParams.set('name', 'large');
    }
    return u.href;
  }
  function imageUrl(img) {
    const urls = [img.currentSrc, img.getAttribute('src'), img.src];
    (img.getAttribute('srcset') || '').split(',').forEach(part => urls.push(part.trim().split(/\s+/)[0]));
    const media = urls.find(v => v && /pbs\.twimg\.com\/media\//i.test(v));
    return media ? preferLarge(media) : '';
  }
  function thumbnail(player, video) {
    const urls = [];
    const add = (v) => { if (v && /^https?:\/\//i.test(v)) urls.push(v); };
    if (video) { add(video.poster); add(video.getAttribute('poster')); }
    player.querySelectorAll('img').forEach(img => {
      add(img.currentSrc); add(img.getAttribute('src'));
      (img.getAttribute('srcset') || '').split(',').forEach(part => add(part.trim().split(/\s+/)[0]));
    });
    const readStyle = (el) => {
      const re = /url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/gi;
      const style = el.getAttribute('style') || '';
      let m;
      while ((m = re.exec(style))) add(m[1]);
    };
    readStyle(player);
    player.querySelectorAll('[style]').forEach(readStyle);
    const hit = urls.find(v => THUMB_RE.test(v)) || urls.find(v => video && v === video.poster);
    return hit ? preferLarge(hit) : '';
  }
  function captionsOf(player, video) {
    const bits = [];
    const push = (s) => {
      const t = String(s || '').replace(/\s*\n\s*/g, '\n').trim();
      if (!t || bits.includes(t)) return;
      if (/^(cc|captions?|subtitles?|play|pause|mute|unmute|gif|video|replay)$/i.test(t)) return;
      bits.push(t);
    };
    try {
      const tracks = video && video.textTracks;
      if (tracks) {
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          if (!track || track.mode === 'disabled' || !track.activeCues) continue;
          for (let j = 0; j < track.activeCues.length; j++) push(track.activeCues[j] && track.activeCues[j].text);
        }
      }
    } catch (_) {}
    try {
      const scope = player.closest('[data-testid="videoComponent"]') || player;
      scope.querySelectorAll('[data-testid]').forEach(el => {
        const id = el.getAttribute('data-testid') || '';
        if (!/caption|subtitle/i.test(id)) return;
        if (el.closest('button, [role="button"]')) return;
        push(el.innerText || el.textContent);
      });
    } catch (_) {}
    return clip(bits.join('\n'), 2000);
  }
  function media(article, q) {
    const out = [];
    outsideQuote(own(article, '[data-testid="tweetPhoto"] img', article), q).forEach(i => {
      out.push({type: 'image', alt: i.alt && i.alt !== 'Image' ? i.alt : '', url: imageUrl(i)});
    });
    outsideQuote(own(article, '[data-testid="videoPlayer"]', article), q).forEach(v => {
      const el = v.querySelector('video');
      const thumb = thumbnail(v, el);
      const poster = (el && (el.poster || el.getAttribute('poster') || '')) || '';
      const gif = /gif/i.test((el && el.getAttribute('src')) || poster) || /tweet_video_thumb/i.test(thumb);
      let captions = '';
      try { captions = captionsOf(v, el); } catch (_) {}
      out.push({
        type: gif ? 'gif' : 'video',
        duration: el && isFinite(el.duration) ? Math.round(el.duration) : null,
        thumbnail: thumb,
        captions
      });
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
  // Old X puts the post in [data-testid="tweetText"]. The 2026 public page uses a
  // whitespace-pre body block and no test id.
  function textElOf(article, q) {
    const old = outsideQuote(own(article, '[data-testid="tweetText"]', article), q)[0];
    if (old) return old;
    return [...article.querySelectorAll('div')].find(el => {
      if (q && q.contains(el)) return false;
      if (el.closest('article') !== article) return false;
      const cls = typeof el.className === 'string' ? el.className : '';
      if (!/whitespace-pre/.test(cls)) return false;
      if (el.closest('button, a, [role="button"]')) return false;
      return (el.innerText || el.textContent || '').trim().length > 0;
    }) || null;
  }
  function basic(article) {
    const q = quoteBox(article);
    const link = postLink(article, q);
    const url = link ? link.href.replace(/\/(analytics|photo\/\d+|video\/\d+)$/, '') : '';
    const textEl = textElOf(article, q);
    const {name, handle} = userName(article);
    return {url, author: handle || (url.split('/')[3] || ''), authorName: name, text: textOf(textEl), postedAt: link?.querySelector('time')?.getAttribute('datetime') || '', textEl, q};
  }
  function extract(article) {
    const b = basic(article);
    const bar = actionBar(article);
    const post = {
      url: b.url || location.href, author: b.author, authorName: b.authorName, text: b.text, postedAt: b.postedAt,
      truncated: outsideQuote(own(article, '[data-testid="tweet-text-show-more-link"]', article), b.q).length > 0,
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
      const all = postArticles();
      const i = all.indexOf(article);
      if (i >= 0) {
        let s = i, e = i;
        const same = n => basic(n).author.toLowerCase() === post.author.toLowerCase();
        while (s > 0 && same(all[s - 1])) s--;
        while (e < all.length - 1 && same(all[e + 1])) e++;
        if (e > s) {
          // Keep the clicked post inside the cap. A prefix-only slice would drop it from the digest.
          let run = all.slice(s, e + 1);
          if (run.length > MAX_THREAD) {
            const at = run.indexOf(article);
            const from = at < 0 ? 0 : Math.min(Math.max(0, at - MAX_THREAD + 1), run.length - MAX_THREAD);
            run = run.slice(from, from + MAX_THREAD);
          }
          post.thread = run.map(n => { const x = basic(n); return {url: x.url, text: x.text, postedAt: x.postedAt}; });
        }
        if (s > 0) { const p = basic(all[s - 1]); post.inReplyTo = {url: p.url, author: p.author, text: p.text}; }
      }
    }
    return post;
  }
  function readArticle(article) {
    try { return extract(article); } catch (_) { return readPost(article); }
  }
  function applyResult(btn, item, r) {
    if (r && r.duplicate) { setState(btn, 'send', 'Send'); return; }
    const brand = (r && r.brand) || (item && item.brand) || 'grokbot';
    if (r && r.ok) {
      const title = r.title || (item && item.label) || 'Sent';
      showToast(brand, title, '');
      setState(btn, 'ok', title);
      return;
    }
    const reason = (r && r.error) || 'failed';
    const title = (r && r.title) || ("Couldn't send to " + ((item && item.label) || 'Grok Bot').replace(/^Send to /, ''));
    showToast(brand, title, reason);
    setState(btn, 'err', title);
    setTimeout(() => setState(btn, 'send', 'Send'), 5000);
  }
  function sendTo(btn, item, article) {
    const post = readArticle(article);
    closeMenu();
    if (btn.classList.contains('stgb-busy') || tooSoon(post.url, item.brand)) return;
    setState(btn, 'busy', 'Sending…');
    chrome.runtime.sendMessage({stgbDestination: item.brand, ...post}, r => applyResult(btn, item, r));
  }
  function bindSend(btn, article) {
    btn.dataset.stgbBound = '1';
    btn.dataset.stgbId = String(Date.now()) + Math.random().toString(36).slice(2);
    btn.classList.add('stgb-btn');
    btn.removeAttribute('aria-expanded');
    btn.removeAttribute('aria-describedby');
    btn.setAttribute('aria-haspopup', 'menu');
    if (btn.tagName === 'BUTTON') btn.type = 'button';
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (menuEl && menuEl.dataset.for === btn.dataset.stgbId) { closeMenu(); return; }
      if (btn.classList.contains('stgb-busy')) return;
      const post = readArticle(article);
      setState(btn, 'busy', 'Sending…');
      chrome.runtime.sendMessage({stgbAction: 'send', ...post}, r => {
        if (chrome.runtime.lastError || !r) {
          setState(btn, 'send', 'Send');
          showToast('grokbot', 'Send to Grok Bot', 'Reload the extension, then click the post again.');
          return;
        }
        if (r.items && r.items.length > 1) {
          setState(btn, 'send', 'Send');
          openMenu(btn, r.items, article);
          return;
        }
        applyResult(btn, (r.items && r.items[0]) || null, r);
      });
    }, true);
  }
  function addButtons() {
    postArticles().forEach(a => {
      if ([...a.querySelectorAll('.stgb-btn')].some(b => b.closest('article') === a)) return;
      const bar = actionBar(a);
      const proto = bar && shareSlot(bar, a);
      if (proto) {
        const wrap = proto.cloneNode(true);
        wrap.removeAttribute('id');
        wrap.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
        wrap.querySelectorAll('[data-testid]').forEach(n => n.removeAttribute('data-testid'));
        const btn = wrap.querySelector('button, [role="button"]');
        if (btn && !btn.dataset.stgbBound) {
          btn.querySelectorAll('[style]').forEach(n => n.style.removeProperty('color'));
          const svg = btn.querySelector('svg');
          if (svg && svg.previousElementSibling) svg.previousElementSibling.classList.add('stgb-circle');
          setState(btn, 'send', 'Send');
          bindSend(btn, a);
          bar.appendChild(wrap);
          return;
        }
      }
      const btn = drawButton();
      bindSend(btn, a);
      (bar || a).appendChild(btn);
    });
  }
  function arm() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', arm, {once: true});
      return;
    }
    new MutationObserver(addButtons).observe(document.body, {childList: true, subtree: true});
    addButtons();
  }
  arm();
})();
