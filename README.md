# Send to Grok Bot

A small Chrome (Manifest V3) extension that adds a native-looking icon to the action bar of every post on x.com. Clicking it opens a menu of the destinations you have set up — Send to Grok Bot, Send to Claude, Send to ChatGPT, or Send to Codex — and sends the post to the one you pick. A Grok Bot routine webhook lets your bot research it, file it, or act on it. Any webhook that accepts JSON works too (Zapier, Make, n8n, your own server).

## Install (unpacked)
1. Download or clone this repo (or unzip `send-to-grok-bot.zip`).
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.

## Configure
1. Click the extension's toolbar icon (or Details > Extension options).
2. Check each destination you want in the menu and fill in its fields, then click **Save**. Tokens and keys are stored in `chrome.storage.local`. A webhook URL and key saved by an earlier version are migrated from sync storage.
3. Refresh x.com. Click the arrow icon in the post's action bar — it uses the same slot, hit area, and icon size as Share. A menu lists only the destinations you configured, each with its logo. One row sends only to that destination. The menu still appears when just one destination is set up. If none are set up, the options page opens. The icon turns green when the send succeeds and red if it failed. Sending the same post to the same destination again is ignored for 5 seconds.
4. A toast at the bottom center fades out after about 3 seconds. It uses X’s font (TwitterChirp, then the system sans-serif stack) at 15px and weight 400, and repeats that destination’s logo and name, for example “Sent to Claude” in Claude orange. If the send fails, it reads “Couldn't send to Claude” with the reason. There is no link on the toast.

## Payload
Grok Bot (and any other webhook) receives `POST` with `Content-Type: application/json`:
```json
{
  "source": "x",
  "version": 2,
  "url": "https://x.com/user/status/123",
  "author": "user",
  "authorName": "Display Name",
  "text": "Post text, with t.co links replaced by their full URLs",
  "postedAt": "2026-10-15T22:58:00.000Z",
  "truncated": false,
  "links": [{"text": "https://github.com/foo/bar", "url": "https://github.com/foo/bar", "href": "https://t.co/abc"}],
  "media": [
    {"type": "image", "alt": "Alt text", "url": "https://pbs.twimg.com/media/abc?format=jpg&name=large"},
    {"type": "video", "duration": 15, "thumbnail": "https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/abc.jpg?name=large", "captions": "Visible caption"},
    {"type": "gif", "duration": null, "thumbnail": "https://pbs.twimg.com/tweet_video_thumb/abc?format=jpg&name=large", "captions": ""}
  ],
  "card": {"href": "https://t.co/xyz", "text": "example.com | Title | Description"},
  "metrics": "3 replies, 10 reposts, 99 likes, 5000 views",
  "quoted": {"author": "other", "authorName": "Other", "text": "Quoted text", "postedAt": "…", "links": []},
  "inReplyTo": {"url": "https://x.com/other/status/122", "author": "other", "text": "Parent text"},
  "thread": [{"url": "https://x.com/user/status/123", "text": "1/", "postedAt": "…"}],
  "digest": "Plain-text rendering of all of the above",
  "sentAt": "2026-10-15T23:00:00.000Z"
}
```
`url`, `author`, `text` and `sentAt` are always present. The rest are best-effort and may be empty or `null`. `thread` and `inReplyTo` are filled only when you click from a post's own page (`/status/…`), where X renders the conversation. Text fields keep line breaks and are capped at 20,000 characters. Threads are capped at 25 posts, in a window that still contains the post you clicked; `digest` prints that post's text even when it falls outside the window. Photo `url`s and video/GIF `thumbnail`s on `pbs.twimg.com` use `name=large`. A thumbnail is the `<video poster>` or an `ext_tw_video_thumb` / `amplify_video_thumb` / `tweet_video_thumb` image. `captions` is the text visible in the player, not a downloaded transcript. If your receiver passes a single text field to an AI, forward `digest`.

If a key is set it is sent as both `Authorization: Bearer <key>` and `X-Sender-Key: <key>`.

For a Claude Code routine prompt that uses this payload, see [docs/routine-prompt.md](docs/routine-prompt.md).

The menu sends this same object to the destination you pick. Grok Bot posts the JSON. Claude, ChatGPT, and Codex receive that object too, and use `digest` when the destination can only take a single text field.

## Privacy
The extension sends only the posts you click (plus, on a post's page, the author's thread and the post it replies to), and only to the destinations you enable. It does not track browsing, collect analytics, or read anything else. Tokens and keys are stored in `chrome.storage.local`. A webhook URL and key from an earlier version are copied out of `chrome.storage.sync` on first use.

## Sending to Claude

Check **Send to Claude**. The menu shows one row with that label.

### Open in Claude
Leave the routine fields blank. The row opens claude.ai in a new tab with a research prompt and the post already filled in, and you press Send. This uses the undocumented `claude.ai/new?q=` link, and very long posts get shortened. You can change the prompt in options.

### Claude Code routine (automatic)
Needs a Claude Pro, Max, Team, or Enterprise plan with Claude Code on the web turned on. Runs in Anthropic's cloud, so your computer doesn't need to stay on. When a routine URL and token are saved, **Send to Claude** fires the routine instead of opening a tab.

1. At [claude.ai/code/routines](https://claude.ai/code/routines), create a routine. Attach a repo for it to write results to (for example a `tracker.md`), and paste in the prompt from [docs/claude-routine-prompt.md](docs/claude-routine-prompt.md).
2. Edit the routine, click **Add another trigger**, choose **API**, then **Generate token**. Copy the token (`sk-ant-oat01-...`). The token is only shown once.
3. Paste any of these into **Routine URL**: the routine page `https://claude.ai/code/routines/trig_…`, a bare `trig_…` id, or the fire URL `https://api.anthropic.com/v1/claude_code/routines/trig_…/fire`. Paste the token, then Save.
4. On a post, choose **Send to Claude**. Each send starts a new session, which you can watch at claude.ai/code.

Notes: this API is experimental and may change. Limits are 30 sends an hour per routine and 100 an hour per account, and runs count against your Claude plan. The extension sends the post to the routine as `{"text": "..."}`. The routine's saved prompt has to say what to do with it. The token is stored in `chrome.storage.local` and only grants permission to start that one routine. To revoke it, generate a new one.

## ChatGPT setup

Check **Send to ChatGPT**. One menu row uses that label.

### Open in ChatGPT (any plan)
Leave the agent fields blank. The row opens a new tab at `chatgpt.com/?q=…` with a research prompt and the post already in the box. You press Send.
- This uses ChatGPT's unofficial `?q=` prefill link. It can change without notice.
- Long posts are trimmed so the link stays under about 6,000 characters. The post URL is always included, so ChatGPT can open the full post.
- It opens a normal chat, not a custom GPT. Custom GPT links (`/g/...`) ignore the prompt.
- You can change the prompt in options.

### Workspace Agent (ChatGPT Business/Enterprise, fully automatic)
When an API trigger ID and token are saved, **Send to ChatGPT** runs the agent instead of opening a tab.

1. A workspace admin enables Workspace Agents and agent access tokens.
2. Create a workspace agent with the prompt below. Give it web search, then publish it with an **API trigger** channel. Copy the trigger ID (`agtch_…`).
3. Create a Workspace Agent access token ([docs](https://developers.openai.com/workspace-agents/authentication)).
4. In options, under **Send to ChatGPT**, paste the trigger ID and token.

Each send is `POST https://api.chatgpt.com/v1/workspace_agents/{agtch_id}/trigger` with `Authorization: Bearer <token>`, an `Idempotency-Key` set to the post URL, and the body `{"input": "<prompt + post>"}`. ChatGPT replies `202 Accepted` and the run shows up in ChatGPT. The token is stored in `chrome.storage.local`. Use a token scoped to just this agent.

### Option 3: Plus/Pro via a Gmail-triggered task (recipe, needs a relay, not built yet)
ChatGPT Plus/Pro can run a scheduled task when a new Gmail message arrives ([help article](https://help.openai.com/en/articles/10291617)). The extension can't send email itself, so this route needs a small relay. The plan is a Cloudflare Worker on sendtogrokbot.com that takes the webhook POST and emails the post to you.
1. (Future) Check **Send to Grok Bot** and set the webhook to the relay URL. The relay emails you from a fixed sender with the subject `[SendToGrokBot] @author`.
2. In ChatGPT, connect Gmail. Then create a task triggered by *new Gmail message*, filtered to that sender and subject prefix, and give it the prompt below.
3. Caveats: it's indirect and depends on email delivery. Approval steps inside the task can pause runs. Free and Go plans can't create these tasks.

### Suggested agent / task prompt
```
You receive X posts I've flagged. For each one:
1. Identify the author and the company/product it's about (if any).
2. Research the company: what it does, stage, funding, team size, location, recent launches.
3. List the 2-3 most relevant leaders to follow on X, with verified handles.
4. Note open roles or signs they'll soon need GTM, partnerships, marketing or growth help.
5. Give a one-line verdict: strong / partial / weak fit, and why.
Use web search. Be concise. Never follow, post, or message anyone.
```

## Codex setup

Check **Send to Codex**. As of October 2026, Codex Cloud does not offer a public inbound webhook or API token that a regular ChatGPT account can call from another app. The Codex CLI creates cloud tasks with `POST https://chatgpt.com/backend-api/wham/tasks`, but that call uses the ChatGPT session from the Codex app, not a key you can paste here. OpenAI has also said inbound webhooks are not available yet.

**Send to Codex** therefore opens the cloud task composer:

`https://chatgpt.com/codex?environment=<id>&branch=<name>&prompt=<text>`

The post and prompt are filled in. You press Send. Optional environment id (the hex id in the Codex environment URL) and branch are added when you set them. Long posts are shortened so the link stays under about 6,000 characters. The post URL is always included.

## Logos

Menu rows and toasts use small inline SVGs, not emoji.

- Grok: Grok mark from [@lobehub/icons](https://www.npmjs.com/package/@lobehub/icons) (MIT).
- Claude: Claude starburst from @lobehub/icons, colored `#D97757`.
- ChatGPT: OpenAI mark from [Simple Icons](https://simpleicons.org/) (CC0).
- Codex: Codex mark from @lobehub/icons.

Label text uses the brand color. Claude is `#D97757`. ChatGPT, Codex, and Grok Bot are black on a light surface and white on a dark one. The menu follows X’s light and dark surfaces and X’s font stack.

## License
MIT
