// Full post and conversation context for a send, from public no-login mirrors of X.
// The page only shows what X rendered: long posts stop at "Show more" and a reply's parent is
// often off screen. Destinations cannot fetch anything, so the service worker fills it in here.
// Pure functions plus an injectable fetch, so relay/test/node/enrich.test.mjs runs them in node.
(function (root) {
  const FX = 'https://api.fxtwitter.com';
  const VX = 'https://api.vxtwitter.com';
  const BUDGET_MS = 2500;
  const MAX_PARENTS = 8;
  const MAX_THREAD = 25;
  const MAX_TEXT = 20000;
  // The relay clips any string field at 20000 characters. Stay under it.
  const MAX_DIGEST = 18000;
  const CLIP = {post: 12000, parent: 2500, quote: 4000, thread: 2500, ctxText: 4000};

  const clip = (s, n) => {
    s = String(s || '');
    return s.length > n ? s.slice(0, n) + '…' : s;
  };
  const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v));

  function parseStatusUrl(url) {
    const m = String(url || '').match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15}|i)\/status(?:es)?\/(\d{1,25})/i);
    return m ? {user: m[1], id: m[2]} : null;
  }

  function isoFrom(epoch, text) {
    const n = Number(epoch);
    if (Number.isFinite(n) && n > 0) {
      try { return new Date(n * 1000).toISOString(); } catch (_) {}
    }
    const d = Date.parse(str(text));
    return Number.isFinite(d) ? new Date(d).toISOString() : '';
  }

  // The shape content.js already sends: {type: image|video|gif, alt, url} or {type, duration, thumbnail}.
  function fxMedia(t) {
    const all = (t && t.media && Array.isArray(t.media.all)) ? t.media.all
      : [].concat((t && t.media && t.media.photos) || [], (t && t.media && t.media.videos) || []);
    return all.map(m => {
      if (!m || typeof m !== 'object') return null;
      if (m.type === 'photo') return {type: 'image', alt: str(m.altText), url: str(m.url)};
      if (m.type === 'video' || m.type === 'gif') {
        return {type: m.type, duration: Number.isFinite(m.duration) && m.type === 'video' ? Math.round(m.duration) : null, thumbnail: str(m.thumbnail_url), captions: ''};
      }
      return null;
    }).filter(Boolean);
  }
  function vxMedia(t) {
    const all = (t && Array.isArray(t.media_extended)) ? t.media_extended : [];
    return all.map(m => {
      if (!m || typeof m !== 'object') return null;
      if (m.type === 'image') return {type: 'image', alt: str(m.altText), url: str(m.url)};
      if (m.type === 'video' || m.type === 'gif') {
        const ms = Number(m.duration_millis);
        return {type: m.type, duration: Number.isFinite(ms) && ms > 0 && m.type === 'video' ? Math.round(ms / 1000) : null, thumbnail: str(m.thumbnail_url), captions: ''};
      }
      return null;
    }).filter(Boolean);
  }

  // fxtwitter: v1 /<user>/status/<id> has {tweet}; v2 /2/thread/<id> has {status, thread[]}.
  // v1 gives replying_to as a screen name; v2 gives {screen_name, status}.
  function normFx(t, depth) {
    if (!t || typeof t !== 'object' || !t.id) return null;
    const a = t.author || {};
    const rt = t.replying_to;
    const replyToUser = typeof rt === 'string' ? rt : (rt && rt.screen_name) || '';
    const replyToId = str(t.replying_to_status || (rt && typeof rt === 'object' && rt.status) || '');
    return {
      id: str(t.id), url: str(t.url) || `https://x.com/${a.screen_name || 'i'}/status/${t.id}`,
      author: str(a.screen_name), authorName: str(a.name), text: str(t.text),
      postedAt: isoFrom(t.created_timestamp, t.created_at), media: fxMedia(t),
      quote: depth ? null : normFx(t.quote, 1), replyToId, replyToUser
    };
  }
  function normVx(t, depth) {
    if (!t || typeof t !== 'object' || !t.tweetID) return null;
    const user = str(t.user_screen_name);
    return {
      id: str(t.tweetID), url: user ? `https://x.com/${user}/status/${t.tweetID}` : str(t.tweetURL),
      author: user, authorName: str(t.user_name), text: str(t.text),
      postedAt: isoFrom(t.date_epoch, t.date), media: vxMedia(t),
      quote: depth ? null : normVx(t.qrt, 1), replyToId: str(t.replyingToID || ''), replyToUser: str(t.replyingTo || '')
    };
  }

  function timeLeft(deadline) { return deadline - Date.now(); }

  async function getJson(fetchFn, url, deadline) {
    const left = timeLeft(deadline);
    if (left < 50) throw new Error('budget');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { if (ctrl) ctrl.abort(); reject(new Error('timeout')); }, left);
    });
    try {
      const run = (async () => {
        const r = await fetchFn(url, {method: 'GET', headers: {Accept: 'application/json'}, credentials: 'omit', signal: ctrl ? ctrl.signal : undefined});
        if (!r || !r.ok) throw new Error('http ' + (r && r.status));
        return await r.json();
      })();
      return await Promise.race([run, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function fxStatus(fetchFn, user, id, deadline) {
    const j = await getJson(fetchFn, `${FX}/${user || 'i'}/status/${id}`, deadline);
    const s = normFx(j && j.tweet, 0);
    if (!s) throw new Error('fx shape');
    return s;
  }
  async function vxStatus(fetchFn, user, id, deadline) {
    const j = await getJson(fetchFn, `${VX}/${user || 'i'}/status/${id}`, deadline);
    const s = normVx(j, 0);
    if (!s) throw new Error('vx shape');
    return s;
  }
  // The author's self-thread and the ancestors in one request. Best effort.
  async function fxThread(fetchFn, id, deadline) {
    const j = await getJson(fetchFn, `${FX}/2/thread/${id}`, deadline);
    return (j && Array.isArray(j.thread) ? j.thread : []).map(t => normFx(t, 0)).filter(Boolean);
  }

  // Returns {source, main, parents (oldest first), thread, more} or null when nothing usable came back.
  async function fetchContext(url, opts) {
    opts = opts || {};
    const fetchFn = opts.fetch || (typeof fetch === 'function' ? fetch : null);
    const ref = parseStatusUrl(url);
    if (!fetchFn || !ref) return null;
    const deadline = Date.now() + (opts.budgetMs || BUDGET_MS);
    const threadP = fxThread(fetchFn, ref.id, deadline).catch(() => []);
    let main = null, source = '';
    try { main = await fxStatus(fetchFn, ref.user, ref.id, deadline); source = 'fxtwitter'; }
    catch (_) {
      try { main = await vxStatus(fetchFn, ref.user, ref.id, deadline); source = 'vxtwitter'; }
      catch (_) { main = null; }
    }
    // A slow thread lookup may not starve the parent walk: leave it at least 1.2 s of the budget.
    let waitTimer;
    const threadList = await Promise.race([
      threadP,
      new Promise(resolve => { waitTimer = setTimeout(() => resolve([]), Math.max(0, timeLeft(deadline) - 1200)); })
    ]);
    clearTimeout(waitTimer);
    if (!main) {
      main = threadList.find(t => t.id === ref.id) || null;
      if (main) source = 'fxtwitter';
    }
    if (!main) return null;
    const known = new Map(threadList.map(t => [t.id, t]));
    const parents = [];
    const seen = new Set([main.id]);
    let cur = main, more = false;
    while (cur.replyToId && !seen.has(cur.replyToId)) {
      if (parents.length >= MAX_PARENTS) { more = true; break; }
      const pid = cur.replyToId;
      let p = known.get(pid) || null;
      if (!p) {
        const first = source === 'vxtwitter' ? vxStatus : fxStatus;
        const second = source === 'vxtwitter' ? fxStatus : vxStatus;
        try { p = await first(fetchFn, cur.replyToUser, pid, deadline); }
        catch (_) {
          try { p = await second(fetchFn, cur.replyToUser, pid, deadline); }
          catch (_) { p = null; }
        }
      }
      if (!p) { more = true; break; }
      seen.add(p.id);
      parents.unshift(p);
      cur = p;
    }
    // The author's contiguous run around the post, as the page's thread field has it.
    let thread = [];
    const at = threadList.findIndex(t => t.id === main.id);
    if (at >= 0 && main.author) {
      const same = t => t.author.toLowerCase() === main.author.toLowerCase();
      let s = at, e = at;
      while (s > 0 && same(threadList[s - 1])) s--;
      while (e < threadList.length - 1 && same(threadList[e + 1])) e++;
      if (e > s) {
        let from = s, to = e + 1;
        if (to - from > MAX_THREAD) { from = Math.max(s, Math.min(at - MAX_THREAD + 1, to - MAX_THREAD)); to = from + MAX_THREAD; }
        thread = threadList.slice(from, to);
      }
    }
    return {source, main, parents, thread, more};
  }

  function brief(s, n) {
    return {url: s.url, author: s.author, authorName: s.authorName, text: clip(s.text, n), postedAt: s.postedAt, media: s.media};
  }

  // Keep every page field. Replace text, quote, thread, and inReplyTo with the fuller API versions.
  function mergePost(post, ctx) {
    const out = {...post};
    if (!ctx || !ctx.main) {
      out.context = {
        parents: post.inReplyTo ? [{url: str(post.inReplyTo.url), author: str(post.inReplyTo.author), text: str(post.inReplyTo.text)}] : [],
        quote: post.quoted || null,
        source: 'page'
      };
      return out;
    }
    const m = ctx.main;
    if (m.text) { out.text = clip(m.text, MAX_TEXT); out.truncated = false; }
    if (m.author) out.author = m.author;
    if (m.authorName) out.authorName = m.authorName;
    if (!out.postedAt && m.postedAt) out.postedAt = m.postedAt;
    if (m.media.length) {
      const page = Array.isArray(post.media) ? post.media : [];
      out.media = m.media.map((x, i) => {
        const p = page[i];
        if (p && p.captions && p.type === x.type) return {...x, captions: p.captions};
        return x;
      });
    }
    if (m.quote) {
      const q = m.quote;
      out.quoted = {
        author: q.author, authorName: q.authorName, text: clip(q.text, MAX_TEXT), postedAt: q.postedAt,
        links: (post.quoted && post.quoted.links) || [], url: q.url, media: q.media
      };
    }
    const parents = ctx.parents || [];
    if (parents.length) {
      const last = parents[parents.length - 1];
      out.inReplyTo = {url: last.url, author: last.author, text: clip(last.text, MAX_TEXT)};
    }
    if (ctx.thread && ctx.thread.length > 1) {
      out.thread = ctx.thread.map(t => ({url: t.url, text: clip(t.text, MAX_TEXT), postedAt: t.postedAt}));
    }
    out.context = {
      parents: parents.map(p => brief(p, CLIP.ctxText)),
      quote: m.quote ? brief(m.quote, CLIP.ctxText) : null,
      source: ctx.source
    };
    if (ctx.more) out.context.more = true;
    // Kept for the digest's "Author's thread, continued" block.
    if (ctx.thread && ctx.thread.length > 1) out.context.threadAt = ctx.thread.findIndex(t => t.id === m.id);
    else if (Array.isArray(out.thread) && out.thread.length > 1) out.context.threadAt = out.thread.findIndex(t => t && normUrl(t.url) === normUrl(out.url));
    return out;
  }

  function mediaLine(m) {
    if (!m || typeof m !== 'object') return '';
    const label = m.type === 'gif' ? 'GIF' : m.type === 'video' ? 'Video' : 'Image';
    const head = m.duration ? `${label} (${m.duration}s)` : label;
    if (m.type === 'image') {
      const body = [m.alt, m.url].filter(Boolean).join(' ');
      return '- ' + (body ? `${head}: ${body}` : head);
    }
    const parts = [head];
    if (m.alt) parts.push(m.alt);
    if (m.captions) parts.push('captions: ' + m.captions);
    if (m.thumbnail) parts.push('thumbnail: ' + m.thumbnail);
    return '- ' + parts.join(' ');
  }
  function normUrl(u) {
    return String(u || '').split('?')[0].replace(/\/$/, '');
  }

  // What the page had, rendered exactly as before enrichment existed.
  function pageDigest(p) {
    const L = [`X post by @${p.author}${p.authorName ? ` (${p.authorName})` : ''}`, `URL: ${p.url}`];
    if (p.postedAt) L.push(`Posted: ${p.postedAt}`);
    if (p.metrics) L.push(`Engagement: ${p.metrics}`);
    if (p.inReplyTo) L.push('', `In reply to @${p.inReplyTo.author} (${p.inReplyTo.url}):`, p.inReplyTo.text);
    const thread = Array.isArray(p.thread) ? p.thread : [];
    const url = normUrl(p.url);
    const threadHasClicked = url
      ? thread.some(t => normUrl(t && t.url) === url)
      : !!(p.text && thread.some(t => t && t.text === p.text));
    if (thread.length > 1) {
      L.push('', `Thread (${thread.length} posts by the author):`);
      thread.forEach((t, i) => L.push(`[${i + 1}/${thread.length}] ${t.url}`, t.text));
      if (!threadHasClicked) L.push('', 'Text:', p.text || '(no text)');
    } else L.push('', 'Text:', p.text || '(no text)');
    if (p.truncated) L.push('(Post text was cut off by "Show more" in the timeline; the full text may be longer.)');
    if (p.quoted) L.push('', `Quoting @${p.quoted.author}${p.quoted.postedAt ? ` (${p.quoted.postedAt})` : ''}:`, p.quoted.text);
    const links = [...(p.links || []), ...((p.quoted && p.quoted.links) || [])];
    if (links.length) L.push('', 'Links:', ...links.map(l => `- ${l.url || l.text} (${l.href})`));
    if (p.card) L.push('', `Link card: ${p.card.text} (${p.card.href})`);
    if (p.media && p.media.length) {
      const lines = p.media.map(mediaLine).filter(Boolean);
      if (lines.length) L.push('', 'Media:', ...lines);
    }
    return L.join('\n');
  }

  function byline(s) {
    return `@${s.author || 'unknown'}${s.authorName ? ` (${s.authorName})` : ''}${s.postedAt ? `, ${s.postedAt}` : ''}${s.url ? `, ${s.url}` : ''}`;
  }

  // Labelled plain text: Replying to (oldest first), Post, Quoted post, Media.
  // Older parents shrink first, so the post itself always fits under the cap.
  function enrichedDigest(p) {
    let out = '';
    for (const n of [CLIP.parent, 1200, 600, 300, 150]) {
      out = renderEnriched(p, n);
      if (out.length <= MAX_DIGEST) return out;
    }
    return out.slice(0, MAX_DIGEST - 1) + '…';
  }
  function renderEnriched(p, parentClip) {
    const c = p.context || {};
    const L = [`X post by @${p.author}${p.authorName ? ` (${p.authorName})` : ''}`, `URL: ${p.url}`];
    if (p.postedAt) L.push(`Posted: ${p.postedAt}`);
    if (p.metrics) L.push(`Engagement: ${p.metrics}`);
    L.push(`Full text and conversation from ${c.source}, not just what the page showed.`);
    const parents = Array.isArray(c.parents) ? c.parents : [];
    if (parents.length) {
      L.push('', `Replying to (${parents.length} earlier post${parents.length === 1 ? '' : 's'}, oldest first):`);
      if (c.more) L.push('(Earlier posts in the conversation were not fetched.)');
      parents.forEach((s, i) => {
        L.push(`[${i + 1}] ${byline(s)}`, clip(s.text, i === parents.length - 1 ? Math.max(parentClip, 1200) : parentClip) || '(no text)');
        const ml = (s.media || []).map(mediaLine).filter(Boolean);
        if (ml.length) L.push(...ml);
      });
    }
    L.push('', 'Post:', clip(p.text, CLIP.post) || '(no text)');
    const thread = Array.isArray(p.thread) ? p.thread : [];
    const at = Number.isInteger(c.threadAt) ? c.threadAt : -1;
    if (thread.length > 1 && at >= 0 && at < thread.length - 1) {
      L.push('', `Author's thread, continued (the post above is ${at + 1} of ${thread.length}):`);
      thread.slice(at + 1).forEach((t, i) => L.push(`[${at + i + 2}/${thread.length}] ${t.url}`, clip(t.text, CLIP.thread)));
    }
    if (p.quoted) L.push('', `Quoted post: ${byline(p.quoted)}`, clip(p.quoted.text, CLIP.quote) || '(no text)');
    const links = [...(p.links || []), ...((p.quoted && p.quoted.links) || [])];
    if (links.length) L.push('', 'Links:', ...links.map(l => `- ${l.url || l.text} (${l.href})`));
    if (p.card) L.push('', `Link card: ${p.card.text} (${p.card.href})`);
    const lines = (p.media || []).map(mediaLine).filter(Boolean);
    const qlines = ((p.quoted && p.quoted.media) || []).map(m => mediaLine(m).replace(/^- /, '- Quoted post ')).filter(Boolean);
    if (lines.length || qlines.length) L.push('', 'Media:', ...lines, ...qlines);
    return L.join('\n');
  }

  function digest(p) {
    return p && p.context && p.context.source && p.context.source !== 'page' ? enrichedDigest(p) : pageDigest(p);
  }

  const api = {
    BUDGET_MS, MAX_PARENTS, MAX_DIGEST,
    parseStatusUrl, normFx, normVx, fetchContext, mergePost, digest, pageDigest, enrichedDigest, mediaLine
  };
  root.STGB_ENRICH = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
