// Codex destination.
// As of October 2026, Codex Cloud has no public inbound webhook for regular ChatGPT
// accounts. The CLI posts to chatgpt.com/backend-api/wham/tasks with the user's
// ChatGPT session, which an extension cannot ask someone to paste. OpenAI has also
// said inbound webhooks are not available yet.
// Fallback: open the cloud task composer with the post prefilled.
// https://chatgpt.com/codex?environment=<id>&branch=<name>&prompt=<text>
// The prompt is applied when the composer opens; the user presses Send.
self.STGB_DESTINATIONS = self.STGB_DESTINATIONS || {};

const CODEX_DEFAULT_PROMPT =
`I'm tracking early AI companies and the people building them. Research this X post:
1. Who is the author, and what company/product (if any) is it about?
2. What does the company do, stage, funding, team size, location, and recent launches?
3. Who are the 2-3 most relevant leaders to follow on X (verify handles)?
4. Any open roles, or signs they'll soon need GTM, partnerships, marketing or growth help?
5. Verdict: strong / partial / weak fit, in one line, with why.
Use web search. Be concise.`;

const CODEX_MAX_URL = 6000;

function buildCodexLink(post, s) {
  const instructions = (s.codexPrompt || CODEX_DEFAULT_PROMPT).trim();
  const head = `${instructions}\n\nPost by @${post.author || 'unknown'}: ${post.url}\n\n"""\n`;
  const staticParams = [];
  const env = (s.codexEnvironment || '').trim();
  const branch = (s.codexBranch || '').trim();
  if (env) staticParams.push('environment=' + encodeURIComponent(env));
  if (branch) staticParams.push('branch=' + encodeURIComponent(branch));
  const prefix = 'https://chatgpt.com/codex?' + (staticParams.length ? staticParams.join('&') + '&' : '');
  let text = post.digest || post.text || '';
  const make = t => prefix + 'prompt=' + encodeURIComponent(head + t + '\n"""');
  if (make(text).length > CODEX_MAX_URL) {
    let lo = 0, hi = text.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; make(text.slice(0, mid) + '…').length <= CODEX_MAX_URL ? lo = mid : hi = mid - 1; }
    text = text.slice(0, lo) + '…';
  }
  return make(text);
}

self.STGB_DESTINATIONS.codex = {
  label: 'Send to Codex',
  toast: 'Sent to Codex',
  async send(post, s) {
    await chrome.tabs.create({url: buildCodexLink(post, s)});
    return {ok: true};
  }
};

if (typeof module !== 'undefined') module.exports = {buildCodexLink, CODEX_DEFAULT_PROMPT, CODEX_MAX_URL};
