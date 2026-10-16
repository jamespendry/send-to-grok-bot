# Send to Grok Bot

A small Chrome (Manifest V3) extension that adds a native-looking "Send to Grok Bot" icon to the action bar of every post on x.com. One click sends that post to the destinations you turn on. A Grok Bot routine webhook lets your bot research it, file it, or act on it. Any webhook that accepts JSON works too (Zapier, Make, n8n, your own server). You can also send it to a Claude Code routine, open it in Claude or ChatGPT, or trigger a ChatGPT Workspace Agent. More than one destination can be on at the same time.

## Install (unpacked)
1. Download or clone this repo (or unzip `send-to-grok-bot.zip`).
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.

## Configure
1. Click the extension's toolbar icon (or Details > Extension options).
2. Check each destination you want and fill in its fields, then click **Save**. Tokens and keys are stored in `chrome.storage.local`. A webhook URL and key saved by an earlier version are migrated from sync storage.
3. Refresh x.com. Click the arrow icon in the post's action bar — it uses the same slot, hit area, and icon size as Share. It turns green when the send succeeds and red if it failed. A second click on the same post within 5 seconds is ignored.
4. A brief toast at the bottom center of the page fades out after about 3 seconds. It uses X’s font (TwitterChirp, then the system sans-serif stack) at 15px. With one destination it reads “Sent to Grok Bot”, “Sent to Claude”, “Opened in Claude”, “Opened in ChatGPT”, or “Sent to ChatGPT”. With more than one it reads “Sent”. If the send fails, the toast shows the error message on a red background.

## Payload
Grok Bot (and any other webhook) receives `POST` with `Content-Type: application/json`:
```json
{
  "source": "x",
  "url": "https://x.com/user/status/123",
  "text": "Post text",
  "author": "user",
  "sentAt": "2026-10-15T23:00:00.000Z"
}
```
If a key is set it is sent as both `Authorization: Bearer <key>` and `X-Sender-Key: <key>`.

## Privacy
The extension sends only the posts you click, and only to the destinations you enable. It does not track browsing, collect analytics, or read anything else. Tokens and keys are stored in `chrome.storage.local`. A webhook URL and key from an earlier version are copied out of `chrome.storage.sync` on first use.

## Sending to Claude

On the options page, check either or both Claude destinations.

### Claude Code routine (automatic)
Needs a Claude Pro, Max, Team, or Enterprise plan with Claude Code on the web turned on. Runs in Anthropic's cloud, so your computer doesn't need to stay on.

1. At [claude.ai/code/routines](https://claude.ai/code/routines), create a routine. Attach a repo for it to write results to (for example a `tracker.md`), and paste in the prompt from [docs/claude-routine-prompt.md](docs/claude-routine-prompt.md).
2. Edit the routine, click **Add another trigger**, choose **API**, then **Generate token**. Copy the URL (`https://api.anthropic.com/v1/claude_code/routines/trig_.../fire`) and the token (`sk-ant-oat01-...`). The token is only shown once.
3. In the extension options, check **Claude Code routine**, paste the URL and token, and click Save.
4. Click the button on any post. Each click starts a new session, which you can watch at claude.ai/code.

Notes: this API is experimental and may change. Limits are 30 sends an hour per routine and 100 an hour per account, and runs count against your Claude plan. The extension sends the post to the routine as `{"text": "..."}`. The routine's saved prompt has to say what to do with it. The token is stored in `chrome.storage.local` and only grants permission to start that one routine. To revoke it, generate a new one.

### Open in Claude (one click)
Works on any plan. It opens claude.ai in a new tab with a research prompt and the post already filled in, and you press Send. You can change the prompt in options. This uses the undocumented `claude.ai/new?q=` link, and very long posts get shortened. Both Claude destinations share that prompt: for the routine it is optional extra text prepended to the post.

## ChatGPT setup

Open the extension's options and check a ChatGPT destination. You can leave Grok Bot and Claude on at the same time.

### Option 1: Open in ChatGPT (any plan, one click)
Check **Open in ChatGPT**. Clicking the button opens a new tab at `chatgpt.com/?q=…` with a research prompt and the post already in the box. You press Send.
- This uses ChatGPT's unofficial `?q=` prefill link. It can change without notice.
- Long posts are trimmed so the link stays under about 6,000 characters. The post URL is always included, so ChatGPT can open the full post.
- It opens a normal chat, not a custom GPT. Custom GPT links (`/g/...`) ignore the prompt.
- You can change the prompt in options. The same prompt is used for the Workspace Agent.

### Option 2: Workspace Agent (ChatGPT Business/Enterprise, fully automatic)
1. A workspace admin enables Workspace Agents and agent access tokens.
2. Create a workspace agent with the prompt below. Give it web search, then publish it with an **API trigger** channel. Copy the trigger ID (`agtch_…`).
3. Create a Workspace Agent access token ([docs](https://developers.openai.com/workspace-agents/authentication)).
4. In options, check **ChatGPT Workspace Agent** and paste the trigger ID and token.

Each click sends `POST https://api.chatgpt.com/v1/workspace_agents/{agtch_id}/trigger` with `Authorization: Bearer <token>`, an `Idempotency-Key` set to the post URL, and the body `{"input": "<prompt + post>"}`. ChatGPT replies `202 Accepted` and the run shows up in ChatGPT. The token is stored in `chrome.storage.local`. Use a token scoped to just this agent.

### Option 3: Plus/Pro via a Gmail-triggered task (recipe, needs a relay, not built yet)
ChatGPT Plus/Pro can run a scheduled task when a new Gmail message arrives ([help article](https://help.openai.com/en/articles/10291617)). The extension can't send email itself, so this route needs a small relay. The plan is a Cloudflare Worker on sendtogrokbot.com that takes the webhook POST and emails the post to you.
1. (Future) Check **Grok Bot / webhook** and set it to the relay URL. The relay emails you from a fixed sender with the subject `[SendToGrokBot] @author`.
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

## License
MIT
