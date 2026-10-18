// The phone shortcut's no-setup path. It needs no code and stores nothing.
// Given a post link and an AI, it fetches the post's full context, the same way
// the extension does, and returns a link that opens that AI with the post filled in.
// The person reads it and presses Send in that app.
import "../../extension/enrich.js";

const E = globalThis.STGB_ENRICH;

// What the person sees in the message box, so it reads like a message a person would send:
// who posted, what they said, the link, and one question. No instructions, no metadata.
export const ASK = "What's the takeaway?";

const oneLine = t => String(t || "").replace(/\s+/g, " ").trim();
const short = (t, n) => { const s = oneLine(t); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const who = (handle, name) => handle ? `@${handle}${name ? ` (${name})` : ""}` : "This post";

export function phoneMessage(post) {
  const L = [];
  if (post.inReplyTo && post.inReplyTo.text) L.push(`Replying to @${post.inReplyTo.author}: "${short(post.inReplyTo.text, 280)}"`, "");
  const text = String(post.text || "").trim();
  L.push(text ? `${who(post.author, post.authorName)}: "${text}"` : who(post.author, post.authorName));
  if (post.quoted && post.quoted.text) L.push("", `Quoting @${post.quoted.author}: "${short(post.quoted.text, 400)}"`);
  L.push(post.url, "", ASK);
  return L.join("\n");
}

// Prompts much past 6000 characters of link have been reported to be dropped.
const MAX_URL = 6000;
const MAX_COPY = 18000;

const LINKS = {
  chatgpt: "https://chatgpt.com/?q=",
  codex: "https://chatgpt.com/codex?prompt=",
  claude: "https://claude.ai/new?q="
};

export const OPEN_NOTICES = {
  chatgpt: "Opening ChatGPT. Press Send.",
  codex: "Opening Codex. Press Send.",
  claude: "Opening Claude. Press Send.",
  grokbot: "Copied. Paste it in Grok Bot and send."
};

// Keep the link under budget by shortening the post text, never the link or the question.
function fit(base, post) {
  const make = p => base + encodeURIComponent(phoneMessage(p));
  if (make(post).length <= MAX_URL) return make(post);
  const lean = { ...post, inReplyTo: null, quoted: null };
  const text = String(post.text || "");
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (make({ ...lean, text: text.slice(0, mid) + "…" }).length <= MAX_URL) lo = mid; else hi = mid - 1;
  }
  return make({ ...lean, text: text.slice(0, lo) + "…" });
}

// The X app shares a link, a page, or text with a link in it. Find the post link anywhere in it.
const STATUS = /https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status(?:es)?\/\d{1,25}/i;

export function parsePostUrl(raw) {
  const found = String(raw || "").match(STATUS);
  const ref = found && E.parseStatusUrl(found[0]);
  if (!ref) return null;
  return { ...ref, url: `https://x.com/${ref.user}/status/${ref.id}` };
}

export async function buildOpen(destination, postUrl, fetchFn) {
  const ref = parsePostUrl(postUrl);
  if (!ref) return { ok: false, error: "No post link came through. In the X app, tap Share on a post, then Share via, then Send to Grok Bot." };
  if (!Object.prototype.hasOwnProperty.call(OPEN_NOTICES, destination)) {
    return { ok: false, error: "Pick Grok Bot, Claude, ChatGPT, or Codex." };
  }
  let ctx = null;
  try { ctx = await E.fetchContext(ref.url, { fetch: fetchFn }); } catch { ctx = null; }
  const post = E.mergePost({ url: ref.url, author: ref.user === "i" ? "" : ref.user, text: "" }, ctx);
  const out = { ok: true, destination, notice: OPEN_NOTICES[destination], context: ctx && ctx.main ? "full" : "link" };
  if (destination === "grokbot") {
    const text = phoneMessage(post);
    out.copyText = text.length > MAX_COPY ? text.slice(0, MAX_COPY - 1) + "…" : text;
    out.openUrl = "grokbot://";
  } else {
    out.openUrl = fit(LINKS[destination], post);
  }
  return out;
}
