// Claude destinations.
//  - claude_routine: POSTs to a Claude Code routine API trigger. Fully automatic, runs in Anthropic's cloud.
//      Docs: https://platform.claude.com/docs/en/api/claude-code/routines-fire (experimental API)
//      POST https://api.anthropic.com/v1/claude_code/routines/{trig_id}/fire
//      Headers: Authorization: Bearer sk-ant-oat01-... (per-routine token), anthropic-version: 2023-06-01
//      Body: {"text": "..."} (freeform, max 65,536 chars). 200 -> {claude_code_session_url}.
//      Limits: 30 fires/hour/routine, 100/hour/account. No idempotency key: each call = new session.
//      The endpoint sends no CORS headers (OPTIONS -> 405). It works only because this runs in the
//      extension service worker, which host_permissions exempt from CORS.
//  - claude_link: opens claude.ai/new?q=<prompt> in a new tab (prefill only; user presses Send). Any plan.
self.STGB_DESTINATIONS = self.STGB_DESTINATIONS || {};

const CLAUDE_DEFAULT_PROMPT =
`I'm tracking early AI companies and the people building them. Research this X post:
1. Who is the author, and what company/product (if any) is it about?
2. What does the company do, stage, funding, team size, location, and recent launches?
3. Who are the 2-3 most relevant leaders to follow on X (verify handles)?
4. Any open roles, or signs they'll soon need GTM, partnerships, marketing or growth help?
5. Verdict: strong / partial / weak fit, in one line, with why.
Use web search. Be concise.`;

const CLAUDE_MAX_TEXT = 65536;
// claude.ai/new?q= is undocumented; keep the encoded URL modest.
const CLAUDE_MAX_URL = 8000;

// Accepts a bare trig_ id, the api.anthropic.com fire URL, or the
// claude.ai/code/routines/trig_... page (with or without https).
function claudeFireUrl(v) {
  v = (v || '').trim();
  const fire = id => `https://api.anthropic.com/v1/claude_code/routines/${id}/fire`;
  if (/^trig_[A-Za-z0-9_-]+$/.test(v)) return fire(v);
  let url;
  try { url = new URL(/^[a-z]+:/i.test(v) ? v : 'https://' + v.replace(/^\/\//, '')); }
  catch { return ''; }
  const id = (url.pathname.match(/\/(trig_[A-Za-z0-9_-]+)/) || [])[1];
  if (!id) return '';
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'api.anthropic.com' && /^\/v1\/claude_code\/routines\/trig_[A-Za-z0-9_-]+\/fire\/?$/.test(url.pathname)) return fire(id);
  if (host === 'claude.ai' && /^\/code\/routines\/trig_[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return fire(id);
  return '';
}

function claudePostBlock(post, text) {
  return `X post to research\nURL: ${post.url}\nAuthor: @${post.author || 'unknown'}\nSent at: ${post.sentAt}\n\n"""\n${text}\n"""`;
}

function buildClaudeLink(post, s) {
  const instructions = (s.claudePrompt || CLAUDE_DEFAULT_PROMPT).trim();
  const make = t => 'https://claude.ai/new?q=' + encodeURIComponent(`${instructions}\n\n${claudePostBlock(post, t)}`);
  let text = post.digest || post.text || '';
  if (make(text).length > CLAUDE_MAX_URL) {
    let lo = 0, hi = text.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; make(text.slice(0, mid) + '…').length <= CLAUDE_MAX_URL ? lo = mid : hi = mid - 1; }
    text = text.slice(0, lo) + '…';
  }
  return make(text);
}

self.STGB_DESTINATIONS.claude_link = {
  label: 'Send to Claude',
  toast: 'Sent to Claude',
  async send(post, s) {
    await chrome.tabs.create({url: buildClaudeLink(post, s)});
    return {ok: true};
  }
};

self.STGB_DESTINATIONS.claude_routine = {
  label: 'Send to Claude',
  toast: 'Sent to Claude',
  async send(post, s) {
    const url = claudeFireUrl(s.claudeFireUrl);
    if (!s.claudeFireUrl || !s.claudeToken) return {ok: false, error: 'Set up first', needsSetup: true};
    if (!url) return {ok: false, error: 'Paste a claude.ai/code/routines/trig_… link, a trig_ ID, or the API fire URL'};
    // The routine's saved prompt carries the instructions; we send only the post (plus optional extra prompt).
    let text = (s.claudePrompt ? s.claudePrompt.trim() + '\n\n' : '') + claudePostBlock(post, post.digest || post.text || '');
    if (text.length > CLAUDE_MAX_TEXT) text = text.slice(0, CLAUDE_MAX_TEXT);
    const r = await fetch(url, {
      method: 'POST',
      headers: {'Authorization': 'Bearer ' + s.claudeToken.trim(), 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'},
      body: JSON.stringify({text})
    });
    if (r.ok) {
      let sessionUrl = '';
      try { sessionUrl = (await r.json()).claude_code_session_url || ''; } catch (_) {}
      return {ok: true, sessionUrl};
    }
    const msgs = {400: 'Bad request or routine paused', 401: 'Token invalid for this routine', 403: 'Plan lacks routine API access', 404: 'Routine not found', 429: 'Hourly limit reached', 503: 'Claude overloaded, retry'};
    return {ok: false, error: msgs[r.status] || 'HTTP ' + r.status, needsSetup: r.status === 401 || r.status === 404};
  }
};

if (typeof module !== 'undefined') module.exports = {buildClaudeLink, claudeFireUrl, CLAUDE_DEFAULT_PROMPT};
