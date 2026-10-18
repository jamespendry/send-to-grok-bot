// extension/enrich.js: mirror lookups, the merge into the post object, and the digest.
// Fixtures follow the shapes api.fxtwitter.com and api.vxtwitter.com returned on 2026-10-17.
// Nothing leaves the process: fetch is a stub that answers from the fixtures below.
// Run: cd relay && node --test test/node/enrich.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const E = require("../../../extension/enrich.js");

const author = (screen_name, name) => ({ screen_name, name, url: `https://x.com/${screen_name}`, id: "1" });
function fx(id, user, name, text, extra = {}) {
  return {
    url: `https://x.com/${user}/status/${id}`, id, text,
    raw_text: { text, display_text_range: [0, text.length], facets: [] },
    author: author(user, name),
    replies: 1, retweets: 0, likes: 2, bookmarks: 0, quotes: 0,
    created_at: "Sun Oct 18 05:06:07 +0000 2026", created_timestamp: 1792299967,
    views: 10, is_note_tweet: false, community_note: null, lang: "en",
    replying_to: null, replying_to_status: null, provider: "twitter", reposted_by: null,
    ...extra
  };
}
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const notFound = { ok: false, status: 404, json: async () => ({ code: 404, message: "NOT_FOUND" }) };

function router(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(String(url));
    const hit = routes[String(url)];
    if (typeof hit === "function") return hit(init);
    return hit || notFound;
  };
  return { fetch, calls };
}

// root (by @root) <- mid (by @mid) <- reply (by @alice). The reply has a photo.
const ROOT = fx("100", "root", "Root Person", "Step 1: do the thing.\nStep 2: do the other thing.\nStep 3: profit.");
const MID = fx("200", "mid", "Mid Person", "@root Which step is hardest?", { replying_to: "root", replying_to_status: "100" });
const REPLY = fx("300", "alice", "Alice Example", "@mid Step 2, by far.", {
  replying_to: "mid", replying_to_status: "200",
  media: { all: [{ type: "photo", id: "9", url: "https://pbs.twimg.com/media/ABC.jpg?name=orig", width: 10, height: 10, altText: "a chart" }] }
});
const PAGE_REPLY = {
  source: "x", url: "https://x.com/alice/status/300", author: "alice", authorName: "Alice Example",
  text: "@mid Step 2, by far.", postedAt: "2026-10-18T05:06:07.000Z", truncated: false,
  links: [], media: [{ type: "image", alt: "", url: "https://pbs.twimg.com/media/ABC.jpg?name=large" }],
  card: null, metrics: "1 reply", quoted: null, inReplyTo: null, thread: []
};

test("a reply two levels deep carries both parents, oldest first, into the post and digest", async () => {
  const r = router({
    "https://api.fxtwitter.com/alice/status/300": ok({ code: 200, message: "OK", tweet: REPLY }),
    "https://api.fxtwitter.com/mid/status/200": ok({ code: 200, message: "OK", tweet: MID }),
    "https://api.fxtwitter.com/root/status/100": ok({ code: 200, message: "OK", tweet: ROOT })
  });
  const ctx = await E.fetchContext(PAGE_REPLY.url, { fetch: r.fetch });
  assert.equal(ctx.source, "fxtwitter");
  assert.deepEqual(ctx.parents.map((p) => p.id), ["100", "200"]);
  const post = E.mergePost(PAGE_REPLY, ctx);
  for (const k of Object.keys(PAGE_REPLY)) assert.ok(k in post, "keeps " + k);
  assert.equal(post.context.source, "fxtwitter");
  assert.deepEqual(post.context.parents.map((p) => p.author), ["root", "mid"]);
  assert.equal(post.inReplyTo.url, "https://x.com/mid/status/200");
  assert.equal(post.media[0].url, "https://pbs.twimg.com/media/ABC.jpg?name=orig");
  const d = E.digest(post);
  const at = (s) => { const i = d.indexOf(s); assert.ok(i >= 0, `digest has ${JSON.stringify(s)}\n${d}`); return i; };
  const replying = at("Replying to (2 earlier posts, oldest first):");
  const root = at("Step 3: profit.");
  const mid = at("Which step is hardest?");
  const body = at("Post:\n@mid Step 2, by far.");
  const mediaAt = at("Media:\n- Image: a chart https://pbs.twimg.com/media/ABC.jpg?name=orig");
  assert.ok(replying < root && root < mid && mid < body && body < mediaAt);
  assert.ok(d.startsWith("X post by @alice (Alice Example)\nURL: https://x.com/alice/status/300"));
});

test("the thread endpoint supplies ancestors and the author's self-thread without extra lookups", async () => {
  const SELF2 = fx("400", "alice", "Alice Example", "And step 4 is a bonus.", { replying_to: { screen_name: "alice", status: "300" }, replying_to_status: null });
  const v2 = (t) => ({ type: "status", ...t, replying_to: t.replying_to_status ? { screen_name: t.replying_to, status: t.replying_to_status } : t.replying_to, replying_to_status: undefined });
  const r = router({
    "https://api.fxtwitter.com/alice/status/300": ok({ code: 200, message: "OK", tweet: REPLY }),
    "https://api.fxtwitter.com/2/thread/300": ok({ code: 200, status: v2(REPLY), thread: [v2(ROOT), v2(MID), v2(REPLY), SELF2], author: author("alice", "Alice Example") })
  });
  const ctx = await E.fetchContext(PAGE_REPLY.url, { fetch: r.fetch });
  assert.deepEqual(ctx.parents.map((p) => p.id), ["100", "200"]);
  assert.equal(r.calls.some((u) => /status\/(100|200)$/.test(u)), false, r.calls.join("\n"));
  const post = E.mergePost(PAGE_REPLY, ctx);
  assert.deepEqual(post.thread.map((t) => t.url), ["https://x.com/alice/status/300", "https://x.com/alice/status/400"]);
  const d = E.digest(post);
  assert.ok(d.includes("Author's thread, continued (the post above is 1 of 2):\n[2/2] https://x.com/alice/status/400\nAnd step 4 is a bonus."), d);
});

test("a long note tweet replaces the text the page cut at Show more", async () => {
  const long = "Here is everything. ".repeat(300).trim();
  const r = router({
    "https://api.fxtwitter.com/bob/status/500": ok({ code: 200, message: "OK", tweet: fx("500", "bob", "Bob", long, { is_note_tweet: true }) })
  });
  const page = { url: "https://x.com/bob/status/500?s=20", author: "bob", text: "Here is everything. Here is", truncated: true, media: [], thread: [] };
  const post = E.mergePost(page, await E.fetchContext(page.url, { fetch: r.fetch }));
  assert.equal(post.text, long);
  assert.equal(post.truncated, false);
  const d = E.digest(post);
  assert.ok(d.includes("Post:\n" + long));
  assert.equal(d.includes("cut off"), false);
  assert.ok(d.length <= E.MAX_DIGEST);
});

test("a quote is filled in with its full text, author, and media", async () => {
  const quoted = fx("700", "Teslaconomics", "Teslaconomics", "My son loves basketball. ".repeat(20).trim(), {
    is_note_tweet: true,
    media: { all: [{ type: "video", url: "https://video.twimg.com/v.mp4", thumbnail_url: "https://pbs.twimg.com/amplify_video_thumb/1/img/x.jpg", duration: 71.862, width: 1, height: 1 }] }
  });
  const r = router({
    "https://api.fxtwitter.com/elonmusk/status/600": ok({ code: 200, message: "OK", tweet: fx("600", "elonmusk", "Elon Musk", "This works well.", { quote: quoted }) })
  });
  const page = { url: "https://x.com/elonmusk/status/600", author: "elonmusk", text: "This works well.", media: [], thread: [],
    quoted: { author: "Teslaconomics", authorName: "Teslaconomics", text: "My son loves basketball…", postedAt: "", links: [{ text: "a", href: "https://t.co/a", url: "https://a.example" }] } };
  const post = E.mergePost(page, await E.fetchContext(page.url, { fetch: r.fetch }));
  assert.equal(post.quoted.text, quoted.text);
  assert.equal(post.quoted.url, "https://x.com/Teslaconomics/status/700");
  assert.equal(post.quoted.links.length, 1, "keeps the page's quote links");
  assert.equal(post.context.quote.author, "Teslaconomics");
  const d = E.digest(post);
  assert.ok(d.includes("Quoted post: @Teslaconomics (Teslaconomics), 2026-10-18T05:06:07.000Z, https://x.com/Teslaconomics/status/700\nMy son loves basketball."), d);
  assert.ok(d.includes("- Quoted post Video (72s) thumbnail: https://pbs.twimg.com/amplify_video_thumb/1/img/x.jpg"), d);
});

test("vxtwitter answers when fxtwitter fails", async () => {
  const r = router({
    "https://api.fxtwitter.com/alice/status/300": async () => { throw new TypeError("offline"); },
    "https://api.vxtwitter.com/alice/status/300": ok({
      tweetID: "300", user_screen_name: "alice", user_name: "Alice Example", text: "@mid Step 2, by far.",
      date: "Sun Oct 18 05:06:07 +0000 2026", date_epoch: 1792299967, replyingTo: "mid", replyingToID: "200",
      media_extended: [{ type: "image", url: "https://pbs.twimg.com/media/ABC.jpg", thumbnail_url: "https://pbs.twimg.com/media/ABC.jpg", altText: null }], qrt: null
    }),
    "https://api.vxtwitter.com/mid/status/200": ok({ tweetID: "200", user_screen_name: "mid", user_name: "Mid Person", text: "Which step?", date_epoch: 1792299900, replyingTo: null, replyingToID: null, media_extended: [] })
  });
  const post = E.mergePost(PAGE_REPLY, await E.fetchContext(PAGE_REPLY.url, { fetch: r.fetch }));
  assert.equal(post.context.source, "vxtwitter");
  assert.equal(post.context.parents[0].text, "Which step?");
  assert.ok(E.digest(post).includes("Replying to (1 earlier post, oldest first):\n[1] @mid (Mid Person)"));
});

test("when both mirrors fail, the page post goes out exactly as before, marked source page", async () => {
  const r = router({});
  const ctx = await E.fetchContext(PAGE_REPLY.url, { fetch: r.fetch });
  assert.equal(ctx, null);
  const post = E.mergePost(PAGE_REPLY, ctx);
  assert.deepEqual(post.context, { parents: [], quote: null, source: "page" });
  const { context, ...rest } = post;
  assert.deepEqual(rest, PAGE_REPLY);
  assert.equal(E.digest(post), E.pageDigest(PAGE_REPLY));
  assert.ok(E.digest(post).includes("\nText:\n@mid Step 2, by far."));
  assert.equal(E.mergePost({ url: "https://example.com/x" }, await E.fetchContext("https://example.com/x", { fetch: r.fetch })).context.source, "page");
});

test("a mirror that never answers gives up inside the budget", async () => {
  const hang = () => new Promise(() => {});
  const r = router({
    "https://api.fxtwitter.com/alice/status/300": hang,
    "https://api.vxtwitter.com/alice/status/300": hang,
    "https://api.fxtwitter.com/2/thread/300": hang
  });
  const t0 = Date.now();
  const ctx = await E.fetchContext(PAGE_REPLY.url, { fetch: r.fetch, budgetMs: 300 });
  const took = Date.now() - t0;
  assert.equal(ctx, null);
  assert.ok(took < 600, `took ${took}ms`);
  assert.equal(E.mergePost(PAGE_REPLY, ctx).context.source, "page");
  assert.equal(E.BUDGET_MS, 2500);
});

test("a slow parent keeps what arrived and says the chain is incomplete", async () => {
  const r = router({
    "https://api.fxtwitter.com/alice/status/300": ok({ code: 200, message: "OK", tweet: REPLY }),
    "https://api.fxtwitter.com/mid/status/200": ok({ code: 200, message: "OK", tweet: MID }),
    "https://api.fxtwitter.com/root/status/100": () => new Promise(() => {}),
    "https://api.vxtwitter.com/root/status/100": () => new Promise(() => {})
  });
  const post = E.mergePost(PAGE_REPLY, await E.fetchContext(PAGE_REPLY.url, { fetch: r.fetch, budgetMs: 300 }));
  assert.deepEqual(post.context.parents.map((p) => p.author), ["mid"]);
  assert.equal(post.context.more, true);
  assert.ok(E.digest(post).includes("(Earlier posts in the conversation were not fetched.)"));
});

test("the chain stops at eight parents", async () => {
  const routes = {};
  for (let i = 1; i <= 12; i++) {
    const extra = i > 1 ? { replying_to: "u" + (i - 1), replying_to_status: String(i - 1) } : {};
    routes[`https://api.fxtwitter.com/${i === 12 ? "alice" : "u" + i}/status/${i}`] = ok({ code: 200, tweet: fx(String(i), i === 12 ? "alice" : "u" + i, "", "post " + i, extra) });
  }
  const ctx = await E.fetchContext("https://x.com/alice/status/12", { fetch: router(routes).fetch });
  assert.equal(ctx.parents.length, 8);
  assert.deepEqual(ctx.parents.map((p) => p.id), ["4", "5", "6", "7", "8", "9", "10", "11"]);
  assert.equal(ctx.more, true);
});

test("the digest stays under the relay's field cap with long parents and posts", () => {
  const big = "x".repeat(25000);
  const p = {
    url: "https://x.com/a/status/1", author: "a", text: big, media: [], thread: [],
    quoted: { author: "q", text: big, links: [] },
    context: { source: "fxtwitter", parents: Array.from({ length: 8 }, (_, i) => ({ url: "u" + i, author: "p" + i, text: big, media: [] })), quote: null }
  };
  const d = E.digest(p);
  assert.ok(d.length <= E.MAX_DIGEST && E.MAX_DIGEST < 20000, String(d.length));
  assert.ok(d.includes("Replying to (8 earlier posts"));
  assert.ok(d.includes("Post:\n" + "x".repeat(12000) + "…"), "the post survives the cap");
  assert.ok(d.includes("Quoted post: @q"), "the quote survives the cap");
});
