// ChatGPT destinations.
//  - chatgpt_link: opens chatgpt.com/?q=<prompt> in a new tab (prefill only; user presses Send). Any plan.
//  - chatgpt_workspace_agent: POSTs to a Workspace Agent API trigger (Business/Enterprise). Fully automatic.
// Docs: https://developers.openai.com/workspace-agents/trigger-runs
self.STGB_DESTINATIONS = self.STGB_DESTINATIONS || {};

const CHATGPT_DEFAULT_PROMPT =
`I'm tracking early AI companies and the people building them. Research this X post:
1. Who is the author, and what company/product (if any) is it about?
2. What does the company do, stage, funding, team size, location, and recent launches?
3. Who are the 2-3 most relevant leaders to follow on X (verify handles)?
4. Any open roles, or signs they'll soon need GTM, partnerships, marketing or growth help?
5. Verdict: strong / partial / weak fit, in one line, with why.
Use web search. Be concise.`;

// Unofficial deep link; prompts beyond ~6k chars have been reported to be dropped or truncated.
// We keep the *encoded* URL under this budget to stay safe across browsers/proxies.
const CHATGPT_MAX_URL = 6000;

function chatgptInput(post, s) {
  const instructions = (s.chatgptPrompt || CHATGPT_DEFAULT_PROMPT).trim();
  return {instructions, body: `Post by @${post.author || 'unknown'}: ${post.url}\n\n"""\n${post.text || ''}\n"""`};
}

function buildChatGPTLink(post, s) {
  const {instructions} = chatgptInput(post, s);
  const base = 'https://chatgpt.com/?q=';
  const head = `${instructions}\n\nPost by @${post.author || 'unknown'}: ${post.url}\n\n"""\n`;
  let text = post.text || '';
  const make = t => base + encodeURIComponent(head + t + '\n"""');
  if (make(text).length > CHATGPT_MAX_URL) {
    // Binary-search the longest text prefix that fits; the URL is always kept so ChatGPT can open the full post.
    let lo = 0, hi = text.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; make(text.slice(0, mid) + '…').length <= CHATGPT_MAX_URL ? lo = mid : hi = mid - 1; }
    text = text.slice(0, lo) + '…';
  }
  return make(text);
}

self.STGB_DESTINATIONS.chatgpt_link = {
  label: 'Send to ChatGPT',
  toast: 'Sent to ChatGPT',
  async send(post, s) {
    await chrome.tabs.create({url: buildChatGPTLink(post, s)});
    return {ok: true};
  }
};

self.STGB_DESTINATIONS.chatgpt_workspace_agent = {
  label: 'Send to ChatGPT',
  toast: 'Sent to ChatGPT',
  async send(post, s) {
    if (!s.chatgptTriggerId || !s.chatgptToken) return {ok: false, error: 'Set up first', needsSetup: true};
    const id = s.chatgptTriggerId.trim();
    if (!/^agtch_[A-Za-z0-9_-]+$/.test(id)) return {ok: false, error: 'Trigger ID should start with agtch_', needsSetup: true};
    const {instructions, body} = chatgptInput(post, s);
    const r = await fetch(`https://api.chatgpt.com/v1/workspace_agents/${id}/trigger`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + s.chatgptToken.trim(),
        'Content-Type': 'application/json',
        'Idempotency-Key': post.url
      },
      body: JSON.stringify({input: `${instructions}\n\n${body}\n\nSent at ${post.sentAt}`})
    });
    const msgs = {401: 'Token invalid or expired', 403: 'Token lacks access to this agent', 404: 'Trigger not found', 409: 'Agent not runnable (published?)'};
    if (r.status === 202 || r.ok) {
      let conversationUrl = '';
      try { conversationUrl = (await r.json()).conversation_url || ''; } catch (_) {}
      return {ok: true, conversationUrl};
    }
    return {ok: false, error: msgs[r.status] || 'HTTP ' + r.status};
  }
};

if (typeof module !== 'undefined') module.exports = {buildChatGPTLink, CHATGPT_DEFAULT_PROMPT, CHATGPT_MAX_URL};
